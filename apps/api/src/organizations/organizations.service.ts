import { createHash, randomBytes, randomUUID } from "node:crypto";
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OrganizationRole } from "../generated/prisma/enums.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type { AuthContext } from "../auth/auth-context.js";
import { DeliveryService } from "../auth/delivery.service.js";
import { ensureDefaultPermissions } from "../permissions/permission-catalog.js";
import { EntitlementsService } from "../platform/entitlements.service.js";
import { deleteImage, imageMime, readImage, saveImage } from "../common/image-storage.js";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const slugPart = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 72) || "business";
const inviteRoles = new Set<OrganizationRole>([OrganizationRole.ADMIN, OrganizationRole.MANAGER, OrganizationRole.STAFF, OrganizationRole.TECHNICIAN]);

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly delivery: DeliveryService,
    private readonly entitlements: EntitlementsService,
  ) {}

  async create(userId: string, input: { name: string; businessType: string; city: string; address?: string }) {
    const name = input.name.trim();
    return this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name, slug: `${slugPart(name)}-${randomUUID().slice(0, 8)}`, businessType: input.businessType,
          branches: { create: { name: "Main branch", city: input.city, address: input.address, isDefault: true } },
        }, select: { id: true, name: true, slug: true, currency: true, timezone: true, createdAt: true },
      });
      const freePlan = await tx.subscriptionPlan.findUnique({ where: { key: "FREE" } });
      if (freePlan) await tx.subscription.create({ data: { organizationId: organization.id, planId: freePlan.id, status: "TRIAL", periodEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) } });
      await tx.organizationMember.create({ data: { organizationId: organization.id, userId, role: OrganizationRole.OWNER, status: "ACTIVE", joinedAt: new Date() } });
      await ensureDefaultPermissions(tx);
      await tx.auditLog.create({ data: { actorUserId: userId, organizationId: organization.id, action: "organization.created", resourceType: "organization", resourceId: organization.id } });
      return organization;
    });
  }

  async branches(auth: AuthContext) {
    const rows = await this.prisma.branch.findMany({
      where: { organizationId: auth.organizationId!, deletedAt: null, ...(auth.branchId ? { id: auth.branchId } : {}) },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      select: { id: true, name: true, city: true, countryCode: true, address: true, phone: true, photoUpdatedAt: true, isDefault: true, createdAt: true },
    });
    return rows.map(({ photoUpdatedAt, ...branch }) => ({ ...branch, photoUrl: photoUpdatedAt ? `/api/v1/organizations/branches/${branch.id}/photo?v=${photoUpdatedAt.getTime()}` : null }));
  }

  async createBranch(auth: AuthContext, input: { name: string; city: string; countryCode: string; address?: string; phone?: string }) {
    if (!auth.organizationId) throw new ForbiddenException();
    await this.entitlements.assertCapacity(auth.organizationId, "branches");
    return this.prisma.branch.create({
      data: { organizationId: auth.organizationId, name: input.name, city: input.city, countryCode: input.countryCode, address: input.address, phone: input.phone },
      select: { id: true, name: true, city: true, countryCode: true, address: true, phone: true, isDefault: true },
    });
  }

  async uploadBranchPhoto(auth: AuthContext, branchId: string, file: Express.Multer.File | undefined) {
    const branch = await this.prisma.branch.findFirst({ where: { id: branchId, organizationId: auth.organizationId!, deletedAt: null, ...(auth.branchId ? { id: auth.branchId } : {}) }, select: { photoStorageKey: true } });
    if (!branch) throw new NotFoundException("Branch not found.");
    const mimeType = imageMime(file);
    const storageKey = await saveImage(file!, mimeType);
    try {
      const updated = await this.prisma.branch.update({ where: { id: branchId }, data: { photoStorageKey: storageKey, photoMimeType: mimeType, photoUpdatedAt: new Date() }, select: { photoUpdatedAt: true } });
      await deleteImage(branch.photoStorageKey);
      await this.prisma.auditLog.create({ data: { organizationId: auth.organizationId!, actorUserId: auth.userId, action: "branch.photo_updated", resourceType: "branch", resourceId: branchId } });
      return { photoUrl: `/api/v1/organizations/branches/${branchId}/photo?v=${updated.photoUpdatedAt?.getTime()}` };
    } catch (error) { await deleteImage(storageKey); throw error; }
  }

  async branchPhoto(auth: AuthContext, branchId: string) {
    const branch = await this.prisma.branch.findFirst({ where: { id: branchId, organizationId: auth.organizationId!, deletedAt: null, ...(auth.branchId ? { id: auth.branchId } : {}) }, select: { photoStorageKey: true, photoMimeType: true } });
    if (!branch?.photoStorageKey || !branch.photoMimeType) throw new NotFoundException("Branch photo not found.");
    const buffer = await readImage(branch.photoStorageKey);
    if (!buffer) throw new NotFoundException("Branch photo not found.");
    return { buffer, mimeType: branch.photoMimeType };
  }

  async removeBranchPhoto(auth: AuthContext, branchId: string) {
    const branch = await this.prisma.branch.findFirst({ where: { id: branchId, organizationId: auth.organizationId!, deletedAt: null, ...(auth.branchId ? { id: auth.branchId } : {}) }, select: { photoStorageKey: true } });
    if (!branch) throw new NotFoundException("Branch not found.");
    await this.prisma.branch.update({ where: { id: branchId }, data: { photoStorageKey: null, photoMimeType: null, photoUpdatedAt: null } });
    await deleteImage(branch.photoStorageKey);
    return { status: "removed" };
  }

  private requireActiveOrganization(auth: AuthContext, organizationId: string) {
    if (auth.organizationId !== organizationId) throw new NotFoundException("Organization not found.");
  }

  async members(auth: AuthContext, organizationId: string) {
    this.requireActiveOrganization(auth, organizationId);
    return this.prisma.organizationMember.findMany({
      where: {
        organizationId,
        ...(auth.branchId ? { branchId: auth.branchId } : {}),
        status: { not: "SUSPENDED" },
      },
      orderBy: [{ role: "asc" }, { invitedAt: "asc" }],
      select: { id: true, role: true, status: true, invitedAt: true, joinedAt: true, branch: { select: { id: true, name: true } }, user: { select: { id: true, fullName: true, email: true, phone: true } } },
    });
  }

  async updateMember(auth: AuthContext, organizationId: string, memberId: string, input: { role?: OrganizationRole; branchId?: string | null }) {
    this.requireActiveOrganization(auth, organizationId);
    const member = await this.prisma.organizationMember.findFirst({
      where: { id: memberId, organizationId, ...(auth.branchId ? { branchId: auth.branchId } : {}) },
      select: { id: true, role: true, branchId: true, userId: true },
    });
    if (!member) throw new NotFoundException("Member not found.");
    if (input.role === OrganizationRole.ADMIN && auth.role !== OrganizationRole.OWNER) throw new ForbiddenException("Only an owner can assign administrator access.");
    if (auth.branchId && input.branchId !== undefined && input.branchId !== auth.branchId) throw new ForbiddenException("You can manage members only within your assigned branch.");
    if (input.branchId) {
      const branch = await this.prisma.branch.findFirst({ where: { id: input.branchId, organizationId, deletedAt: null }, select: { id: true } });
      if (!branch) throw new BadRequestException("The selected branch does not belong to this organization.");
    }
    if (member.role === OrganizationRole.OWNER && input.role && input.role !== OrganizationRole.OWNER) {
      const ownerCount = await this.prisma.organizationMember.count({ where: { organizationId, role: OrganizationRole.OWNER, status: "ACTIVE" } });
      if (ownerCount <= 1) throw new ConflictException("An organization must keep at least one active owner.");
    }
    const updated = await this.prisma.organizationMember.update({
      where: { id: memberId },
      data: { ...(input.role ? { role: input.role } : {}), ...(input.branchId !== undefined ? { branchId: input.branchId } : {}) },
      select: { id: true, role: true, status: true, branchId: true, user: { select: { id: true, email: true, fullName: true } } },
    });
    await this.prisma.auditLog.create({ data: { organizationId, actorUserId: auth.userId, action: "organization.member_updated", resourceType: "member", resourceId: memberId, metadata: input } });
    return updated;
  }

  async suspendMember(auth: AuthContext, organizationId: string, memberId: string) {
    this.requireActiveOrganization(auth, organizationId);
    const member = await this.prisma.organizationMember.findFirst({
      where: { id: memberId, organizationId, ...(auth.branchId ? { branchId: auth.branchId } : {}) },
      select: { id: true, role: true, userId: true },
    });
    if (!member) throw new NotFoundException("Member not found.");
    if (member.role === OrganizationRole.OWNER) {
      const ownerCount = await this.prisma.organizationMember.count({ where: { organizationId, role: OrganizationRole.OWNER, status: "ACTIVE" } });
      if (ownerCount <= 1) throw new ConflictException("An organization must keep at least one active owner.");
    }
    await this.prisma.organizationMember.update({ where: { id: memberId }, data: { status: "SUSPENDED" } });
    await this.prisma.auditLog.create({ data: { organizationId, actorUserId: auth.userId, action: "organization.member_suspended", resourceType: "member", resourceId: memberId } });
    return { status: "suspended" };
  }

  async createInvite(auth: AuthContext, organizationId: string, input: { email: string; role: OrganizationRole; branchId?: string }) {
    this.requireActiveOrganization(auth, organizationId);
    await this.entitlements.assertCapacity(organizationId, "staff");
    if (!inviteRoles.has(input.role)) throw new BadRequestException("This role cannot be assigned by invitation.");
    if (input.role === OrganizationRole.ADMIN && auth.role !== OrganizationRole.OWNER) throw new ForbiddenException("Only an owner can invite an administrator.");
    if (auth.branchId && input.branchId !== auth.branchId) throw new ForbiddenException("You can invite staff only to your assigned branch.");
    const email = input.email.trim().toLowerCase();
    const existingUser = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existingUser && await this.prisma.organizationMember.findUnique({ where: { organizationId_userId: { organizationId, userId: existingUser.id } }, select: { id: true } })) {
      throw new ConflictException("This person is already a member of the organization.");
    }
    if (input.branchId) {
      const branch = await this.prisma.branch.findFirst({ where: { id: input.branchId, organizationId, deletedAt: null }, select: { id: true } });
      if (!branch) throw new BadRequestException("The selected branch does not belong to this organization.");
    }
    const token = randomBytes(32).toString("base64url");
    const invite = await this.prisma.organizationInvite.create({
      data: {
        organizationId, branchId: input.branchId, invitedByUserId: auth.userId, email, role: input.role,
        tokenHash: hash(token), expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      }, select: { id: true, email: true, role: true, expiresAt: true, organization: { select: { name: true } } },
    });
    const appUrl = this.config.get<string>("APP_URL") ?? "http://localhost:3000";
    const inviteUrl = `${appUrl}/join?token=${encodeURIComponent(token)}`;
    if (this.delivery.emailConfigured) {
      try {
        await this.delivery.sendEmail(email, `Join ${invite.organization.name} on GharSync`, `You have been invited to join ${invite.organization.name} as ${input.role}. Accept this invitation within seven days: ${inviteUrl}`);
        return { invite: { id: invite.id, email: invite.email, role: invite.role, expiresAt: invite.expiresAt }, deliveryStatus: "sent" };
      } catch (error) {
        await this.prisma.organizationInvite.delete({ where: { id: invite.id } });
        throw error;
      }
    }
    return { invite: { id: invite.id, email: invite.email, role: invite.role, expiresAt: invite.expiresAt }, deliveryStatus: "not_configured", inviteUrl };
  }

  async listInvites(auth: AuthContext, organizationId: string) {
    this.requireActiveOrganization(auth, organizationId);
    return this.prisma.organizationInvite.findMany({
      where: { organizationId, acceptedAt: null, expiresAt: { gt: new Date() }, ...(auth.branchId ? { branchId: auth.branchId } : {}) },
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, role: true, createdAt: true, expiresAt: true, branch: { select: { id: true, name: true } }, invitedBy: { select: { fullName: true } } },
    });
  }

  async revokeInvite(auth: AuthContext, organizationId: string, inviteId: string) {
    this.requireActiveOrganization(auth, organizationId);
    const result = await this.prisma.organizationInvite.deleteMany({ where: { id: inviteId, organizationId, acceptedAt: null } });
    if (!result.count) throw new NotFoundException("Invitation not found.");
    return { status: "revoked" };
  }

  async acceptInvite(auth: AuthContext, token: string) {
    const invite = await this.prisma.organizationInvite.findUnique({
      where: { tokenHash: hash(token) },
      select: { id: true, organizationId: true, branchId: true, invitedByUserId: true, email: true, role: true, expiresAt: true, acceptedAt: true, organization: { select: { name: true, deletedAt: true } } },
    });
    if (!invite || invite.acceptedAt || invite.expiresAt <= new Date() || invite.organization.deletedAt) throw new BadRequestException("This invitation is invalid or expired.");
    const user = await this.prisma.user.findUnique({ where: { id: auth.userId }, select: { email: true } });
    if (user?.email.toLowerCase() !== invite.email.toLowerCase()) throw new ForbiddenException("Sign in with the email address this invitation was sent to.");
    try {
      await this.prisma.$transaction(async (tx) => {
        const claimed = await tx.organizationInvite.updateMany({ where: { id: invite.id, acceptedAt: null, expiresAt: { gt: new Date() } }, data: { acceptedAt: new Date(), acceptedByUserId: auth.userId } });
        if (claimed.count !== 1) throw new BadRequestException("This invitation is invalid or expired.");
        await tx.organizationMember.upsert({
          where: { organizationId_userId: { organizationId: invite.organizationId, userId: auth.userId } },
          create: { organizationId: invite.organizationId, userId: auth.userId, role: invite.role, branchId: invite.branchId, status: "ACTIVE", joinedAt: new Date() },
          update: { role: invite.role, branchId: invite.branchId, status: "ACTIVE", joinedAt: new Date() },
        });
        await tx.auditLog.create({ data: { organizationId: invite.organizationId, actorUserId: auth.userId, action: "organization.invite_accepted", resourceType: "invite", resourceId: invite.id, metadata: { role: invite.role } } });
      });
    } catch (error) {
      if ((error as { code?: string })?.code === "P2002") throw new ConflictException("You are already a member of this organization.");
      throw error;
    }
    return { status: "accepted", organizationId: invite.organizationId, organizationName: invite.organization.name };
  }
}
