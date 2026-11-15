import { Body, Controller, Delete, Get, Header, Param, Patch, Post, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { z } from "zod";
import { customerCreateSchema, customerQuerySchema, customerUpdateSchema } from "@gharsync/validation";
import { CurrentAuth, RequirePermission, type AuthContext } from "../auth/auth-context.js";
import { OrganizationAccessGuard } from "../auth/organization-access.guard.js";
import { CustomersService } from "./customers.service.js";

@Controller("customers")
@UseGuards(OrganizationAccessGuard)
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get("export.csv")
  @RequirePermission("customers.read")
  @Header("Content-Type", "text/csv; charset=utf-8")
  async exportCsv(@CurrentAuth() auth: AuthContext, @Res({ passthrough: true }) response: Response) {
    const result = await this.customers.exportCsv(auth);
    response.setHeader("Content-Disposition", 'attachment; filename="gharsync-customers.csv"');
    response.setHeader("X-Exported-Rows", String(result.exported));
    if (result.truncated) response.setHeader("X-Export-Truncated", "true");
    return result.csv;
  }

  @Get()
  @RequirePermission("customers.read")
  list(@CurrentAuth() auth: AuthContext, @Query({ schema: customerQuerySchema }) query: z.infer<typeof customerQuerySchema>) {
    return this.customers.list(auth, query);
  }

  @Post()
  @RequirePermission("customers.create")
  create(@CurrentAuth() auth: AuthContext, @Body({ schema: customerCreateSchema }) body: z.infer<typeof customerCreateSchema>) {
    return this.customers.create(auth, body);
  }

  @Get(":customerId")
  @RequirePermission("customers.read")
  get(@CurrentAuth() auth: AuthContext, @Param("customerId", { schema: z.uuid() }) customerId: string) {
    return this.customers.get(auth, customerId);
  }

  @Patch(":customerId")
  @RequirePermission("customers.update")
  update(
    @CurrentAuth() auth: AuthContext,
    @Param("customerId", { schema: z.uuid() }) customerId: string,
    @Body({ schema: customerUpdateSchema }) body: z.infer<typeof customerUpdateSchema>,
  ) {
    return this.customers.update(auth, customerId, body);
  }

  @Delete(":customerId")
  @RequirePermission("customers.delete")
  archive(@CurrentAuth() auth: AuthContext, @Param("customerId", { schema: z.uuid() }) customerId: string) {
    return this.customers.archive(auth, customerId);
  }
}
