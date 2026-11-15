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
] as const;

export const ROLE_PERMISSION_KEYS: Record<OrganizationRole, string[]> = {
  OWNER: PERMISSIONS.map(({ key }) => key),
  ADMIN: PERMISSIONS.map(({ key }) => key),
  MANAGER: ["dashboard.read", "customers.read", "customers.create", "customers.update", "properties.read", "properties.manage", "documents.manage", "services.read", "services.manage", "bookings.read", "bookings.create", "bookings.manage", "quotes.manage", "invoices.read", "invoices.manage", "payments.record", "payments.verify", "payments.refund", "workforce.read", "workforce.manage", "inventory.read", "inventory.manage", "warranty.manage"],
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
