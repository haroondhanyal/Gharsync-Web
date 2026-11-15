import { OrganizationRole } from "../generated/prisma/enums.js";
import type { Prisma } from "../generated/prisma/client.js";

export const PERMISSIONS = [
  { key: "dashboard.read", description: "View the organization dashboard" },
  { key: "customers.read", description: "View customers and their service history" },
  { key: "customers.create", description: "Create customers" },
  { key: "customers.update", description: "Edit customers" },
  { key: "customers.delete", description: "Archive customers" },
  { key: "members.manage", description: "Invite and manage organization members" },
  { key: "organization.manage", description: "Manage organization settings and branches" },
  { key: "properties.read", description: "View customer properties" },
  { key: "properties.manage", description: "Create and update customer properties and assets" },
  { key: "documents.manage", description: "Upload and remove organization documents" },
  { key: "services.read", description: "View the service catalog" },
  { key: "services.manage", description: "Manage the service catalog" },
  { key: "bookings.read", description: "View service bookings and timelines" },
  { key: "bookings.create", description: "Create service bookings" },
  { key: "bookings.manage", description: "Manage booking workflow and assignments" },
  { key: "bookings.self_update", description: "Update the status of assigned technician jobs" },
  { key: "quotes.manage", description: "Prepare and manage quotations" },
  { key: "invoices.read", description: "View invoices and payment records" },
  { key: "invoices.manage", description: "Issue and void invoices" },
  { key: "payments.record", description: "Record customer payments for verification" },
  { key: "payments.verify", description: "Verify or reject recorded payments" },
  { key: "payments.refund", description: "Record refunds for verified payments" },
  { key: "workforce.read", description: "View technician skills, schedules and workload" },
  { key: "workforce.manage", description: "Manage technician profiles, availability and time off" },
  { key: "workforce.self_update", description: "Manage your own profile and request time off" },
  { key: "inventory.read", description: "View branch inventory and suppliers" },
  { key: "inventory.manage", description: "Manage products, stock movements and suppliers" },
  { key: "warranty.manage", description: "Manage warranty claims and outcomes" },
  { key: "ai.use", description: "Use and review human-approved AI draft assistance" },
  { key: "billing.read", description: "View subscription plan, usage and invoices" },
  { key: "billing.manage", description: "Manage subscription plan change requests" },
  { key: "notifications.manage", description: "Manage organization notification templates" },
] as const;

export const ROLE_PERMISSION_KEYS: Record<OrganizationRole, string[]> = {
  OWNER: PERMISSIONS.map(({ key }) => key),
  ADMIN: PERMISSIONS.map(({ key }) => key),
  MANAGER: ["dashboard.read", "customers.read", "customers.create", "customers.update", "properties.read", "properties.manage", "documents.manage", "services.read", "services.manage", "bookings.read", "bookings.create", "bookings.manage", "quotes.manage", "invoices.read", "invoices.manage", "payments.record", "payments.verify", "payments.refund", "workforce.read", "workforce.manage", "inventory.read", "inventory.manage", "warranty.manage", "ai.use", "billing.read", "notifications.manage"],
  STAFF: ["dashboard.read", "customers.read", "customers.create", "properties.read", "properties.manage", "documents.manage", "services.read", "bookings.read", "bookings.create", "bookings.manage", "quotes.manage", "invoices.read", "invoices.manage", "payments.record", "inventory.read", "warranty.manage"],
  TECHNICIAN: ["dashboard.read", "customers.read", "properties.read", "documents.manage", "services.read", "bookings.read", "bookings.self_update", "workforce.read", "workforce.self_update", "inventory.read"],
};

export async function ensureDefaultPermissions(tx: Prisma.TransactionClient) {
  const permissionIds = new Map<string, string>();
  for (const permission of PERMISSIONS) {
    const row = await tx.permission.upsert({ where: { key: permission.key }, create: permission, update: { description: permission.description } });
    permissionIds.set(permission.key, row.id);
  }
  for (const [role, keys] of Object.entries(ROLE_PERMISSION_KEYS) as [OrganizationRole, string[]][]) {
    for (const key of keys) {
      const permissionId = permissionIds.get(key)!;
      await tx.rolePermission.upsert({
        where: { role_permissionId: { role, permissionId } },
        create: { role, permissionId },
        update: {},
      });
    }
  }
}

export async function ensurePlatformCatalog(tx: Prisma.TransactionClient) {
  const plans = [
    { key: "FREE", name: "Free", description: "A clean start for a small local service team.", monthlyPrice: "0", annualPrice: "0", maxBranches: 2, maxStaff: 3, maxMonthlyJobs: 30, sortOrder: 0, features: ["Customer CRM", "Bookings and quotes", "Home passports", "Basic reports"] },
    { key: "STARTER", name: "Starter", description: "For growing local service businesses.", monthlyPrice: "4990", annualPrice: "49900", maxBranches: 2, maxStaff: 10, maxMonthlyJobs: 250, sortOrder: 1, features: ["Everything in Free", "Inventory and warranty", "Team scheduling", "Email support"] },
    { key: "GROWTH", name: "Growth", description: "More capacity for multi-branch operations.", monthlyPrice: "12990", annualPrice: "129900", maxBranches: 8, maxStaff: 50, maxMonthlyJobs: 2000, sortOrder: 2, features: ["Everything in Starter", "AI drafting assistant", "Advanced analytics", "Priority support"] },
    { key: "BUSINESS", name: "Business", description: "Flexible controls for established networks.", monthlyPrice: "29990", annualPrice: "299900", maxBranches: null, maxStaff: null, maxMonthlyJobs: null, sortOrder: 3, features: ["Everything in Growth", "Custom limits", "Platform onboarding", "Dedicated support"] },
  ];
  for (const plan of plans) await tx.subscriptionPlan.upsert({
    where: { key: plan.key },
    create: { ...plan, monthlyPrice: plan.monthlyPrice, annualPrice: plan.annualPrice },
    update: { name: plan.name, description: plan.description, monthlyPrice: plan.monthlyPrice, annualPrice: plan.annualPrice, maxBranches: plan.maxBranches, maxStaff: plan.maxStaff, maxMonthlyJobs: plan.maxMonthlyJobs, features: plan.features, sortOrder: plan.sortOrder },
  });
  const flags = [
    ["ai-assistant", "AI-assisted drafts are available to eligible plans"],
    ["whatsapp-delivery", "WhatsApp Business provider delivery integration"],
    ["push-delivery", "Web push notification delivery integration"],
  ] as const;
  for (const [key, description] of flags) await tx.featureFlag.upsert({ where: { key }, create: { key, description }, update: { description } });

  const organizationsWithoutPlan = await tx.organization.findMany({ where: { subscriptions: { none: {} } }, select: { id: true } });
  const freePlan = await tx.subscriptionPlan.findUnique({ where: { key: "FREE" }, select: { id: true } });
  if (freePlan && organizationsWithoutPlan.length) await tx.subscription.createMany({ data: organizationsWithoutPlan.map(({ id }) => ({ organizationId: id, planId: freePlan.id, status: "TRIAL" as const, periodEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) })) });
}
