import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { PrismaService } from "../prisma/prisma.service.js";
import { authSecret } from "./auth-secrets.js";
import { ALLOW_UNVERIFIED, IS_PUBLIC, type AuthContext } from "./auth-context.js";

interface TokenClaims {
  sub: string;
  sid: string;
  orgId: string | null;
  use: "access";
}

function cookieValue(header: string | undefined, name: string): string | undefined {
  const part = header?.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${name}=`));
  if (!part) return undefined;
  try { return decodeURIComponent(part.slice(name.length + 1)); } catch { return undefined; }
}

export function readAccessToken(request: Request) {
  const bearer = request.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  return bearer ?? cookieValue(request.headers.cookie, "__Host-gs-access");
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()]);
    if (isPublic) return true;
    const request = context.switchToHttp().getRequest<Request & { auth?: AuthContext }>();
    const token = readAccessToken(request);
    if (!token) throw new UnauthorizedException();
    let claims: TokenClaims;
    try {
      claims = await this.jwt.verifyAsync<TokenClaims>(token, {
        secret: authSecret(this.config, "JWT_ACCESS_SECRET"),
        issuer: "gharsync-api",
        audience: "gharsync-web",
      });
    } catch {
      throw new UnauthorizedException();
    }
    if (claims.use !== "access" || !claims.sub || !claims.sid) throw new UnauthorizedException();
    const session = await this.prisma.refreshSession.findUnique({
      where: { id: claims.sid },
      include: { user: { select: { id: true, email: true, fullName: true, phoneVerifiedAt: true, deletedAt: true } } },
    });
    if (!session || session.revokedAt || session.expiresAt <= new Date() || session.user.deletedAt || session.user.id !== claims.sub) {
      throw new UnauthorizedException();
    }
    if (session.organizationId !== claims.orgId) throw new UnauthorizedException();
    let role: AuthContext["role"] = null;
    let branchId: string | null = null;
    if (session.organizationId) {
      const membership = await this.prisma.organizationMember.findFirst({
        where: { organizationId: session.organizationId, userId: session.userId, status: "ACTIVE" },
        select: { role: true, branchId: true },
      });
      if (!membership) throw new UnauthorizedException("You no longer have access to this organization.");
      role = membership.role;
      branchId = membership.branchId;
    }
    const phoneVerified = Boolean(session.user.phoneVerifiedAt);
    const allowUnverified = this.reflector.getAllAndOverride<boolean>(ALLOW_UNVERIFIED, [context.getHandler(), context.getClass()]);
    if (!phoneVerified && !allowUnverified) throw new UnauthorizedException("Verify your phone number to continue.");
    request.auth = {
      userId: session.userId,
      sessionId: session.id,
      organizationId: session.organizationId,
      branchId,
      role,
      phoneVerified,
      email: session.user.email,
      fullName: session.user.fullName,
    };
    return true;
  }
}
