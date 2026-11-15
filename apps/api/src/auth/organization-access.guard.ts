import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PrismaService } from "../prisma/prisma.service.js";
import { REQUIRED_PERMISSION, type AuthContext } from "./auth-context.js";

@Injectable()
export class OrganizationAccessGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext) {
    const auth = context.switchToHttp().getRequest<{ auth?: AuthContext }>().auth;
    if (!auth?.organizationId || !auth.role) throw new ForbiddenException("Select an organization to continue.");
    const permission = this.reflector.getAllAndOverride<string>(REQUIRED_PERMISSION, [context.getHandler(), context.getClass()]);
    if (!permission) return true;
    const allowed = await this.prisma.rolePermission.findFirst({
      where: { role: auth.role, permission: { key: permission } },
      select: { id: true },
    });
    if (!allowed) throw new ForbiddenException("You do not have permission to perform this action.");
    return true;
  }
}
