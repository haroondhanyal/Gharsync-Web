import { z } from "zod";

export const pakistanPhoneSchema = z.string()
  .trim()
  .regex(/^(\+92|0092|0)3\d{9}$/, "Enter a valid Pakistan mobile number.");

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(2).max(180),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100),
  businessType: z.string().trim().max(80).optional(),
  city: z.string().trim().min(2).max(100),
}).strict();

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;

const signUpBaseSchema = z.object({
  fullName: z.string().trim().min(2).max(160),
  email: z.email().trim().toLowerCase(),
  password: z.string().min(12).max(128),
  phone: pakistanPhoneSchema,
});

const businessTypes = ["AC_REPAIR", "ELECTRICAL", "PLUMBING", "APPLIANCE_REPAIR", "SOLAR", "GENERAL_MAINTENANCE", "OTHER"] as const;
export const signUpSchema = z.discriminatedUnion("accountType", [
  signUpBaseSchema.extend({
    accountType: z.literal("business"),
    organizationName: z.string().trim().min(2).max(180),
    businessType: z.enum(businessTypes),
    city: z.string().trim().min(2).max(100),
  }).strict(),
  signUpBaseSchema.extend({ accountType: z.literal("team") }).strict(),
]);

export const signInSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(1).max(128),
}).strict();

export const passwordResetRequestSchema = z.object({ email: z.email().trim().toLowerCase() }).strict();
export const passwordResetCompleteSchema = z.object({
  token: z.string().min(32).max(4096),
  password: z.string().min(12).max(128),
}).strict();
export const phoneOtpSchema = z.object({ code: z.string().regex(/^\d{6}$/) }).strict();
export const inviteCreateSchema = z.object({
  email: z.email().trim().toLowerCase(),
  role: z.enum(["ADMIN", "MANAGER", "STAFF", "TECHNICIAN"]),
  branchId: z.uuid().optional(),
}).strict();
export const inviteAcceptSchema = z.object({ token: z.string().min(32).max(4096) }).strict();
export const organizationCreateSchema = z.object({
  name: z.string().trim().min(2).max(180),
  businessType: z.enum(businessTypes),
  city: z.string().trim().min(2).max(100),
  address: z.string().trim().max(500).optional(),
}).strict();
export const branchCreateSchema = z.object({
  name: z.string().trim().min(2).max(160),
  city: z.string().trim().min(2).max(100),
  address: z.string().trim().max(500).optional(),
  phone: pakistanPhoneSchema.optional(),
}).strict();
export const memberUpdateSchema = z.object({
  role: z.enum(["ADMIN", "MANAGER", "STAFF", "TECHNICIAN"]).optional(),
  branchId: z.uuid().nullable().optional(),
}).strict().refine((input) => input.role !== undefined || input.branchId !== undefined, "Provide a role or branch update.");

export const customerCreateSchema = z.object({
  fullName: z.string().trim().min(2).max(160),
  phone: pakistanPhoneSchema,
  email: z.union([z.email().trim().toLowerCase(), z.literal("")]).optional(),
  notes: z.string().trim().max(5000).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  address: z.string().trim().max(500).optional(),
  city: z.string().trim().max(100).optional(),
}).strict();

