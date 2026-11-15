import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { Prisma } from "../generated/prisma/client.js";
import { BookingStatus, MemberStatus, OrganizationRole, StockMovementType, TimeOffStatus, WarrantyClaimStatus } from "../generated/prisma/enums.js";
import type { z } from "zod";
import type { inventoryProductCreateSchema, stockMovementSchema, supplierCreateSchema, technicianAvailabilitySchema, technicianProfileSchema, technicianTimeOffSchema, timeOffDecisionSchema, warrantyClaimCreateSchema, warrantyClaimUpdateSchema } from "@gharsync/validation";
import type { AuthContext } from "../auth/auth-context.js";
import { PrismaService } from "../prisma/prisma.service.js";

const money = (value: number | Prisma.Decimal | string) => new Prisma.Decimal(value);

@Injectable()
export class OperationsService {
  constructor(private readonly prisma: PrismaService) {}

  private org(auth: AuthContext) { if (!auth.organizationId) throw new ForbiddenException("Select an organization first."); return auth.organizationId; }
  private branchWhere(auth: AuthContext) { return auth.branchId ? { branchId: auth.branchId } : {}; }
  private async audit(auth: AuthContext, action: string, resourceType: string, resourceId: string, metadata?: object) {
    await this.prisma.auditLog.create({ data: { organizationId: auth.organizationId, actorUserId: auth.userId, action, resourceType, resourceId, ...(metadata ? { metadata } : {}) } });
  }

  async technicians(auth: AuthContext) {
    const organizationId = this.org(auth);
    const rows = await this.prisma.organizationMember.findMany({ where: { organizationId, role: OrganizationRole.TECHNICIAN, status: MemberStatus.ACTIVE, ...this.branchWhere(auth) }, orderBy: { user: { fullName: "asc" } }, select: { id: true, branchId: true, branch: { select: { name: true } }, user: { select: { id: true, fullName: true, phone: true, email: true } }, technicianProfile: { select: { id: true, skills: true, employmentType: true, hourlyRate: true, bio: true, isAvailable: true, availability: { orderBy: { weekday: "asc" } }, timeOff: { where: { status: { in: [TimeOffStatus.PENDING, TimeOffStatus.APPROVED] }, endsAt: { gte: new Date() } }, orderBy: { startsAt: "asc" }, select: { id: true, startsAt: true, endsAt: true, status: true, reason: true } } } }, _count: { select: { assignedBookings: { where: { deletedAt: null, status: { in: ["ASSIGNED", "SCHEDULED", "TECHNICIAN_EN_ROUTE", "IN_PROGRESS"] } } } } } } });
    return Promise.all(rows.map(async (row) => ({ ...row, completedJobs: await this.prisma.booking.count({ where: { organizationId, assignedMemberId: row.id, deletedAt: null, status: BookingStatus.COMPLETED } }) })));
  }

  async upsertMyProfile(auth: AuthContext, input: z.infer<typeof technicianProfileSchema>) {
    const organizationId = this.org(auth);
    const member = await this.prisma.organizationMember.findFirst({ where: { organizationId, userId: auth.userId, role: OrganizationRole.TECHNICIAN, status: MemberStatus.ACTIVE }, select: { id: true } });
    if (!member) throw new ForbiddenException("An active technician membership is required.");
    return this.upsertProfile(auth, member.id, input);
  }

  async upsertProfile(auth: AuthContext, memberId: string, input: z.infer<typeof technicianProfileSchema>) {
    const organizationId = this.org(auth);
    const member = await this.prisma.organizationMember.findFirst({ where: { id: memberId, organizationId, role: OrganizationRole.TECHNICIAN, status: MemberStatus.ACTIVE, ...this.branchWhere(auth) }, select: { id: true } });
    if (!member) throw new NotFoundException("Active technician not found in this organization or branch.");
    const profile = await this.prisma.technicianProfile.upsert({ where: { memberId }, create: { organizationId, memberId, ...input, hourlyRate: input.hourlyRate === undefined ? null : money(input.hourlyRate) }, update: { ...input, hourlyRate: input.hourlyRate === undefined ? null : money(input.hourlyRate) }, select: { id: true, memberId: true, skills: true, employmentType: true, hourlyRate: true, bio: true, isAvailable: true } });
    await this.audit(auth, "workforce.profile.updated", "technician_profile", profile.id);
    return profile;
  }

