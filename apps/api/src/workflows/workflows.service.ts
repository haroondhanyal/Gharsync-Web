import { randomUUID } from "node:crypto";
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "../generated/prisma/client.js";
import { BookingStatus, InvoiceStatus, OrganizationRole, PaymentStatus, QuoteStatus } from "../generated/prisma/enums.js";
import type { z } from "zod";
import type { bookingCreateSchema, bookingTransitionSchema, invoiceCreateSchema, paymentCreateSchema, paymentDecisionSchema, quoteCreateSchema, quoteDecisionSchema, serviceCreateSchema, serviceUpdateSchema, refundCreateSchema } from "@gharsync/validation";
import { PrismaService } from "../prisma/prisma.service.js";
import type { AuthContext } from "../auth/auth-context.js";
import { calculateQuoteTotals, canTransitionBooking, invoiceOutstanding, invoiceStatusFromLedger } from "./workflow-rules.js";

const asMoney = (value: number | Prisma.Decimal | string) => new Prisma.Decimal(value);
const bookingSelect = {
  id: true, organizationId: true, branchId: true, customerId: true, propertyId: true, assetId: true, serviceId: true,
  status: true, urgency: true, description: true, internalNotes: true, preferredAt: true, scheduledAt: true,
  assignedMemberId: true, createdAt: true, updatedAt: true,
  customer: { select: { id: true, fullName: true, phone: true, email: true } },
  property: { select: { id: true, name: true, address: true, city: true } },
  asset: { select: { id: true, category: true, brand: true, model: true } },
  service: { select: { id: true, name: true, category: true } },
  assignedMember: { select: { id: true, role: true, branchId: true, user: { select: { id: true, fullName: true, phone: true } } } },
  events: { orderBy: { createdAt: "asc" as const }, select: { id: true, fromStatus: true, toStatus: true, note: true, createdAt: true, actor: { select: { id: true, fullName: true } } } },
  quotes: { orderBy: { revision: "desc" as const }, take: 1, select: { id: true, revision: true, status: true, currency: true, subtotal: true, discount: true, tax: true, total: true, validUntil: true, createdAt: true } },
  invoices: { orderBy: { createdAt: "desc" as const }, take: 1, select: { id: true, invoiceNumber: true, status: true, total: true, currency: true } },
  documents: { where: { deletedAt: null }, orderBy: { createdAt: "desc" as const }, select: { id: true, fileName: true, mimeType: true, sizeBytes: true, createdAt: true } },
} satisfies Prisma.BookingSelect;

@Injectable()
export class WorkflowsService {
  constructor(private readonly prisma: PrismaService) {}

  private scope(auth: AuthContext) {
    if (!auth.organizationId) throw new ForbiddenException("Select an organization first.");
    return { organizationId: auth.organizationId, deletedAt: null, ...(auth.branchId ? { branchId: auth.branchId } : {}) };
  }

  async listServices(auth: AuthContext, includeInactive = false) {
    const branchFilter = auth.branchId ? { OR: [{ branchLinks: { none: {} } }, { branchLinks: { some: { branchId: auth.branchId } } }] } : {};
    return this.prisma.service.findMany({ where: { organizationId: auth.organizationId!, deletedAt: null, ...(includeInactive ? {} : { isActive: true }), ...branchFilter }, orderBy: [{ category: "asc" }, { name: "asc" }], select: { id: true, name: true, category: true, description: true, basePrice: true, minPrice: true, maxPrice: true, durationMins: true, requiredSkills: true, isActive: true, branchLinks: { select: { branchId: true, branch: { select: { name: true } } } }, createdAt: true } });
  }