export const customerUpdateSchema = customerCreateSchema.partial();
export const customerQuerySchema = z.object({
  q: z.string().trim().max(160).optional(),
  status: z.enum(["active", "archived", "all"]).default("active"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
}).strict();

const nonNegativeMoney = z.coerce.number().finite().min(0).max(9999999999.99);
const locationSchema = {
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
};
export const propertyCreateSchema = z.object({
  customerId: z.uuid(), name: z.string().trim().min(2).max(120), propertyType: z.enum(["HOUSE", "APARTMENT", "COMMERCIAL", "OTHER"]).default("HOUSE"),
  address: z.string().trim().min(3).max(500), city: z.string().trim().min(2).max(100), ownership: z.enum(["OWNER", "TENANT", "OTHER"]).optional(),
  notes: z.string().trim().max(5000).optional(), ...locationSchema,
}).strict();
export const propertyUpdateSchema = propertyCreateSchema.omit({ customerId: true }).partial();
export const assetCreateSchema = z.object({
  propertyId: z.uuid(), category: z.string().trim().min(2).max(80), brand: z.string().trim().max(100).optional(), model: z.string().trim().max(100).optional(),
  serialNumber: z.string().trim().max(120).optional(), purchasedAt: z.iso.datetime().optional(), installedAt: z.iso.datetime().optional(),
  warrantyStartsAt: z.iso.datetime().optional(), warrantyEndsAt: z.iso.datetime().optional(), purchasePrice: nonNegativeMoney.optional(), seller: z.string().trim().max(180).optional(),
}).strict();
export const assetUpdateSchema = assetCreateSchema.omit({ propertyId: true }).partial();
export const documentTargetSchema = z.object({ customerId: z.uuid().optional(), propertyId: z.uuid().optional(), assetId: z.uuid().optional(), bookingId: z.uuid().optional() }).strict()
  .refine((target) => Object.values(target).filter(Boolean).length === 1, "Choose exactly one record for this attachment.");
const serviceFieldsSchema = z.object({
  name: z.string().trim().min(2).max(160), category: z.string().trim().min(2).max(80), description: z.string().trim().max(5000).optional(),
  basePrice: nonNegativeMoney.optional(), minPrice: nonNegativeMoney.optional(), maxPrice: nonNegativeMoney.optional(), durationMins: z.number().int().min(5).max(1440).optional(),
  requiredSkills: z.array(z.string().trim().min(1).max(80)).max(30).default([]), branchIds: z.array(z.uuid()).max(100).default([]), isActive: z.boolean().default(true),
}).strict();
const validServiceRange = <T extends { minPrice?: number; maxPrice?: number }>(value: T) => value.minPrice === undefined || value.maxPrice === undefined || value.minPrice <= value.maxPrice;
export const serviceCreateSchema = serviceFieldsSchema.refine(validServiceRange, "Minimum price cannot exceed maximum price.");
export const serviceUpdateSchema = serviceFieldsSchema.partial().refine(validServiceRange, "Minimum price cannot exceed maximum price.");
export const bookingCreateSchema = z.object({
  customerId: z.uuid(), propertyId: z.uuid().optional(), assetId: z.uuid().optional(), serviceId: z.uuid().optional(), branchId: z.uuid().optional(),
  urgency: z.enum(["LOW", "NORMAL", "HIGH", "EMERGENCY"]).default("NORMAL"), description: z.string().trim().min(5).max(5000), preferredAt: z.iso.datetime().optional(),
  latitude: locationSchema.latitude, longitude: locationSchema.longitude,
}).strict();
export const bookingTransitionSchema = z.object({ status: z.enum(["UNDER_REVIEW", "QUOTED", "AWAITING_APPROVAL", "APPROVED", "SCHEDULED", "ASSIGNED", "TECHNICIAN_EN_ROUTE", "IN_PROGRESS", "COMPLETED", "CANCELLED", "DISPUTED"]), note: z.string().trim().max(2000).optional(), scheduledAt: z.iso.datetime().optional(), assignedMemberId: z.uuid().nullable().optional() }).strict();
export const technicianBookingStatusSchema = z.object({ status: z.enum(["TECHNICIAN_EN_ROUTE", "IN_PROGRESS", "COMPLETED", "DISPUTED"]), note: z.string().trim().max(2000).optional() }).strict();
const quoteItemSchema = z.object({ description: z.string().trim().min(2).max(240), quantity: z.number().positive().max(100000), unitPrice: nonNegativeMoney, sortOrder: z.number().int().min(0).max(1000).optional() }).strict();
export const quoteCreateSchema = z.object({ items: z.array(quoteItemSchema).min(1).max(100), discount: nonNegativeMoney.default(0), tax: nonNegativeMoney.default(0), notes: z.string().trim().max(5000).optional(), validUntil: z.iso.datetime().optional() }).strict();
export const quoteDecisionSchema = z.object({ decision: z.enum(["ACCEPTED", "REJECTED"]), note: z.string().trim().max(2000).optional() }).strict();
export const invoiceCreateSchema = z.object({ dueAt: z.iso.datetime().optional() }).strict();
export const paymentCreateSchema = z.object({ amount: nonNegativeMoney.refine((value) => value > 0, "Payment amount must be greater than zero."), method: z.enum(["CASH", "BANK_TRANSFER", "CARD", "DIGITAL_WALLET", "OTHER"]), reference: z.string().trim().max(180).optional(), idempotencyKey: z.string().trim().min(8).max(120), note: z.string().trim().max(2000).optional() }).strict();
export const paymentDecisionSchema = z.object({ decision: z.enum(["VERIFIED", "REJECTED"]), note: z.string().trim().max(2000).optional() }).strict();
export const refundCreateSchema = z.object({ paymentId: z.uuid(), amount: nonNegativeMoney.refine((value) => value > 0, "Refund amount must be greater than zero."), reference: z.string().trim().max(180).optional(), reason: z.string().trim().min(3).max(500) }).strict();
export const invoiceVoidSchema = z.object({ reason: z.string().trim().min(3).max(500) }).strict();

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type CustomerCreateInput = z.infer<typeof customerCreateSchema>;
export type CustomerUpdateInput = z.infer<typeof customerUpdateSchema>;
