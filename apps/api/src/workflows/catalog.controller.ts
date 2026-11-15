import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { serviceCreateSchema, serviceUpdateSchema } from "@gharsync/validation";
import { CurrentAuth, RequirePermission, type AuthContext } from "../auth/auth-context.js";
import { OrganizationAccessGuard } from "../auth/organization-access.guard.js";
import { WorkflowsService } from "./workflows.service.js";

@Controller("services")
@UseGuards(OrganizationAccessGuard)
export class CatalogController {
  constructor(private readonly workflows: WorkflowsService) {}

  @Get()
  @RequirePermission("services.read")
  list(@CurrentAuth() auth: AuthContext, @Query("includeInactive") includeInactive?: string) { return this.workflows.listServices(auth, includeInactive === "true"); }

  @Post()
  @RequirePermission("services.manage")
  create(@CurrentAuth() auth: AuthContext, @Body({ schema: serviceCreateSchema }) body: z.infer<typeof serviceCreateSchema>) { return this.workflows.createService(auth, body); }

  @Patch(":serviceId")
  @RequirePermission("services.manage")
  update(@CurrentAuth() auth: AuthContext, @Param("serviceId", { schema: z.uuid() }) id: string, @Body({ schema: serviceUpdateSchema }) body: z.infer<typeof serviceUpdateSchema>) { return this.workflows.updateService(auth, id, body); }
}