  async setAvailability(auth: AuthContext, input: z.infer<typeof technicianAvailabilitySchema>, memberId?: string) {
    const organizationId = this.org(auth);
    const member = await this.prisma.organizationMember.findFirst({ where: { ...(memberId ? { id: memberId } : { userId: auth.userId }), organizationId, role: OrganizationRole.TECHNICIAN, status: MemberStatus.ACTIVE, ...this.branchWhere(auth) }, select: { id: true } });
    if (!member) throw new NotFoundException("Active technician not found.");
    const profile = await this.prisma.technicianProfile.findUnique({ where: { memberId: member.id }, select: { id: true } });
    if (!profile) throw new ConflictException("Create a technician profile before setting availability.");
    return this.prisma.$transaction(async (tx) => {
      await tx.technicianAvailability.deleteMany({ where: { profileId: profile.id } });
      if (input.days.length) await tx.technicianAvailability.createMany({ data: input.days.map((day) => ({ profileId: profile.id, ...day })) });
      await tx.auditLog.create({ data: { organizationId, actorUserId: auth.userId, action: "workforce.availability.updated", resourceType: "technician_profile", resourceId: profile.id } });
      return tx.technicianAvailability.findMany({ where: { profileId: profile.id }, orderBy: { weekday: "asc" } });
    });
  }

