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
