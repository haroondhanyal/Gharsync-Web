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
] as const;

export const ROLE_PERMISSION_KEYS: Record<OrganizationRole, string[]> = {
  OWNER: PERMISSIONS.map(({ key }) => key),
  ADMIN: PERMISSIONS.map(({ key }) => key),
  MANAGER: ["dashboard.read", "customers.read", "customers.create", "customers.update"],
  STAFF: ["dashboard.read", "customers.read"],
  TECHNICIAN: ["dashboard.read"],
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
