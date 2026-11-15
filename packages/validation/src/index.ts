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

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type CustomerCreateInput = z.infer<typeof customerCreateSchema>;
export type CustomerUpdateInput = z.infer<typeof customerUpdateSchema>;
