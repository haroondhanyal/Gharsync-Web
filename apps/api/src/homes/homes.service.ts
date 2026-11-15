import { randomUUID } from "node:crypto";
import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "../generated/prisma/client.js";
import { PropertyType } from "../generated/prisma/enums.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type { AuthContext } from "../auth/auth-context.js";
import type { z } from "zod";
import type { assetCreateSchema, assetUpdateSchema, propertyCreateSchema, propertyUpdateSchema } from "@gharsync/validation";

@Injectable()
export class HomesService {
  constructor(private readonly prisma: PrismaService) {}

  private scope(auth: AuthContext) {
    if (!auth.organizationId) throw new ForbiddenException("Select an organization first.");
    return { organizationId: auth.organizationId, ...(auth.branchId ? { customer: { branchId: auth.branchId } } : {}) };
  }

  listProperties(auth: AuthContext, customerId?: string) {
    return this.prisma.property.findMany({
      where: { ...this.scope(auth), ...(customerId ? { customerId } : {}), deletedAt: null },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      select: { id: true, customerId: true, name: true, propertyType: true, address: true, city: true, ownership: true, notes: true, latitude: true, longitude: true, createdAt: true, customer: { select: { id: true, fullName: true, phone: true } }, _count: { select: { assets: true } } },
    });
  }

