import { Body, Controller, Delete, Get, Header, HttpCode, Param, Patch, Post, Res, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import type { Response } from "express";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { z } from "zod";
import {
  branchCreateSchema, inviteAcceptSchema, inviteCreateSchema, memberUpdateSchema, organizationCreateSchema,
} from "@gharsync/validation";
import { OrganizationRole } from "../generated/prisma/enums.js";
import { CurrentAuth, RequirePermission, type AuthContext } from "../auth/auth-context.js";
import { OrganizationAccessGuard } from "../auth/organization-access.guard.js";
import { OrganizationsService } from "./organizations.service.js";

@Controller("organizations")
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Post()
  create(@CurrentAuth() auth: AuthContext, @Body({ schema: organizationCreateSchema }) body: z.infer<typeof organizationCreateSchema>) {
    return this.organizations.create(auth.userId, body);
  }

  @Get("branches")
  @UseGuards(OrganizationAccessGuard)
  @RequirePermission("dashboard.read")
  branches(@CurrentAuth() auth: AuthContext) {
    return this.organizations.branches(auth);
  }

  @Post("branches")
  @UseGuards(OrganizationAccessGuard)
  @RequirePermission("organization.manage")
  createBranch(@CurrentAuth() auth: AuthContext, @Body({ schema: branchCreateSchema }) body: z.infer<typeof branchCreateSchema>) {
    return this.organizations.createBranch(auth, body);
  }

  @Post("branches/:branchId/photo")
  @UseGuards(OrganizationAccessGuard)
  @RequirePermission("organization.manage")
  @UseInterceptors(FileInterceptor("photo", { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } }))
  uploadBranchPhoto(@CurrentAuth() auth: AuthContext, @Param("branchId", { schema: z.uuid() }) branchId: string, @UploadedFile() file: Express.Multer.File | undefined) {
    return this.organizations.uploadBranchPhoto(auth, branchId, file);
  }

  @Get("branches/:branchId/photo")
  @UseGuards(OrganizationAccessGuard)
  @RequirePermission("dashboard.read")
  @Header("Cache-Control", "private, no-store")
  async branchPhoto(@CurrentAuth() auth: AuthContext, @Param("branchId", { schema: z.uuid() }) branchId: string, @Res() response: Response) {
    const image = await this.organizations.branchPhoto(auth, branchId);
    response.setHeader("Content-Type", image.mimeType); response.setHeader("X-Content-Type-Options", "nosniff"); response.setHeader("Cache-Control", "private, no-store");
    return response.end(image.buffer);
  }

  @Delete("branches/:branchId/photo")
  @UseGuards(OrganizationAccessGuard)
  @RequirePermission("organization.manage")
  removeBranchPhoto(@CurrentAuth() auth: AuthContext, @Param("branchId", { schema: z.uuid() }) branchId: string) { return this.organizations.removeBranchPhoto(auth, branchId); }

  @Get(":organizationId/members")
  @UseGuards(OrganizationAccessGuard)
  @RequirePermission("members.manage")
  members(@CurrentAuth() auth: AuthContext, @Param("organizationId", { schema: z.uuid() }) organizationId: string) {
    return this.organizations.members(auth, organizationId);
  }

  @Patch(":organizationId/members/:memberId")
  @UseGuards(OrganizationAccessGuard)
  @RequirePermission("members.manage")
  updateMember(
    @CurrentAuth() auth: AuthContext,
    @Param("organizationId", { schema: z.uuid() }) organizationId: string,
    @Param("memberId", { schema: z.uuid() }) memberId: string,
    @Body({ schema: memberUpdateSchema }) body: z.infer<typeof memberUpdateSchema>,
  ) {
    return this.organizations.updateMember(auth, organizationId, memberId, {
      ...(body.role ? { role: OrganizationRole[body.role] } : {}),
      ...(body.branchId !== undefined ? { branchId: body.branchId } : {}),
    });
  }

  @Delete(":organizationId/members/:memberId")
  @UseGuards(OrganizationAccessGuard)
  @RequirePermission("members.manage")
  suspendMember(
    @CurrentAuth() auth: AuthContext,
    @Param("organizationId", { schema: z.uuid() }) organizationId: string,
    @Param("memberId", { schema: z.uuid() }) memberId: string,
  ) {
    return this.organizations.suspendMember(auth, organizationId, memberId);
  }

  @Post(":organizationId/invites")
  @UseGuards(OrganizationAccessGuard)
  @RequirePermission("members.manage")
  createInvite(
    @CurrentAuth() auth: AuthContext,
    @Param("organizationId", { schema: z.uuid() }) organizationId: string,
    @Body({ schema: inviteCreateSchema }) body: z.infer<typeof inviteCreateSchema>,
  ) {
    return this.organizations.createInvite(auth, organizationId, {
      email: body.email, role: OrganizationRole[body.role], ...(body.branchId ? { branchId: body.branchId } : {}),
    });
  }

  @Get(":organizationId/invites")
  @UseGuards(OrganizationAccessGuard)
  @RequirePermission("members.manage")
  invites(@CurrentAuth() auth: AuthContext, @Param("organizationId", { schema: z.uuid() }) organizationId: string) {
    return this.organizations.listInvites(auth, organizationId);
  }

  @Delete(":organizationId/invites/:inviteId")
  @UseGuards(OrganizationAccessGuard)
  @RequirePermission("members.manage")
  revokeInvite(
    @CurrentAuth() auth: AuthContext,
    @Param("organizationId", { schema: z.uuid() }) organizationId: string,
    @Param("inviteId", { schema: z.uuid() }) inviteId: string,
  ) {
    return this.organizations.revokeInvite(auth, organizationId, inviteId);
  }

  @Post("invites/accept")
  @HttpCode(200)
  acceptInvite(@CurrentAuth() auth: AuthContext, @Body({ schema: inviteAcceptSchema }) body: z.infer<typeof inviteAcceptSchema>) {
    return this.organizations.acceptInvite(auth, body.token);
  }
}
