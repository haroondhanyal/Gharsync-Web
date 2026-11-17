import { Body, Controller, Delete, Get, Header, Param, Patch, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
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

  @Post(":customerId/photo")
  @RequirePermission("customers.update")
  @UseInterceptors(FileInterceptor("photo", { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } }))
  uploadPhoto(@CurrentAuth() auth: AuthContext, @Param("customerId", { schema: z.uuid() }) id: string, @UploadedFile() file: Express.Multer.File | undefined) {
    return this.customers.uploadCustomerPhoto(auth, id, file);
  }

  @Get(":customerId/photo")
  @RequirePermission("customers.read")
  @Header("Cache-Control", "private, no-store")
  async customerPhoto(@CurrentAuth() auth: AuthContext, @Param("customerId", { schema: z.uuid() }) id: string, @Res() response: Response) {
    const image = await this.customers.customerPhoto(auth, id);
    response.setHeader("Content-Type", image.mimeType); response.setHeader("X-Content-Type-Options", "nosniff"); response.setHeader("Cache-Control", "private, no-store");
    return response.end(image.buffer);
  }

  @Delete(":customerId/photo")
  @RequirePermission("customers.update")
  removePhoto(@CurrentAuth() auth: AuthContext, @Param("customerId", { schema: z.uuid() }) id: string) { return this.customers.removeCustomerPhoto(auth, id); }

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