  async getProperty(auth: AuthContext, propertyId: string) {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, ...this.scope(auth), deletedAt: null },
      select: { id: true, customerId: true, name: true, propertyType: true, address: true, city: true, ownership: true, notes: true, latitude: true, longitude: true, createdAt: true, customer: { select: { id: true, fullName: true, phone: true, email: true } }, assets: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, select: { id: true, category: true, brand: true, model: true, serialNumber: true, qrCode: true, purchasedAt: true, installedAt: true, warrantyStartsAt: true, warrantyEndsAt: true, purchasePrice: true, seller: true, createdAt: true, _count: { select: { bookings: true, documents: true } } } }, documents: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, select: { id: true, fileName: true, mimeType: true, sizeBytes: true, createdAt: true } } },
    });
    if (!property) throw new NotFoundException("Property not found.");
    return property;
  }

  async createProperty(auth: AuthContext, input: z.infer<typeof propertyCreateSchema>) {
    const customer = await this.prisma.customer.findFirst({ where: { id: input.customerId, organizationId: auth.organizationId!, deletedAt: null, isActive: true, ...(auth.branchId ? { branchId: auth.branchId } : {}) }, select: { id: true } });
    if (!customer) throw new NotFoundException("Customer not found in this organization.");
    return this.prisma.property.create({ data: {
      organizationId: auth.organizationId!, customerId: input.customerId, name: input.name, propertyType: input.propertyType as PropertyType,
      address: input.address, city: input.city, ownership: input.ownership, notes: input.notes,
      ...(input.latitude !== undefined ? { latitude: new Prisma.Decimal(input.latitude) } : {}),
      ...(input.longitude !== undefined ? { longitude: new Prisma.Decimal(input.longitude) } : {}),
    }, select: { id: true, customerId: true, name: true, propertyType: true, address: true, city: true, createdAt: true } });
  }

  async updateProperty(auth: AuthContext, propertyId: string, input: z.infer<typeof propertyUpdateSchema>) {
    const existing = await this.prisma.property.findFirst({ where: { id: propertyId, ...this.scope(auth), deletedAt: null }, select: { id: true } });
    if (!existing) throw new NotFoundException("Property not found.");
    return this.prisma.property.update({ where: { id: propertyId }, data: {
      ...(input.name !== undefined ? { name: input.name } : {}), ...(input.propertyType ? { propertyType: input.propertyType as PropertyType } : {}),
      ...(input.address !== undefined ? { address: input.address } : {}), ...(input.city !== undefined ? { city: input.city } : {}),
      ...(input.ownership !== undefined ? { ownership: input.ownership } : {}), ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.latitude !== undefined ? { latitude: new Prisma.Decimal(input.latitude) } : {}), ...(input.longitude !== undefined ? { longitude: new Prisma.Decimal(input.longitude) } : {}),
    }, select: { id: true, customerId: true, name: true, propertyType: true, address: true, city: true, ownership: true, notes: true, updatedAt: true } });
  }

  async archiveProperty(auth: AuthContext, propertyId: string) {
    const existing = await this.prisma.property.findFirst({ where: { id: propertyId, ...this.scope(auth), deletedAt: null }, select: { id: true } });
    if (!existing) throw new NotFoundException("Property not found.");
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.property.update({ where: { id: propertyId }, data: { deletedAt: now } }),
      this.prisma.asset.updateMany({ where: { propertyId, deletedAt: null }, data: { deletedAt: now } }),
    ]);
    return { status: "archived" };
  }

  async listAssets(auth: AuthContext, propertyId?: string) {
    return this.prisma.asset.findMany({ where: { organizationId: auth.organizationId!, ...(auth.branchId ? { property: { customer: { branchId: auth.branchId } } } : {}), ...(propertyId ? { propertyId } : {}), deletedAt: null }, orderBy: [{ createdAt: "desc" }, { id: "asc" }], select: { id: true, propertyId: true, category: true, brand: true, model: true, serialNumber: true, qrCode: true, purchasedAt: true, installedAt: true, warrantyStartsAt: true, warrantyEndsAt: true, createdAt: true, property: { select: { id: true, name: true, city: true, customer: { select: { id: true, fullName: true } } } }, _count: { select: { bookings: true, documents: true } } } });
  }

  async expiringWarranties(auth: AuthContext, days = 60) {
    const now = new Date();
    const cutoff = new Date(now.getTime() + Math.min(Math.max(days, 1), 180) * 24 * 60 * 60_000);
    return this.prisma.asset.findMany({ where: { organizationId: auth.organizationId!, deletedAt: null, warrantyEndsAt: { gte: now, lte: cutoff }, ...(auth.branchId ? { property: { customer: { branchId: auth.branchId } } } : {}) }, orderBy: { warrantyEndsAt: "asc" }, select: { id: true, category: true, brand: true, model: true, serialNumber: true, warrantyStartsAt: true, warrantyEndsAt: true, property: { select: { id: true, name: true, city: true } } } });
  }

  async getAsset(auth: AuthContext, assetId: string) {
    const asset = await this.prisma.asset.findFirst({ where: { id: assetId, organizationId: auth.organizationId!, ...(auth.branchId ? { property: { customer: { branchId: auth.branchId } } } : {}), deletedAt: null }, select: { id: true, organizationId: true, propertyId: true, category: true, brand: true, model: true, serialNumber: true, qrCode: true, purchasedAt: true, installedAt: true, warrantyStartsAt: true, warrantyEndsAt: true, purchasePrice: true, seller: true, createdAt: true, property: { select: { id: true, name: true, address: true, city: true, customer: { select: { id: true, fullName: true, phone: true } } } }, bookings: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 50, select: { id: true, status: true, urgency: true, description: true, createdAt: true, scheduledAt: true, service: { select: { name: true } } } }, documents: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, select: { id: true, fileName: true, mimeType: true, sizeBytes: true, createdAt: true } } } });
    if (!asset) throw new NotFoundException("Asset not found.");
    const { organizationId: _organizationId, qrCode: _qrCode, ...safeAsset } = asset;
    return safeAsset;
  }

  async createAsset(auth: AuthContext, input: z.infer<typeof assetCreateSchema>) {
    const property = await this.prisma.property.findFirst({ where: { id: input.propertyId, organizationId: auth.organizationId!, deletedAt: null, ...(auth.branchId ? { customer: { branchId: auth.branchId } } : {}) }, select: { id: true } });
    if (!property) throw new NotFoundException("Property not found in this organization.");
    try {
      return await this.prisma.asset.create({ data: {
        organizationId: auth.organizationId!, propertyId: input.propertyId, category: input.category, brand: input.brand, model: input.model, serialNumber: input.serialNumber || null,
        ...(input.purchasedAt ? { purchasedAt: new Date(input.purchasedAt) } : {}), ...(input.installedAt ? { installedAt: new Date(input.installedAt) } : {}),
        ...(input.warrantyStartsAt ? { warrantyStartsAt: new Date(input.warrantyStartsAt) } : {}), ...(input.warrantyEndsAt ? { warrantyEndsAt: new Date(input.warrantyEndsAt) } : {}),
        ...(input.purchasePrice !== undefined ? { purchasePrice: new Prisma.Decimal(input.purchasePrice) } : {}), seller: input.seller,
      }, select: { id: true, propertyId: true, category: true, brand: true, model: true, serialNumber: true, qrCode: true, purchasedAt: true, installedAt: true, warrantyStartsAt: true, warrantyEndsAt: true, createdAt: true } });
    } catch (error) {
      if ((error as { code?: string })?.code === "P2002") throw new ConflictException("An asset with this serial number already exists in the organization.");
      throw error;
    }
  }

  async updateAsset(auth: AuthContext, assetId: string, input: z.infer<typeof assetUpdateSchema>) {
    const asset = await this.prisma.asset.findFirst({ where: { id: assetId, organizationId: auth.organizationId!, ...(auth.branchId ? { property: { customer: { branchId: auth.branchId } } } : {}), deletedAt: null }, select: { id: true } });
    if (!asset) throw new NotFoundException("Asset not found.");
    try {
      return await this.prisma.asset.update({ where: { id: assetId }, data: {
        ...(input.category !== undefined ? { category: input.category } : {}), ...(input.brand !== undefined ? { brand: input.brand } : {}), ...(input.model !== undefined ? { model: input.model } : {}), ...(input.serialNumber !== undefined ? { serialNumber: input.serialNumber || null } : {}),
        ...(input.purchasedAt !== undefined ? { purchasedAt: input.purchasedAt ? new Date(input.purchasedAt) : null } : {}), ...(input.installedAt !== undefined ? { installedAt: input.installedAt ? new Date(input.installedAt) : null } : {}),
        ...(input.warrantyStartsAt !== undefined ? { warrantyStartsAt: input.warrantyStartsAt ? new Date(input.warrantyStartsAt) : null } : {}), ...(input.warrantyEndsAt !== undefined ? { warrantyEndsAt: input.warrantyEndsAt ? new Date(input.warrantyEndsAt) : null } : {}),
        ...(input.purchasePrice !== undefined ? { purchasePrice: new Prisma.Decimal(input.purchasePrice) } : {}), ...(input.seller !== undefined ? { seller: input.seller } : {}),
      }, select: { id: true, propertyId: true, category: true, brand: true, model: true, serialNumber: true, purchasedAt: true, installedAt: true, warrantyStartsAt: true, warrantyEndsAt: true, purchasePrice: true, seller: true, updatedAt: true } });
    } catch (error) {
      if ((error as { code?: string })?.code === "P2002") throw new ConflictException("An asset with this serial number already exists in the organization.");
      throw error;
    }
  }

  async archiveAsset(auth: AuthContext, assetId: string) {
    const existing = await this.prisma.asset.findFirst({ where: { id: assetId, organizationId: auth.organizationId!, ...(auth.branchId ? { property: { customer: { branchId: auth.branchId } } } : {}), deletedAt: null }, select: { id: true } });
    if (!existing) throw new NotFoundException("Asset not found.");
    await this.prisma.asset.update({ where: { id: assetId }, data: { deletedAt: new Date() } });
    return { status: "archived" };
  }

  async assetByQr(auth: AuthContext, qrCode: string) {
    const asset = await this.prisma.asset.findFirst({ where: { qrCode, organizationId: auth.organizationId!, ...(auth.branchId ? { property: { customer: { branchId: auth.branchId } } } : {}), deletedAt: null }, select: { id: true } });
    if (!asset) throw new NotFoundException("This QR code is not available in the selected organization.");
    return this.getAsset(auth, asset.id);
  }

  async rotateQr(auth: AuthContext, assetId: string) {
    const asset = await this.prisma.asset.findFirst({ where: { id: assetId, organizationId: auth.organizationId!, ...(auth.branchId ? { property: { customer: { branchId: auth.branchId } } } : {}), deletedAt: null }, select: { id: true } });
    if (!asset) throw new NotFoundException("Asset not found.");
    return this.prisma.asset.update({ where: { id: assetId }, data: { qrCode: randomUUID() }, select: { id: true, qrCode: true } });
  }

  async getQrCode(auth: AuthContext, assetId: string) {
    const asset = await this.prisma.asset.findFirst({ where: { id: assetId, organizationId: auth.organizationId!, ...(auth.branchId ? { property: { customer: { branchId: auth.branchId } } } : {}), deletedAt: null }, select: { qrCode: true } });
    if (!asset) throw new NotFoundException("Asset not found.");
    return asset.qrCode;
  }
}
