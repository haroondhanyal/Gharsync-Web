import { createParamDecorator, ExecutionContext, SetMetadata } from "@nestjs/common";
import type { OrganizationRole } from "../generated/prisma/enums.js";

export const IS_PUBLIC = "gharsync:is-public";
export const ALLOW_UNVERIFIED = "gharsync:allow-unverified";
export const REQUIRED_PERMISSION = "gharsync:required-permission";

export interface AuthContext {
  userId: string;
  sessionId: string;
  organizationId: string | null;
  branchId: string | null;
  role: OrganizationRole | null;
  phoneVerified: boolean;
  email: string;
  fullName: string;
}

export const Public = () => SetMetadata(IS_PUBLIC, true);
export const AllowUnverified = () => SetMetadata(ALLOW_UNVERIFIED, true);
export const RequirePermission = (permission: string) => SetMetadata(REQUIRED_PERMISSION, permission);

export const CurrentAuth = createParamDecorator((_data: unknown, context: ExecutionContext): AuthContext => {
  const request = context.switchToHttp().getRequest<{ auth: AuthContext }>();
  return request.auth;
});
