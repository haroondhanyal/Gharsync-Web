import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  BadRequestException, ConflictException, Injectable, NotFoundException,
  ServiceUnavailableException, UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { OrganizationRole } from "../generated/prisma/enums.js";
import { ensureDefaultPermissions } from "../permissions/permission-catalog.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { type AuthContext } from "./auth-context.js";
import { DeliveryService } from "./delivery.service.js";
import { PasswordHasherService } from "./password-hasher.service.js";
import { PhoneOtpService } from "./phone-otp.service.js";

const ACCESS_TTL_SECONDS = 15 * 60;
const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;
type TokenPair = { accessToken: string; refreshToken: string };
type RequestInfo = { ip?: string; userAgent?: string };

const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
const slugPart = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 72) || "business";
const normalizePhone = (phone: string) => {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (digits.startsWith("92")) digits = digits.slice(2);
  return `+92${digits}`;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly passwords: PasswordHasherService,
    private readonly otp: PhoneOtpService,
    private readonly delivery: DeliveryService,
  ) {}

  private async tokens(userId: string, sessionId: string, familyId: string, organizationId: string | null): Promise<TokenPair> {
    const issuer = "gharsync-api";
    const accessToken = await this.jwt.signAsync(
      { sub: userId, sid: sessionId, orgId: organizationId, use: "access" },
      { secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"), issuer, audience: "gharsync-web", expiresIn: ACCESS_TTL_SECONDS },
    );
    const refreshToken = await this.jwt.signAsync(
      { sub: userId, sid: sessionId, fid: familyId, use: "refresh" },
      { secret: this.config.getOrThrow<string>("JWT_REFRESH_SECRET"), issuer, audience: "gharsync-refresh", expiresIn: REFRESH_TTL_SECONDS },
    );
    return { accessToken, refreshToken };
  }

  private async createSession(userId: string, organizationId: string | null) {
    const sessionId = randomUUID();
    const familyId = randomUUID();
    const tokens = await this.tokens(userId, sessionId, familyId, organizationId);
    await this.prisma.refreshSession.create({
      data: {
        id: sessionId, familyId, userId, organizationId,
        tokenHash: tokenHash(tokens.refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TTL_SECONDS * 1000),
      },
    });
    return tokens;
  }

  private async audit(action: string, userId: string | null, organizationId: string | null, info: RequestInfo = {}, metadata?: object) {
    await this.prisma.auditLog.create({
      data: {
        action, actorUserId: userId, organizationId,
        ipAddress: info.ip?.slice(0, 64), userAgent: info.userAgent?.slice(0, 500),
        ...(metadata ? { metadata } : {}),
      },
    });
  }

  async register(input: {
    accountType: "business" | "team";
    fullName: string;
    email: string;
    password: string;
    phone: string;
    organizationName?: string;
    businessType?: string;
    city?: string;
  }, info: RequestInfo) {
    if (!this.config.get<string>("JWT_ACCESS_SECRET") || !this.config.get<string>("JWT_REFRESH_SECRET")) {
      throw new ServiceUnavailableException("Authentication is not configured. Set the JWT secrets first.");
    }
    if (!this.delivery.smsConfigured) throw new ServiceUnavailableException("Phone verification delivery is not configured yet.");
    const email = input.email.trim().toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email }, select: { id: true } })) {
      throw new ConflictException("An account with this email already exists.");
    }
    const passwordHash = await this.passwords.hash(input.password);
    let organizationId: string | null = null;
    let userId = "";
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: { fullName: input.fullName, email, phone: normalizePhone(input.phone), passwordHash },
          select: { id: true, email: true, fullName: true },
        });
        let organization = null;
        if (input.accountType === "business") {
          const name = input.organizationName?.trim();
          const city = input.city?.trim();
          if (!name || !city || !input.businessType) throw new BadRequestException("Business name, service type, and city are required.");
          organization = await tx.organization.create({
            data: {
              name, slug: `${slugPart(name)}-${randomUUID().slice(0, 8)}`,
              businessType: input.businessType, branches: { create: { name: "Main branch", city, isDefault: true } },
            },
            select: { id: true },
          });
          const owner = await tx.organizationMember.create({
            data: { organizationId: organization.id, userId: user.id, role: OrganizationRole.OWNER, status: "ACTIVE", joinedAt: new Date() },
            select: { branchId: true },
          });
          await ensureDefaultPermissions(tx);
          await tx.auditLog.create({
            data: { actorUserId: user.id, organizationId: organization.id, action: "organization.created", resourceType: "organization", resourceId: organization.id, ipAddress: info.ip?.slice(0, 64), userAgent: info.userAgent?.slice(0, 500) },
          });
          return { user, organizationId: organization.id, branchId: owner.branchId };
        }
        return { user, organizationId: null, branchId: null };
      });
      userId = created.user.id;
      organizationId = created.organizationId;
    } catch (error) {
      if ((error as { code?: string })?.code === "P2002") throw new ConflictException("An account with this email already exists.");
      throw error;
    }
    const tokens = await this.createSession(userId, organizationId);
    try {
      await this.otp.request(userId);
    } catch (error) {
      await this.prisma.refreshSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
      throw error;
    }
    await this.audit("auth.registered", userId, organizationId, info);
    return { tokens, user: { id: userId, fullName: input.fullName, email }, phoneVerificationRequired: true };
  }

  async signIn(emailInput: string, password: string, info: RequestInfo) {
    const email = emailInput.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    const valid = user && !user.deletedAt && await this.passwords.verify(password, user.passwordHash);
    if (!valid || !user) {
      if (user) await this.audit("auth.sign_in_failed", user.id, null, info);
      throw new UnauthorizedException("Email or password is incorrect.");
    }
    const memberships = await this.prisma.organizationMember.findMany({
      where: { userId: user.id, status: "ACTIVE", organization: { deletedAt: null } },
      orderBy: { invitedAt: "asc" }, select: { organizationId: true, role: true, branchId: true, organization: { select: { id: true, name: true } } },
    });
    const organizationId = memberships[0]?.organizationId ?? null;
    const tokens = await this.createSession(user.id, organizationId);
    await this.audit("auth.signed_in", user.id, organizationId, info);
    return { tokens, user: { id: user.id, fullName: user.fullName, email: user.email, memberships }, phoneVerificationRequired: !user.phoneVerifiedAt };
  }

  async refresh(token: string) {
    let claims: { sub: string; sid: string; fid: string; use: string };
    try {
      claims = await this.jwt.verifyAsync(token, {
        secret: this.config.getOrThrow<string>("JWT_REFRESH_SECRET"), issuer: "gharsync-api", audience: "gharsync-refresh",
      });
    } catch {
      throw new UnauthorizedException("Refresh token is invalid or expired.");
    }
    if (claims.use !== "refresh" || !claims.sub || !claims.sid || !claims.fid) throw new UnauthorizedException();
    const existing = await this.prisma.refreshSession.findUnique({ where: { id: claims.sid } });
    if (!existing || existing.userId !== claims.sub || existing.familyId !== claims.fid) throw new UnauthorizedException();
    if (existing.revokedAt || existing.expiresAt <= new Date() || existing.tokenHash !== tokenHash(token)) {
      if (existing.revokedAt || existing.tokenHash !== tokenHash(token)) {
        await this.prisma.refreshSession.updateMany({ where: { familyId: existing.familyId, revokedAt: null }, data: { revokedAt: new Date() } });
      }
      throw new UnauthorizedException("Refresh token is invalid or expired.");
    }
    const nextId = randomUUID();
    const rotatedTokens = await this.tokens(existing.userId, nextId, existing.familyId, existing.organizationId);
    try {
      await this.prisma.$transaction(async (tx) => {
        const claim = await tx.refreshSession.updateMany({
          where: { id: existing.id, tokenHash: tokenHash(token), revokedAt: null, expiresAt: { gt: new Date() } },
          data: { revokedAt: new Date(), lastUsedAt: new Date() },
        });
        if (claim.count !== 1) throw new UnauthorizedException("Refresh token was already used.");
        await tx.refreshSession.create({
          data: {
            id: nextId, familyId: existing.familyId, userId: existing.userId, organizationId: existing.organizationId,
            tokenHash: tokenHash(rotatedTokens.refreshToken), expiresAt: new Date(Date.now() + REFRESH_TTL_SECONDS * 1000),
          },
        });
      });
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        await this.prisma.refreshSession.updateMany({ where: { familyId: existing.familyId, revokedAt: null }, data: { revokedAt: new Date() } });
      }
      throw error;
    }
    return rotatedTokens;
  }

  async signOut(refreshToken?: string, info: RequestInfo = {}) {
    if (refreshToken) {
      try {
        const claims = await this.jwt.verifyAsync<{ sub: string; sid: string }>(refreshToken, {
          secret: this.config.getOrThrow<string>("JWT_REFRESH_SECRET"), issuer: "gharsync-api", audience: "gharsync-refresh",
        });
        await this.prisma.refreshSession.updateMany({
          where: { id: claims.sid, userId: claims.sub, tokenHash: tokenHash(refreshToken), revokedAt: null },
          data: { revokedAt: new Date() },
        });
        await this.audit("auth.signed_out", claims.sub, null, info);
      } catch { /* logout remains idempotent for expired or malformed cookies */ }
    }
    return { status: "signed_out" };
  }

  async signOutEverywhere(auth: AuthContext) {
    await this.prisma.refreshSession.updateMany({ where: { userId: auth.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    await this.audit("auth.signed_out_everywhere", auth.userId, auth.organizationId);
    return { status: "signed_out_everywhere" };
  }

  async getMe(userId: string, currentOrganizationId: string | null) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true, email: true, fullName: true, phone: true, phoneVerifiedAt: true, createdAt: true,
        memberships: { where: { status: "ACTIVE", organization: { deletedAt: null } }, select: { role: true, branchId: true, organization: { select: { id: true, name: true, slug: true, currency: true, timezone: true } } } },
      },
    });
    if (!user) throw new UnauthorizedException();
    return { ...user, currentOrganizationId };
  }

  async selectOrganization(auth: AuthContext, organizationId: string) {
    const membership = await this.prisma.organizationMember.findFirst({
      where: { organizationId, userId: auth.userId, status: "ACTIVE", organization: { deletedAt: null } },
      select: { organization: { select: { id: true, name: true } } },
    });
    if (!membership) throw new NotFoundException("Organization not found.");
    await this.prisma.refreshSession.update({ where: { id: auth.sessionId }, data: { organizationId } });
    const session = await this.prisma.refreshSession.findUniqueOrThrow({ where: { id: auth.sessionId } });
    const accessToken = (await this.tokens(auth.userId, session.id, session.familyId, organizationId)).accessToken;
    await this.audit("organization.selected", auth.userId, organizationId);
    return { accessToken, organization: membership.organization };
  }

  async listSessions(auth: AuthContext) {
    const rows = await this.prisma.refreshSession.findMany({
      where: { userId: auth.userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      select: { id: true, createdAt: true, lastUsedAt: true, expiresAt: true, organization: { select: { id: true, name: true } } },
    });
    return rows.map((row) => ({ ...row, current: row.id === auth.sessionId }));
  }

  async revokeSession(auth: AuthContext, sessionId: string) {
    const result = await this.prisma.refreshSession.updateMany({ where: { id: sessionId, userId: auth.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    if (!result.count) throw new NotFoundException("Session not found.");
    await this.audit("auth.session_revoked", auth.userId, auth.organizationId, {}, { sessionId });
    return { status: "revoked" };
  }

  async requestPasswordReset(emailInput: string) {
    if (!this.delivery.emailConfigured) throw new ServiceUnavailableException("Password recovery email delivery is not configured yet.");
    const user = await this.prisma.user.findUnique({ where: { email: emailInput.trim().toLowerCase() }, select: { id: true, email: true, fullName: true } });
    if (!user) return { status: "accepted" };
    const token = randomBytes(32).toString("base64url");
    const row = await this.prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
    });
    const appUrl = this.config.get<string>("APP_URL") ?? "http://localhost:3000";
    try {
      await this.delivery.sendEmail(user.email, "Reset your GharSync password", `Hello ${user.fullName},\n\nReset your password using this link within one hour:\n${appUrl}/reset-password?token=${encodeURIComponent(token)}\n\nIf you did not request this, you can ignore this email.`);
    } catch (error) {
      await this.prisma.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } });
      throw error;
    }
    return { status: "accepted" };
  }

  async completePasswordReset(token: string, password: string) {
    const hashed = tokenHash(token);
    const row = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash: hashed }, select: { id: true, userId: true, expiresAt: true, usedAt: true } });
    if (!row || row.usedAt || row.expiresAt <= new Date()) throw new BadRequestException("This password reset link is invalid or expired.");
    const passwordHash = await this.passwords.hash(password);
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const consumed = await tx.passwordResetToken.updateMany({ where: { id: row.id, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } });
      if (consumed.count !== 1) throw new BadRequestException("This password reset link is invalid or expired.");
      await tx.user.update({ where: { id: row.userId }, data: { passwordHash } });
      await tx.refreshSession.updateMany({ where: { userId: row.userId, revokedAt: null }, data: { revokedAt: now } });
      await tx.passwordResetToken.updateMany({ where: { userId: row.userId, usedAt: null }, data: { usedAt: now } });
      await tx.auditLog.create({ data: { actorUserId: row.userId, action: "auth.password_reset" } });
    });
    return { status: "password_updated" };
  }

  requestPhoneOtp(userId: string) { return this.otp.request(userId); }
  verifyPhoneOtp(userId: string, code: string) { return this.otp.verify(userId, code); }

  async createOrganization(userId: string, input: { name: string; businessType: string; city: string; address?: string }) {
    const name = input.name.trim();
    const org = await this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name, slug: `${slugPart(name)}-${randomUUID().slice(0, 8)}`, businessType: input.businessType,
          branches: { create: { name: "Main branch", city: input.city, address: input.address, isDefault: true } },
        }, select: { id: true, name: true, slug: true, currency: true, timezone: true },
      });
      await tx.organizationMember.create({ data: { organizationId: organization.id, userId, role: OrganizationRole.OWNER, status: "ACTIVE", joinedAt: new Date() } });
      await ensureDefaultPermissions(tx);
      await tx.auditLog.create({ data: { actorUserId: userId, organizationId: organization.id, action: "organization.created", resourceType: "organization", resourceId: organization.id } });
      return organization;
    });
    return org;
  }
}