  async createService(auth: AuthContext, input: z.infer<typeof serviceCreateSchema>) {
    const branchIds = await this.validateBranches(auth, input.branchIds);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const service = await tx.service.create({ data: { organizationId: auth.organizationId!, name: input.name, category: input.category, description: input.description, basePrice: input.basePrice === undefined ? null : asMoney(input.basePrice), minPrice: input.minPrice === undefined ? null : asMoney(input.minPrice), maxPrice: input.maxPrice === undefined ? null : asMoney(input.maxPrice), durationMins: input.durationMins, requiredSkills: input.requiredSkills, isActive: input.isActive }, select: { id: true, name: true, category: true, basePrice: true, minPrice: true, maxPrice: true, durationMins: true, requiredSkills: true, isActive: true } });
        if (branchIds.length) await tx.serviceBranch.createMany({ data: branchIds.map((branchId) => ({ organizationId: auth.organizationId!, serviceId: service.id, branchId })) });
        await tx.auditLog.create({ data: { organizationId: auth.organizationId!, actorUserId: auth.userId, action: "service.created", resourceType: "service", resourceId: service.id } });
        return service;
      });
    } catch (error) {
      if ((error as { code?: string })?.code === "P2002") throw new ConflictException("A service with this name already exists.");
      throw error;
    }
  }

  private async validateBranches(auth: AuthContext, branchIds: string[]) {
    if (auth.branchId && branchIds.some((id) => id !== auth.branchId)) throw new ForbiddenException("You can manage service availability only for your assigned branch.");
    if (auth.branchId && branchIds.length === 0) return [auth.branchId];
    const uniqueIds = [...new Set(branchIds)];
    const count = uniqueIds.length ? await this.prisma.branch.count({ where: { id: { in: uniqueIds }, organizationId: auth.organizationId!, deletedAt: null } }) : 0;
    if (count !== uniqueIds.length) throw new BadRequestException("A selected branch does not belong to this organization.");
    return uniqueIds;
  }

  async updateService(auth: AuthContext, serviceId: string, input: z.infer<typeof serviceUpdateSchema>) {
    const service = await this.prisma.service.findFirst({ where: { id: serviceId, organizationId: auth.organizationId!, deletedAt: null, ...(auth.branchId ? { branchLinks: { some: { branchId: auth.branchId } } } : {}) }, select: { id: true, minPrice: true, maxPrice: true } });
    if (!service) throw new NotFoundException("Service not found.");
    const nextMin = input.minPrice === undefined ? service.minPrice : asMoney(input.minPrice);
    const nextMax = input.maxPrice === undefined ? service.maxPrice : asMoney(input.maxPrice);
    if (nextMin && nextMax && nextMin.gt(nextMax)) throw new BadRequestException("Minimum price cannot exceed maximum price.");
    const branchIds = input.branchIds === undefined ? undefined : await this.validateBranches(auth, input.branchIds);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const updated = await tx.service.update({ where: { id: serviceId }, data: {
          ...(input.name !== undefined ? { name: input.name } : {}), ...(input.category !== undefined ? { category: input.category } : {}), ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.basePrice !== undefined ? { basePrice: asMoney(input.basePrice) } : {}), ...(input.minPrice !== undefined ? { minPrice: asMoney(input.minPrice) } : {}), ...(input.maxPrice !== undefined ? { maxPrice: asMoney(input.maxPrice) } : {}),
          ...(input.durationMins !== undefined ? { durationMins: input.durationMins } : {}), ...(input.requiredSkills !== undefined ? { requiredSkills: input.requiredSkills } : {}), ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        }, select: { id: true, name: true, category: true, description: true, basePrice: true, minPrice: true, maxPrice: true, durationMins: true, requiredSkills: true, isActive: true } });
        if (branchIds !== undefined) {
          await tx.serviceBranch.deleteMany({ where: { serviceId, ...(auth.branchId ? { branchId: auth.branchId } : {}) } });
          if (branchIds.length) await tx.serviceBranch.createMany({ data: branchIds.map((branchId) => ({ organizationId: auth.organizationId!, serviceId, branchId })) });
        }
        await tx.auditLog.create({ data: { organizationId: auth.organizationId!, actorUserId: auth.userId, action: "service.updated", resourceType: "service", resourceId: serviceId } });
        return updated;
      });
    } catch (error) {
      if ((error as { code?: string })?.code === "P2002") throw new ConflictException("A service with this name already exists.");
      throw error;
    }
  }

  async listBookings(auth: AuthContext, statusRaw?: string, page = 1) {
    const status = statusRaw && Object.values(BookingStatus).includes(statusRaw as BookingStatus) ? statusRaw as BookingStatus : undefined;
    const where = { ...this.scope(auth), ...(status ? { status } : {}), ...(auth.role === OrganizationRole.TECHNICIAN ? { assignedMember: { userId: auth.userId } } : {}) };
    const [total, data] = await Promise.all([
      this.prisma.booking.count({ where }),
      this.prisma.booking.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "asc" }], skip: (page - 1) * 25, take: 25, select: bookingSelect }),
    ]);
    return { data, pagination: { page, pageSize: 25, total, totalPages: Math.ceil(total / 25) } };
  }

  listTechnicians(auth: AuthContext) {
    return this.prisma.organizationMember.findMany({ where: { organizationId: auth.organizationId!, status: "ACTIVE", role: OrganizationRole.TECHNICIAN, ...(auth.branchId ? { OR: [{ branchId: auth.branchId }, { branchId: null }] } : {}) }, orderBy: { user: { fullName: "asc" } }, select: { id: true, branchId: true, user: { select: { id: true, fullName: true, phone: true } }, branch: { select: { name: true } } } });
  }

  async getBooking(auth: AuthContext, bookingId: string) {
    const where = { id: bookingId, ...this.scope(auth), ...(auth.role === OrganizationRole.TECHNICIAN ? { assignedMember: { userId: auth.userId } } : {}) };
    const booking = await this.prisma.booking.findFirst({ where, select: bookingSelect });
    if (!booking) throw new NotFoundException("Booking not found.");
    return booking;
  }

  async createBooking(auth: AuthContext, input: z.infer<typeof bookingCreateSchema>) {
    const organizationId = auth.organizationId!;
    const customer = await this.prisma.customer.findFirst({ where: { id: input.customerId, organizationId, deletedAt: null, isActive: true, ...(auth.branchId ? { branchId: auth.branchId } : {}) }, select: { id: true, branchId: true } });
    if (!customer) throw new NotFoundException("Customer not found in this organization.");
    const branchId = auth.branchId ?? input.branchId ?? customer.branchId;
    if (auth.branchId && input.branchId && input.branchId !== auth.branchId) throw new ForbiddenException("Select your assigned branch.");
    if (branchId) {
      const branch = await this.prisma.branch.findFirst({ where: { id: branchId, organizationId, deletedAt: null }, select: { id: true } });
      if (!branch) throw new BadRequestException("The selected branch does not belong to this organization.");
      if (customer.branchId && customer.branchId !== branchId) throw new BadRequestException("The selected customer belongs to another branch.");
    }
    let propertyId = input.propertyId;
    let assetId = input.assetId;
    if (assetId) {
      const asset = await this.prisma.asset.findFirst({ where: { id: assetId, organizationId, deletedAt: null, property: { customerId: input.customerId, deletedAt: null, ...(auth.branchId ? { customer: { branchId: auth.branchId } } : {}) } }, select: { id: true, propertyId: true } });
      if (!asset || (propertyId && propertyId !== asset.propertyId)) throw new BadRequestException("The selected asset does not belong to this customer's property.");
      propertyId = asset.propertyId;
    }
    if (propertyId) {
      const property = await this.prisma.property.findFirst({ where: { id: propertyId, organizationId, customerId: input.customerId, deletedAt: null }, select: { id: true } });
      if (!property) throw new BadRequestException("The selected property does not belong to this customer.");
    }
    if (input.serviceId) {
      const service = await this.prisma.service.findFirst({ where: { id: input.serviceId, organizationId, isActive: true, deletedAt: null, ...(branchId ? { OR: [{ branchLinks: { none: {} } }, { branchLinks: { some: { branchId } } }] } : {}) }, select: { id: true } });
      if (!service) throw new BadRequestException("The selected service is unavailable for this branch.");
    }
    if (input.preferredAt && new Date(input.preferredAt) < new Date()) throw new BadRequestException("Preferred service time must be in the future.");
    const booking = await this.prisma.$transaction(async (tx) => {
      const created = await tx.booking.create({ data: {
        organizationId, branchId, customerId: input.customerId, propertyId, assetId, serviceId: input.serviceId,
        urgency: input.urgency, description: input.description, preferredAt: input.preferredAt ? new Date(input.preferredAt) : null,
        ...(input.latitude !== undefined ? { latitude: new Prisma.Decimal(input.latitude) } : {}), ...(input.longitude !== undefined ? { longitude: new Prisma.Decimal(input.longitude) } : {}),
        events: { create: { organizationId, actorUserId: auth.userId, fromStatus: null, toStatus: BookingStatus.REQUESTED, note: "Booking created." } },
      }, select: { id: true, status: true, customerId: true, createdAt: true } });
      await tx.auditLog.create({ data: { organizationId, actorUserId: auth.userId, action: "booking.created", resourceType: "booking", resourceId: created.id, metadata: { branchId, serviceId: input.serviceId } } });
      return created;
    });
    return this.getBooking(auth, booking.id);
  }

  async transitionBooking(auth: AuthContext, bookingId: string, input: z.infer<typeof bookingTransitionSchema>) {
    return this.performBookingTransition(auth, bookingId, input);
  }

  private async performBookingTransition(auth: AuthContext, bookingId: string, input: z.infer<typeof bookingTransitionSchema>, assignedUserId?: string) {
    const booking = await this.prisma.booking.findFirst({ where: { id: bookingId, ...this.scope(auth), ...(assignedUserId ? { assignedMember: { userId: assignedUserId } } : {}) }, select: { id: true, status: true, branchId: true, scheduledAt: true, assignedMemberId: true } });
    if (!booking) throw new NotFoundException("Booking not found.");
    const next = input.status as BookingStatus;
    if (!canTransitionBooking(booking.status, next)) throw new ConflictException(`Booking cannot move from ${booking.status} to ${next}.`);
    if (next === BookingStatus.SCHEDULED || next === BookingStatus.ASSIGNED) {
      const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : booking.scheduledAt;
      if (!scheduledAt) throw new BadRequestException("Set a scheduled time before assigning a technician.");
      if (scheduledAt < new Date()) throw new BadRequestException("Scheduled time must be in the future.");
    }
    let assignedMemberId = input.assignedMemberId === undefined ? booking.assignedMemberId : input.assignedMemberId;
    if (next === BookingStatus.ASSIGNED) {
      if (!assignedMemberId) throw new BadRequestException("Select a technician for this booking.");
      const technician = await this.prisma.organizationMember.findFirst({ where: { id: assignedMemberId, organizationId: auth.organizationId!, status: "ACTIVE", role: OrganizationRole.TECHNICIAN, ...(booking.branchId ? { OR: [{ branchId: booking.branchId }, { branchId: null }] } : {}) }, select: { id: true } });
      if (!technician) throw new BadRequestException("Choose an active technician in this organization and branch.");
    }
    if (next === BookingStatus.SCHEDULED && input.assignedMemberId === null) assignedMemberId = null;
    const updated = await this.prisma.$transaction(async (tx) => {
      const claim = await tx.booking.updateMany({ where: { id: booking.id, status: booking.status, organizationId: auth.organizationId!, deletedAt: null, ...(assignedUserId ? { assignedMemberId: booking.assignedMemberId } : {}) }, data: {
        status: next, ...(input.scheduledAt ? { scheduledAt: new Date(input.scheduledAt) } : {}),
        ...(input.assignedMemberId !== undefined || next === BookingStatus.ASSIGNED ? { assignedMemberId } : {}),
      } });
      if (claim.count !== 1) throw new ConflictException("This booking was updated by another user. Refresh and try again.");
      await tx.bookingEvent.create({ data: { organizationId: auth.organizationId!, bookingId, actorUserId: auth.userId, fromStatus: booking.status, toStatus: next, note: input.note } });
      await tx.auditLog.create({ data: { organizationId: auth.organizationId!, actorUserId: auth.userId, action: "booking.status_changed", resourceType: "booking", resourceId: bookingId, metadata: { from: booking.status, to: next } } });
      return tx.booking.findUniqueOrThrow({ where: { id: bookingId }, select: bookingSelect });
    });
    return updated;
  }

  async updateAssignedBooking(auth: AuthContext, bookingId: string, input: { status: "TECHNICIAN_EN_ROUTE" | "IN_PROGRESS" | "COMPLETED" | "DISPUTED"; note?: string }) {
    const assignment = await this.prisma.organizationMember.findFirst({ where: { organizationId: auth.organizationId!, userId: auth.userId, status: "ACTIVE", role: OrganizationRole.TECHNICIAN }, select: { id: true } });
    if (!assignment) throw new ForbiddenException("This account is not an active technician.");
    return this.performBookingTransition(auth, bookingId, { status: input.status, note: input.note }, auth.userId);
  }

  async createQuote(auth: AuthContext, bookingId: string, input: z.infer<typeof quoteCreateSchema>) {
    const booking = await this.prisma.booking.findFirst({ where: { id: bookingId, ...this.scope(auth) }, select: { id: true, status: true, branchId: true } });
    if (!booking) throw new NotFoundException("Booking not found.");
    if (booking.status !== BookingStatus.UNDER_REVIEW && booking.status !== BookingStatus.QUOTED) throw new ConflictException("A quote can only be prepared while the booking is under review.");
    if (input.validUntil && new Date(input.validUntil) <= new Date()) throw new BadRequestException("Quote expiry must be in the future.");
    let amounts: ReturnType<typeof calculateQuoteTotals>;
    try { amounts = calculateQuoteTotals(input.items, input.discount, input.tax); }
    catch (error) { throw new BadRequestException(error instanceof Error ? error.message : "Invalid quotation totals."); }
    const items = input.items.map((item) => {
      const quantity = asMoney(item.quantity);
      const unitPrice = asMoney(item.unitPrice);
      return { description: item.description, quantity, unitPrice, lineTotal: quantity.mul(unitPrice).toDecimalPlaces(2), sortOrder: item.sortOrder ?? 0 };
    });
    const { subtotal, discount, tax, total } = amounts;
    const quote = await this.prisma.$transaction(async (tx) => {
      let latest = await tx.quote.findFirst({ where: { bookingId, organizationId: auth.organizationId! }, orderBy: { revision: "desc" }, select: { revision: true, status: true, validUntil: true } });
      if (latest?.status === QuoteStatus.SENT && latest.validUntil && latest.validUntil <= new Date()) {
        await tx.quote.updateMany({ where: { bookingId, organizationId: auth.organizationId!, revision: latest.revision, status: QuoteStatus.SENT }, data: { status: QuoteStatus.EXPIRED } });
        latest = { ...latest, status: QuoteStatus.EXPIRED };
      }
      if (latest && latest.status !== QuoteStatus.REJECTED && latest.status !== QuoteStatus.SUPERSEDED && latest.status !== QuoteStatus.EXPIRED) throw new ConflictException("Resolve or supersede the current quote before creating a revision.");
      const created = await tx.quote.create({ data: {
        organizationId: auth.organizationId!, branchId: booking.branchId, bookingId, revision: (latest?.revision ?? 0) + 1,
        currency: "PKR", subtotal, discount, tax, total, notes: input.notes, validUntil: input.validUntil ? new Date(input.validUntil) : null, createdById: auth.userId,
        items: { create: items },
      }, select: { id: true, revision: true, status: true, currency: true, subtotal: true, discount: true, tax: true, total: true, validUntil: true, createdAt: true, items: { orderBy: { sortOrder: "asc" }, select: { id: true, description: true, quantity: true, unitPrice: true, lineTotal: true, sortOrder: true } } } });
      if (booking.status !== BookingStatus.QUOTED) {
        await tx.booking.update({ where: { id: bookingId }, data: { status: BookingStatus.QUOTED } });
        await tx.bookingEvent.create({ data: { organizationId: auth.organizationId!, bookingId, actorUserId: auth.userId, fromStatus: booking.status, toStatus: BookingStatus.QUOTED, note: `Quote revision ${created.revision} prepared.` } });
      }
      await tx.auditLog.create({ data: { organizationId: auth.organizationId!, actorUserId: auth.userId, action: "quote.created", resourceType: "quote", resourceId: created.id, metadata: { bookingId, revision: created.revision, total: total.toFixed(2) } } });
      return created;
    });
    return quote;
  }

  async sendQuote(auth: AuthContext, quoteId: string) {
    const quote = await this.prisma.quote.findFirst({ where: { id: quoteId, organizationId: auth.organizationId!, ...(auth.branchId ? { branchId: auth.branchId } : {}) }, select: { id: true, bookingId: true, status: true, validUntil: true, revision: true } });
    if (!quote) throw new NotFoundException("Quote not found.");
    if (quote.status !== QuoteStatus.DRAFT) throw new ConflictException("Only draft quotes can be sent.");
    if (quote.validUntil && quote.validUntil <= new Date()) throw new ConflictException("This quote has expired.");
    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findFirst({ where: { id: quote.bookingId, organizationId: auth.organizationId!, status: BookingStatus.QUOTED }, select: { status: true } });
      if (!booking) throw new ConflictException("Booking is no longer waiting for this quote.");
      const changed = await tx.quote.updateMany({ where: { id: quoteId, status: QuoteStatus.DRAFT }, data: { status: QuoteStatus.SENT } });
      if (changed.count !== 1) throw new ConflictException("This quote was updated by another user.");
      await tx.booking.update({ where: { id: quote.bookingId }, data: { status: BookingStatus.AWAITING_APPROVAL } });
      await tx.bookingEvent.create({ data: { organizationId: auth.organizationId!, bookingId: quote.bookingId, actorUserId: auth.userId, fromStatus: BookingStatus.QUOTED, toStatus: BookingStatus.AWAITING_APPROVAL, note: `Quote revision ${quote.revision} sent for approval.` } });
      await tx.auditLog.create({ data: { organizationId: auth.organizationId!, actorUserId: auth.userId, action: "quote.sent", resourceType: "quote", resourceId: quoteId } });
      return tx.quote.findUniqueOrThrow({ where: { id: quoteId }, select: { id: true, revision: true, status: true, total: true, currency: true, validUntil: true } });
    });
  }

  async decideQuote(auth: AuthContext, quoteId: string, input: z.infer<typeof quoteDecisionSchema>) {
    const quote = await this.prisma.quote.findFirst({ where: { id: quoteId, organizationId: auth.organizationId!, ...(auth.branchId ? { branchId: auth.branchId } : {}) }, select: { id: true, bookingId: true, status: true, revision: true, validUntil: true } });
    if (!quote) throw new NotFoundException("Quote not found.");
    if (quote.status !== QuoteStatus.SENT || (quote.validUntil && quote.validUntil <= new Date())) throw new ConflictException("Only a current, unexpired quote can be decided.");
    const next = input.decision as QuoteStatus;
    const bookingStatus = input.decision === "ACCEPTED" ? BookingStatus.APPROVED : BookingStatus.UNDER_REVIEW;
    return this.prisma.$transaction(async (tx) => {
      const claimed = await tx.quote.updateMany({ where: { id: quoteId, status: QuoteStatus.SENT }, data: { status: next, ...(next === QuoteStatus.ACCEPTED ? { acceptedAt: new Date() } : { rejectedAt: new Date() }) } });
      if (claimed.count !== 1) throw new ConflictException("This quote was already decided.");
      const bookingClaim = await tx.booking.updateMany({ where: { id: quote.bookingId, organizationId: auth.organizationId!, status: BookingStatus.AWAITING_APPROVAL }, data: { status: bookingStatus } });
      if (bookingClaim.count !== 1) throw new ConflictException("Booking is no longer awaiting quote approval.");
      await tx.bookingEvent.create({ data: { organizationId: auth.organizationId!, bookingId: quote.bookingId, actorUserId: auth.userId, fromStatus: BookingStatus.AWAITING_APPROVAL, toStatus: bookingStatus, note: input.note ?? `Quote ${input.decision.toLowerCase()}.` } });
      await tx.auditLog.create({ data: { organizationId: auth.organizationId!, actorUserId: auth.userId, action: `quote.${input.decision.toLowerCase()}`, resourceType: "quote", resourceId: quoteId } });
      return tx.quote.findUniqueOrThrow({ where: { id: quoteId }, select: { id: true, revision: true, status: true, acceptedAt: true, rejectedAt: true } });
    });
  }

  async createInvoice(auth: AuthContext, bookingId: string, input: z.infer<typeof invoiceCreateSchema>) {
    if (input.dueAt && new Date(input.dueAt) <= new Date()) throw new BadRequestException("Invoice due date must be in the future.");
    const existing = await this.prisma.invoice.findFirst({ where: { bookingId, organizationId: auth.organizationId!, ...(auth.branchId ? { branchId: auth.branchId } : {}), status: { not: InvoiceStatus.VOID } }, select: { id: true } });
    if (existing) return this.getInvoice(auth, existing.id);
    const booking = await this.prisma.booking.findFirst({ where: { id: bookingId, ...this.scope(auth) }, select: { id: true, branchId: true, status: true, quotes: { where: { status: QuoteStatus.ACCEPTED }, orderBy: { revision: "desc" }, take: 1, select: { id: true, currency: true, subtotal: true, discount: true, tax: true, total: true, items: { orderBy: { sortOrder: "asc" }, select: { description: true, quantity: true, unitPrice: true, lineTotal: true, sortOrder: true } } } } } });
    if (!booking) throw new NotFoundException("Booking not found.");
    if (booking.status !== BookingStatus.COMPLETED) throw new ConflictException("An invoice can only be issued after the service is marked complete.");
    const quote = booking.quotes[0];
    if (!quote) throw new ConflictException("The booking has no accepted quotation to invoice.");
    const invoiceId = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "bookings" WHERE "id" = ${bookingId}::uuid FOR UPDATE`);
      const activeInvoice = await tx.invoice.findFirst({ where: { bookingId, organizationId: auth.organizationId!, status: { not: InvoiceStatus.VOID } }, select: { id: true } });
      if (activeInvoice) return activeInvoice.id;
      const invoiceNumber = `GS-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 8).toUpperCase()}`;
      const invoice = await tx.invoice.create({ data: {
        organizationId: auth.organizationId!, branchId: booking.branchId, bookingId, quoteId: quote.id, invoiceNumber,
        currency: quote.currency, subtotal: quote.subtotal, discount: quote.discount, tax: quote.tax, total: quote.total,
        createdById: auth.userId, dueAt: input.dueAt ? new Date(input.dueAt) : null,
        items: { create: quote.items.map((item) => ({ ...item })) },
      }, select: { id: true, bookingId: true, invoiceNumber: true, status: true, currency: true, subtotal: true, discount: true, tax: true, total: true, dueAt: true, createdAt: true } });
      await tx.auditLog.create({ data: { organizationId: auth.organizationId!, actorUserId: auth.userId, action: "invoice.issued", resourceType: "invoice", resourceId: invoice.id } });
      return invoice.id;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return this.getInvoice(auth, invoiceId);
  }

  async listInvoices(auth: AuthContext, statusRaw?: string) {
    const valid = Object.values(InvoiceStatus).includes(statusRaw as InvoiceStatus) ? statusRaw as InvoiceStatus : undefined;
    const where = { organizationId: auth.organizationId!, ...(auth.branchId ? { branchId: auth.branchId } : {}), ...(valid ? { status: valid } : {}) };
    return this.prisma.invoice.findMany({ where, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, bookingId: true, invoiceNumber: true, status: true, currency: true, total: true, dueAt: true, createdAt: true, booking: { select: { customer: { select: { fullName: true } } } }, _count: { select: { payments: true } } } });
  }

  async getInvoice(auth: AuthContext, invoiceId: string) {
    const invoice = await this.prisma.invoice.findFirst({ where: { id: invoiceId, organizationId: auth.organizationId!, ...(auth.branchId ? { branchId: auth.branchId } : {}) }, select: { id: true, bookingId: true, invoiceNumber: true, status: true, currency: true, subtotal: true, discount: true, tax: true, total: true, dueAt: true, createdAt: true, organization: { select: { name: true } }, branch: { select: { name: true, address: true, city: true, phone: true } }, booking: { select: { id: true, customer: { select: { id: true, fullName: true, phone: true, email: true } }, property: { select: { name: true, address: true, city: true } } } }, items: { orderBy: { sortOrder: "asc" }, select: { id: true, description: true, quantity: true, unitPrice: true, lineTotal: true } }, payments: { orderBy: { createdAt: "desc" }, select: { id: true, amount: true, currency: true, method: true, status: true, reference: true, verifiedAt: true, createdAt: true, note: true, refunds: { select: { id: true, amount: true, reason: true, reference: true, createdAt: true } } } } } });
    if (!invoice) throw new NotFoundException("Invoice not found.");
    const collected = invoice.payments.filter((payment) => payment.status === PaymentStatus.VERIFIED).reduce((sum, payment) => sum.add(payment.amount), asMoney(0));
    const refunded = invoice.payments.flatMap((payment) => payment.refunds).reduce((sum, refund) => sum.add(refund.amount), asMoney(0));
    const outstanding = invoiceOutstanding(invoice.total, collected, refunded);
    return { ...invoice, paidAmount: collected.sub(refunded).toDecimalPlaces(2), outstandingAmount: outstanding };
  }

  async recordPayment(auth: AuthContext, invoiceId: string, input: z.infer<typeof paymentCreateSchema>) {
    const organizationId = auth.organizationId!;
    const amount = asMoney(input.amount);
    const prior = await this.prisma.payment.findFirst({ where: { organizationId, idempotencyKey: input.idempotencyKey }, select: { id: true, invoiceId: true, amount: true, method: true, status: true } });
    if (prior) {
      if (prior.invoiceId !== invoiceId || !asMoney(prior.amount).eq(amount) || prior.method !== input.method) throw new ConflictException("This idempotency key was already used for another payment.");
      return prior;
    }
    try {
      const payment = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "invoices" WHERE "id" = ${invoiceId}::uuid FOR UPDATE`);
        const invoice = await tx.invoice.findFirst({ where: { id: invoiceId, organizationId, status: { not: InvoiceStatus.VOID }, ...(auth.branchId ? { branchId: auth.branchId } : {}) }, select: { id: true, currency: true, total: true, branchId: true } });
        if (!invoice) throw new NotFoundException("Invoice not found.");
        const [verified, refunded] = await Promise.all([
          tx.payment.aggregate({ where: { invoiceId, status: PaymentStatus.VERIFIED }, _sum: { amount: true } }),
          tx.refund.aggregate({ where: { invoiceId }, _sum: { amount: true } }),
        ]);
        const balance = invoiceOutstanding(invoice.total, verified._sum.amount ?? 0, refunded._sum.amount ?? 0);
        if (amount.gt(balance)) throw new BadRequestException("Payment exceeds the invoice's current outstanding balance.");
        const created = await tx.payment.create({ data: { organizationId, branchId: invoice.branchId, invoiceId, amount, currency: invoice.currency, method: input.method, reference: input.reference, note: input.note, idempotencyKey: input.idempotencyKey, recordedById: auth.userId }, select: { id: true, invoiceId: true, amount: true, currency: true, method: true, status: true, reference: true, createdAt: true } });
        await tx.auditLog.create({ data: { organizationId, actorUserId: auth.userId, action: "payment.recorded", resourceType: "payment", resourceId: created.id, metadata: { invoiceId, amount: amount.toFixed(2), method: input.method } } });
        return created;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      return payment;
    } catch (error) {
      if ((error as { code?: string })?.code === "P2002") {
        const duplicate = await this.prisma.payment.findFirst({ where: { organizationId, idempotencyKey: input.idempotencyKey }, select: { id: true, invoiceId: true, amount: true, method: true, status: true } });
        if (duplicate && duplicate.invoiceId === invoiceId && asMoney(duplicate.amount).eq(amount) && duplicate.method === input.method) return duplicate;
        throw new ConflictException("This idempotency key was already used.");
      }
      throw error;
    }
  }

  async decidePayment(auth: AuthContext, paymentId: string, input: z.infer<typeof paymentDecisionSchema>) {
    const payment = await this.prisma.payment.findFirst({ where: { id: paymentId, organizationId: auth.organizationId!, ...(auth.branchId ? { branchId: auth.branchId } : {}) }, select: { id: true, invoiceId: true, amount: true, status: true } });
    if (!payment) throw new NotFoundException("Payment not found.");
    const target = input.decision as PaymentStatus;
    if (payment.status === target) return payment;
    if (payment.status !== PaymentStatus.PENDING_VERIFICATION) throw new ConflictException("Only a pending payment can be verified or rejected.");
    return this.prisma.$transaction(async (tx) => {
      if (target === PaymentStatus.VERIFIED) {
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "invoices" WHERE "id" = ${payment.invoiceId}::uuid FOR UPDATE`);
        const [invoice, verified, refunded] = await Promise.all([
          tx.invoice.findUniqueOrThrow({ where: { id: payment.invoiceId }, select: { id: true, total: true, status: true } }),
          tx.payment.aggregate({ where: { invoiceId: payment.invoiceId, status: PaymentStatus.VERIFIED }, _sum: { amount: true } }),
          tx.refund.aggregate({ where: { invoiceId: payment.invoiceId }, _sum: { amount: true } }),
        ]);
        if (invoice.status === InvoiceStatus.VOID) throw new ConflictException("A void invoice cannot receive payments.");
        const currentPaid = asMoney(verified._sum.amount ?? 0).sub(refunded._sum.amount ?? 0);
        if (currentPaid.add(payment.amount).gt(invoice.total)) throw new ConflictException("Verifying this payment would overpay the invoice.");
      }
      const update = await tx.payment.updateMany({ where: { id: paymentId, status: PaymentStatus.PENDING_VERIFICATION }, data: { status: target, ...(target === PaymentStatus.VERIFIED ? { verifiedById: auth.userId, verifiedAt: new Date() } : {}), note: input.note } });
      if (update.count !== 1) throw new ConflictException("This payment was updated by another user.");
      if (target === PaymentStatus.VERIFIED) {
        const [invoice, verified, refunds] = await Promise.all([
          tx.invoice.findUniqueOrThrow({ where: { id: payment.invoiceId }, select: { total: true } }),
          tx.payment.aggregate({ where: { invoiceId: payment.invoiceId, status: PaymentStatus.VERIFIED }, _sum: { amount: true } }),
          tx.refund.aggregate({ where: { invoiceId: payment.invoiceId }, _sum: { amount: true } }),
        ]);
        const status = invoiceStatusFromLedger(invoice.total, verified._sum.amount ?? 0, refunds._sum.amount ?? 0);
        await tx.invoice.update({ where: { id: payment.invoiceId }, data: { status } });
      }
      await tx.auditLog.create({ data: { organizationId: auth.organizationId!, actorUserId: auth.userId, action: `payment.${input.decision.toLowerCase()}`, resourceType: "payment", resourceId: paymentId, metadata: { invoiceId: payment.invoiceId, note: input.note } } });
      return tx.payment.findUniqueOrThrow({ where: { id: paymentId }, select: { id: true, invoiceId: true, amount: true, currency: true, method: true, status: true, verifiedAt: true, updatedAt: true } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async refundPayment(auth: AuthContext, input: z.infer<typeof refundCreateSchema>) {
    const payment = await this.prisma.payment.findFirst({ where: { id: input.paymentId, organizationId: auth.organizationId!, status: PaymentStatus.VERIFIED, ...(auth.branchId ? { branchId: auth.branchId } : {}) }, select: { id: true, invoiceId: true, branchId: true, amount: true, currency: true } });
    if (!payment) throw new NotFoundException("Verified payment not found.");
    const amount = asMoney(input.amount);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "invoices" WHERE "id" = ${payment.invoiceId}::uuid FOR UPDATE`);
      const priorRefunds = await tx.refund.aggregate({ where: { paymentId: payment.id }, _sum: { amount: true } });
      if (asMoney(priorRefunds._sum.amount ?? 0).add(amount).gt(payment.amount)) throw new BadRequestException("Refund exceeds the verified payment amount.");
      const refund = await tx.refund.create({ data: { organizationId: auth.organizationId!, branchId: payment.branchId, paymentId: payment.id, invoiceId: payment.invoiceId, amount, reference: input.reference, reason: input.reason, processedById: auth.userId }, select: { id: true, paymentId: true, invoiceId: true, amount: true, reference: true, reason: true, createdAt: true } });
      const [invoice, verified, refunds] = await Promise.all([
        tx.invoice.findUniqueOrThrow({ where: { id: payment.invoiceId }, select: { total: true, status: true } }),
        tx.payment.aggregate({ where: { invoiceId: payment.invoiceId, status: PaymentStatus.VERIFIED }, _sum: { amount: true } }),
        tx.refund.aggregate({ where: { invoiceId: payment.invoiceId }, _sum: { amount: true } }),
      ]);
      if (invoice.status !== InvoiceStatus.VOID) {
        await tx.invoice.update({ where: { id: payment.invoiceId }, data: { status: invoiceStatusFromLedger(invoice.total, verified._sum.amount ?? 0, refunds._sum.amount ?? 0) } });
      }
      await tx.auditLog.create({ data: { organizationId: auth.organizationId!, actorUserId: auth.userId, action: "payment.refunded", resourceType: "refund", resourceId: refund.id, metadata: { paymentId: payment.id, amount: amount.toFixed(2), reason: input.reason } } });
      return refund;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async voidInvoice(auth: AuthContext, invoiceId: string, reason?: string) {
    const invoice = await this.prisma.invoice.findFirst({ where: { id: invoiceId, organizationId: auth.organizationId!, ...(auth.branchId ? { branchId: auth.branchId } : {}) }, select: { id: true, status: true } });
    if (!invoice) throw new NotFoundException("Invoice not found.");
    if (invoice.status === InvoiceStatus.VOID) return { status: "void" };
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "invoices" WHERE "id" = ${invoiceId}::uuid FOR UPDATE`);
      const current = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId }, select: { status: true } });
      if (current.status === InvoiceStatus.VOID) return;
      if (await tx.payment.count({ where: { invoiceId } })) throw new ConflictException("An invoice with payment records cannot be voided. Record a refund instead.");
      const updated = await tx.invoice.updateMany({ where: { id: invoiceId, organizationId: auth.organizationId!, status: { not: InvoiceStatus.VOID } }, data: { status: InvoiceStatus.VOID, voidedAt: new Date() } });
      if (updated.count !== 1) throw new ConflictException("This invoice was updated by another user.");
      await tx.auditLog.create({ data: { organizationId: auth.organizationId!, actorUserId: auth.userId, action: "invoice.voided", resourceType: "invoice", resourceId: invoiceId, metadata: { reason } } });
    });
    return { status: "void" };
  }
}