  async requestTimeOff(auth: AuthContext, input: z.infer<typeof technicianTimeOffSchema>) {
    const organizationId = this.org(auth);
    const profile = await this.prisma.technicianProfile.findFirst({ where: { organizationId, member: { userId: auth.userId, status: MemberStatus.ACTIVE } }, select: { id: true } });
    if (!profile) throw new ConflictException("Create your technician profile before requesting time off.");
    const startsAt = new Date(input.startsAt); const endsAt = new Date(input.endsAt);
    if (startsAt < new Date()) throw new BadRequestException("Time-off requests must begin in the future.");
    const collision = await this.prisma.technicianTimeOff.findFirst({ where: { profileId: profile.id, status: { in: [TimeOffStatus.PENDING, TimeOffStatus.APPROVED] }, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } }, select: { id: true } });
    if (collision) throw new ConflictException("This request overlaps another pending or approved time-off period.");
    const request = await this.prisma.technicianTimeOff.create({ data: { profileId: profile.id, startsAt, endsAt, reason: input.reason }, select: { id: true, startsAt: true, endsAt: true, reason: true, status: true, createdAt: true } });
    await this.audit(auth, "workforce.time_off.requested", "time_off", request.id);
    return request;
  }

  async decideTimeOff(auth: AuthContext, requestId: string, input: z.infer<typeof timeOffDecisionSchema>) {
    const request = await this.prisma.technicianTimeOff.findFirst({ where: { id: requestId, profile: { organizationId: this.org(auth), member: this.branchWhere(auth) } }, select: { id: true, status: true } });
    if (!request) throw new NotFoundException("Time-off request not found.");
    if (request.status !== TimeOffStatus.PENDING) throw new ConflictException("Only pending requests can be reviewed.");
    const update = await this.prisma.technicianTimeOff.updateMany({ where: { id: requestId, status: TimeOffStatus.PENDING }, data: { status: input.decision, reviewedById: auth.userId } });
    if (update.count !== 1) throw new ConflictException("This request was reviewed by another user.");
    await this.audit(auth, `workforce.time_off.${input.decision.toLowerCase()}`, "time_off", requestId);
    return this.prisma.technicianTimeOff.findUniqueOrThrow({ where: { id: requestId } });
  }

  async suppliers(auth: AuthContext) { return this.prisma.supplier.findMany({ where: { organizationId: this.org(auth), isActive: true }, orderBy: { name: "asc" } }); }

  async createSupplier(auth: AuthContext, input: z.infer<typeof supplierCreateSchema>) {
    const supplier = await this.prisma.supplier.create({ data: { organizationId: this.org(auth), ...input, email: input.email || null }, select: { id: true, name: true, phone: true, email: true, address: true, isActive: true } });
    await this.audit(auth, "inventory.supplier.created", "supplier", supplier.id);
    return supplier;
  }

  async products(auth: AuthContext) {
    const products = await this.prisma.inventoryProduct.findMany({ where: { organizationId: this.org(auth), isActive: true }, orderBy: [{ category: "asc" }, { name: "asc" }], select: { id: true, sku: true, barcode: true, name: true, category: true, manufacturer: true, compatibleModels: true, description: true, unit: true, unitCost: true, sellingPrice: true, reorderLevel: true, tracksWarranty: true, warrantyDays: true, supplier: { select: { id: true, name: true } }, stocks: { where: this.branchWhere(auth), select: { id: true, branchId: true, quantity: true, reserved: true, branch: { select: { name: true } } } } } });
    return products.map((product) => ({ ...product, stocks: product.stocks.map((stock) => ({ ...stock, available: money(stock.quantity).sub(stock.reserved) })), lowStock: product.stocks.length ? product.stocks.every((stock) => money(stock.quantity).sub(stock.reserved).lte(product.reorderLevel)) : money(product.reorderLevel).gt(0) }));
  }

  async createProduct(auth: AuthContext, input: z.infer<typeof inventoryProductCreateSchema>) {
    const organizationId = this.org(auth);
    if (input.supplierId && !(await this.prisma.supplier.findFirst({ where: { id: input.supplierId, organizationId }, select: { id: true } }))) throw new BadRequestException("Supplier must belong to the active organization.");
    const product = await this.prisma.inventoryProduct.create({ data: { organizationId, ...input, unitCost: money(input.unitCost), sellingPrice: input.sellingPrice === undefined ? null : money(input.sellingPrice), reorderLevel: money(input.reorderLevel) }, select: { id: true, sku: true, barcode: true, name: true, category: true, manufacturer: true, compatibleModels: true, unit: true, unitCost: true, sellingPrice: true, reorderLevel: true, tracksWarranty: true, warrantyDays: true } });
    await this.audit(auth, "inventory.product.created", "inventory_product", product.id);
    return product;
  }

  async moveStock(auth: AuthContext, input: z.infer<typeof stockMovementSchema>) {
    const organizationId = this.org(auth);
    const branchId = input.branchId ?? auth.branchId;
    if (!branchId) throw new BadRequestException("Select a branch before recording stock movement.");
    if (auth.branchId && auth.branchId !== branchId) throw new ForbiddenException("Stock movement is restricted to your assigned branch.");
    const product = await this.prisma.inventoryProduct.findFirst({ where: { id: input.productId, organizationId, isActive: true }, select: { id: true } });
    const branch = await this.prisma.branch.findFirst({ where: { id: branchId, organizationId, deletedAt: null }, select: { id: true } });
    if (!product || !branch) throw new NotFoundException("Product or branch not found in this organization.");
    const quantity = money(input.quantity);
    if (input.bookingId) {
      const job = await this.prisma.booking.findFirst({ where: { id: input.bookingId, organizationId, deletedAt: null }, select: { id: true, branchId: true } });
      if (!job || job.branchId !== branchId) throw new BadRequestException("A stock movement can only reference a booking from the same organization and branch.");
    }
    if (input.type === "TRANSFER") {
      if (auth.branchId) throw new ForbiddenException("Only organization-wide inventory managers can transfer stock between branches.");
      const destinationId = input.destinationBranchId;
      if (!destinationId || destinationId === branchId) throw new BadRequestException("Choose a different destination branch.");
      const destination = await this.prisma.branch.findFirst({ where: { id: destinationId, organizationId, deletedAt: null }, select: { id: true } });
      if (!destination) throw new NotFoundException("Destination branch not found in this organization.");
      return this.prisma.$transaction(async (tx) => {
        for (const stockBranchId of [branchId, destinationId].sort()) await tx.inventoryStock.upsert({ where: { branchId_productId: { branchId: stockBranchId, productId: product.id } }, create: { organizationId, branchId: stockBranchId, productId: product.id, quantity: 0, reserved: 0 }, update: {} });
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "inventory_stocks" WHERE "branchId" IN (${branchId}::uuid, ${destinationId}::uuid) AND "productId" = ${product.id}::uuid ORDER BY "branchId" FOR UPDATE`);
        const source = await tx.inventoryStock.findUniqueOrThrow({ where: { branchId_productId: { branchId, productId: product.id } } });
        const target = await tx.inventoryStock.findUniqueOrThrow({ where: { branchId_productId: { branchId: destinationId, productId: product.id } } });
        if (quantity.gt(money(source.quantity).sub(source.reserved))) throw new BadRequestException("Transfer quantity exceeds available source stock.");
        const nextSource = money(source.quantity).sub(quantity); const nextTarget = money(target.quantity).add(quantity); const transferGroupId = randomUUID();
        await tx.inventoryStock.update({ where: { id: source.id }, data: { quantity: nextSource } });
        await tx.inventoryStock.update({ where: { id: target.id }, data: { quantity: nextTarget } });
        const movementData = { organizationId, productId: product.id, createdById: auth.userId, transferGroupId, reference: input.reference, notes: input.notes };
        await tx.stockMovement.createMany({ data: [{ ...movementData, branchId, type: StockMovementType.TRANSFER_OUT, quantity }, { ...movementData, branchId: destinationId, type: StockMovementType.TRANSFER_IN, quantity }] });
        await tx.auditLog.create({ data: { organizationId, actorUserId: auth.userId, action: "inventory.transferred", resourceType: "inventory_product", resourceId: product.id, metadata: { fromBranchId: branchId, toBranchId: destinationId, quantity: quantity.toString(), transferGroupId } } });
        return { transferGroupId, source: { quantity: nextSource, reserved: source.reserved, available: nextSource.sub(source.reserved) }, destination: { quantity: nextTarget, reserved: target.reserved, available: nextTarget.sub(target.reserved) } };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.inventoryStock.upsert({ where: { branchId_productId: { branchId, productId: product.id } }, create: { organizationId, branchId, productId: product.id, quantity: 0, reserved: 0 }, update: {} });
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "inventory_stocks" WHERE "branchId" = ${branchId}::uuid AND "productId" = ${product.id}::uuid FOR UPDATE`);
      const stock = await tx.inventoryStock.findUniqueOrThrow({ where: { branchId_productId: { branchId, productId: product.id } } });
      let nextQuantity = money(stock.quantity); let nextReserved = money(stock.reserved);
      switch (input.type as StockMovementType) {
        case StockMovementType.RECEIPT: nextQuantity = nextQuantity.add(quantity); break;
        case StockMovementType.ADJUSTMENT: nextQuantity = nextQuantity.add(quantity); break;
        case StockMovementType.RESERVATION:
          if (quantity.gt(nextQuantity.sub(nextReserved))) throw new BadRequestException("Cannot reserve more than available stock.");
          nextReserved = nextReserved.add(quantity); break;
        case StockMovementType.RELEASE:
          if (quantity.gt(nextReserved)) throw new BadRequestException("Cannot release more than reserved stock.");
          nextReserved = nextReserved.sub(quantity); break;
        case StockMovementType.CONSUMPTION:
          if (quantity.gt(nextQuantity.sub(nextReserved))) throw new BadRequestException("Cannot consume stock that is unavailable or reserved.");
          nextQuantity = nextQuantity.sub(quantity); break;
      }
      if (nextQuantity.lt(0) || nextReserved.lt(0) || nextReserved.gt(nextQuantity)) throw new BadRequestException("This movement would create negative or over-reserved stock.");
      await tx.inventoryStock.update({ where: { id: stock.id }, data: { quantity: nextQuantity, reserved: nextReserved } });
      const movement = await tx.stockMovement.create({ data: { organizationId, branchId, productId: product.id, bookingId: input.bookingId, createdById: auth.userId, type: input.type as StockMovementType, quantity, unitCost: input.unitCost === undefined ? null : money(input.unitCost), reference: input.reference, notes: input.notes }, select: { id: true, type: true, quantity: true, reference: true, notes: true, createdAt: true, branch: { select: { name: true } }, product: { select: { name: true, sku: true } } } });
      await tx.auditLog.create({ data: { organizationId, actorUserId: auth.userId, action: `inventory.${input.type.toLowerCase()}`, resourceType: "stock_movement", resourceId: movement.id, metadata: { productId: product.id, branchId, quantity: quantity.toString() } } });
      return { ...movement, stock: { quantity: nextQuantity, reserved: nextReserved, available: nextQuantity.sub(nextReserved) } };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async movements(auth: AuthContext) {
    return this.prisma.stockMovement.findMany({ where: { organizationId: this.org(auth), ...this.branchWhere(auth) }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, type: true, quantity: true, reference: true, notes: true, createdAt: true, branch: { select: { name: true } }, product: { select: { name: true, sku: true, unit: true } }, booking: { select: { id: true } } } });
  }

  async claims(auth: AuthContext) {
    return this.prisma.warrantyClaim.findMany({ where: { organizationId: this.org(auth), ...this.branchWhere(auth) }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, claimNumber: true, status: true, issue: true, resolution: true, submittedAt: true, resolvedAt: true, createdAt: true, asset: { select: { id: true, category: true, brand: true, serialNumber: true, warrantyStartsAt: true, warrantyEndsAt: true, property: { select: { name: true, city: true } } } }, product: { select: { name: true, sku: true } }, supplier: { select: { name: true } } } });
  }

  async createClaim(auth: AuthContext, input: z.infer<typeof warrantyClaimCreateSchema>) {
    const organizationId = this.org(auth);
    const asset = await this.prisma.asset.findFirst({ where: { id: input.assetId, organizationId, deletedAt: null, ...(auth.branchId ? { property: { customer: { branchId: auth.branchId } } } : {}) }, select: { id: true, warrantyStartsAt: true, warrantyEndsAt: true, property: { select: { customer: { select: { branchId: true } } } } } });
    if (!asset) throw new NotFoundException("Asset not found.");
    const today = new Date();
    if (!asset.warrantyEndsAt || asset.warrantyEndsAt < today || (asset.warrantyStartsAt && asset.warrantyStartsAt > today)) throw new ConflictException("The asset does not have an active recorded warranty.");
    if (input.productId && !(await this.prisma.inventoryProduct.findFirst({ where: { id: input.productId, organizationId }, select: { id: true } }))) throw new BadRequestException("Product must belong to this organization.");
    if (input.supplierId && !(await this.prisma.supplier.findFirst({ where: { id: input.supplierId, organizationId }, select: { id: true } }))) throw new BadRequestException("Supplier must belong to this organization.");
    const claim = await this.prisma.warrantyClaim.create({ data: { organizationId, branchId: asset.property.customer.branchId, assetId: asset.id, productId: input.productId, supplierId: input.supplierId, issue: input.issue, claimNumber: `WC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`, createdById: auth.userId }, select: { id: true, claimNumber: true, status: true, issue: true, createdAt: true } });
    await this.audit(auth, "warranty.claim.created", "warranty_claim", claim.id);
    return claim;
  }

  async updateClaim(auth: AuthContext, claimId: string, input: z.infer<typeof warrantyClaimUpdateSchema>) {
    const claim = await this.prisma.warrantyClaim.findFirst({ where: { id: claimId, organizationId: this.org(auth), ...this.branchWhere(auth) }, select: { id: true, status: true } });
    if (!claim) throw new NotFoundException("Warranty claim not found.");
    const next = input.status as WarrantyClaimStatus;
    const allowed: Record<WarrantyClaimStatus, WarrantyClaimStatus[]> = { DRAFT: [WarrantyClaimStatus.SUBMITTED], SUBMITTED: [WarrantyClaimStatus.APPROVED, WarrantyClaimStatus.REJECTED], APPROVED: [WarrantyClaimStatus.RESOLVED], REJECTED: [], RESOLVED: [] };
    if (!allowed[claim.status].includes(next)) throw new ConflictException(`Cannot change a ${claim.status.toLowerCase()} claim to ${next.toLowerCase()}.`);
    return this.prisma.$transaction(async (tx) => {
      const update = await tx.warrantyClaim.updateMany({ where: { id: claimId, organizationId: auth.organizationId!, status: claim.status }, data: { status: next, ...(next === WarrantyClaimStatus.SUBMITTED ? { submittedAt: new Date() } : {}), ...(next === WarrantyClaimStatus.RESOLVED ? { resolvedAt: new Date() } : {}), ...(input.resolution !== undefined ? { resolution: input.resolution } : {}) } });
      if (update.count !== 1) throw new ConflictException("This claim was updated by another user.");
      await tx.auditLog.create({ data: { organizationId: auth.organizationId, actorUserId: auth.userId, action: `warranty.claim.${next.toLowerCase()}`, resourceType: "warranty_claim", resourceId: claimId } });
      return tx.warrantyClaim.findUniqueOrThrow({ where: { id: claimId }, select: { id: true, claimNumber: true, status: true, resolution: true } });
    });
  }
}
