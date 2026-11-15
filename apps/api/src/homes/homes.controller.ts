import { Body, Controller, Delete, Get, Header, Param, Patch, Post, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import QRCode from "qrcode";
import { z } from "zod";
import { assetCreateSchema, assetUpdateSchema, propertyCreateSchema, propertyUpdateSchema } from "@gharsync/validation";
import { CurrentAuth, RequirePermission, type AuthContext } from "../auth/auth-context.js";
import { OrganizationAccessGuard } from "../auth/organization-access.guard.js";
import { HomesService } from "./homes.service.js";

@Controller()
@UseGuards(OrganizationAccessGuard)
export class HomesController {
  constructor(private readonly homes: HomesService) {}

  @Get("properties")
  @RequirePermission("properties.read")
  properties(@CurrentAuth() auth: AuthContext, @Query("customerId", { schema: z.uuid().optional() }) customerId?: string) { return this.homes.listProperties(auth, customerId); }

  @Post("properties")
  @RequirePermission("properties.manage")
  createProperty(@CurrentAuth() auth: AuthContext, @Body({ schema: propertyCreateSchema }) body: z.infer<typeof propertyCreateSchema>) { return this.homes.createProperty(auth, body); }

  @Get("properties/:propertyId")
  @RequirePermission("properties.read")
  property(@CurrentAuth() auth: AuthContext, @Param("propertyId", { schema: z.uuid() }) id: string) { return this.homes.getProperty(auth, id); }

  @Patch("properties/:propertyId")
  @RequirePermission("properties.manage")
  updateProperty(@CurrentAuth() auth: AuthContext, @Param("propertyId", { schema: z.uuid() }) id: string, @Body({ schema: propertyUpdateSchema }) body: z.infer<typeof propertyUpdateSchema>) { return this.homes.updateProperty(auth, id, body); }

  @Delete("properties/:propertyId")
  @RequirePermission("properties.manage")
  archiveProperty(@CurrentAuth() auth: AuthContext, @Param("propertyId", { schema: z.uuid() }) id: string) { return this.homes.archiveProperty(auth, id); }

  @Get("assets")
  @RequirePermission("properties.read")
  assets(@CurrentAuth() auth: AuthContext, @Query("propertyId", { schema: z.uuid().optional() }) propertyId?: string) { return this.homes.listAssets(auth, propertyId); }

  @Post("assets")
  @RequirePermission("properties.manage")
  createAsset(@CurrentAuth() auth: AuthContext, @Body({ schema: assetCreateSchema }) body: z.infer<typeof assetCreateSchema>) { return this.homes.createAsset(auth, body); }

  @Get("assets/qr/:qrCode")
  @RequirePermission("properties.read")
  assetByQr(@CurrentAuth() auth: AuthContext, @Param("qrCode") qrCode: string) { return this.homes.assetByQr(auth, qrCode); }

  @Get("assets/:assetId/qr.svg")
  @RequirePermission("properties.read")
  @Header("Content-Type", "image/svg+xml")
  async qr(@CurrentAuth() auth: AuthContext, @Param("assetId", { schema: z.uuid() }) id: string, @Res({ passthrough: true }) response: Response) {
    const qrCode = await this.homes.getQrCode(auth, id);
    const appUrl = process.env.APP_URL ?? "http://localhost:3000";
    const value = `${appUrl}/assets/scan?code=${encodeURIComponent(qrCode)}`;
    response.setHeader("Cache-Control", "private, no-store");
    return QRCode.toString(value, { type: "svg", errorCorrectionLevel: "M", margin: 2, color: { dark: "#173f35", light: "#ffffff" } });
  }

  @Post("assets/:assetId/qr/rotate")
  @RequirePermission("properties.manage")
  rotateQr(@CurrentAuth() auth: AuthContext, @Param("assetId", { schema: z.uuid() }) id: string) { return this.homes.rotateQr(auth, id); }

  @Get("assets/:assetId")
  @RequirePermission("properties.read")
  asset(@CurrentAuth() auth: AuthContext, @Param("assetId", { schema: z.uuid() }) id: string) { return this.homes.getAsset(auth, id); }

  @Patch("assets/:assetId")
  @RequirePermission("properties.manage")
  updateAsset(@CurrentAuth() auth: AuthContext, @Param("assetId", { schema: z.uuid() }) id: string, @Body({ schema: assetUpdateSchema }) body: z.infer<typeof assetUpdateSchema>) { return this.homes.updateAsset(auth, id, body); }

  @Delete("assets/:assetId")
  @RequirePermission("properties.manage")
  archiveAsset(@CurrentAuth() auth: AuthContext, @Param("assetId", { schema: z.uuid() }) id: string) { return this.homes.archiveAsset(auth, id); }
}
