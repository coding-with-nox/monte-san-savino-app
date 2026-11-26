import { eq } from "drizzle-orm";
import { settingsTable } from "../../../contest/infra/persistence/schema";
import { parseRolePermissions, type Permission, type RolePermissions } from "../../domain/permissions";
import type { Role } from "../../domain/Role";

export const ROLE_PERMISSIONS_KEY = "rolePermissions";

export async function loadRolePermissions(db: any): Promise<RolePermissions> {
  const [row] = await db
    .select({ value: settingsTable.value })
    .from(settingsTable)
    .where(eq(settingsTable.key, ROLE_PERMISSIONS_KEY))
    .limit(1);
  return parseRolePermissions(row?.value);
}

export async function hasPermission(db: any, role: string | undefined, permission: Permission): Promise<boolean> {
  const permissions = await loadRolePermissions(db);
  return permissions[role as Role]?.includes(permission) ?? false;
}

export const permissionDenied = { error: "Forbidden", code: "PERMISSION_DENIED" };

/** beforeHandle: 403 unless the caller's role holds the permission. */
export function requirePermission(permission: Permission) {
  return async ({ tenantDb, user, set }: any) => {
    if (!(await hasPermission(tenantDb, user?.role, permission))) {
      set.status = 403;
      return permissionDenied;
    }
  };
}
