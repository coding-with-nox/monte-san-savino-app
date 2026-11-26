import { ROLES, type Role } from "./Role";

/** Stable keys of the actions the admin can switch on/off per role. */
export const PERMISSIONS = ["enrollOnBehalf"] as const;
export type Permission = (typeof PERMISSIONS)[number];
export type RolePermissions = Record<Role, Permission[]>;

export const DEFAULT_ROLE_PERMISSIONS: RolePermissions = {
  user: [],
  staff: [],
  judge: [],
  jury_president: [],
  manager: ["enrollOnBehalf"],
  admin: [...PERMISSIONS]
};

/** Merges the stored JSON over the defaults; unknown roles/permissions are ignored. Admin always has every permission. */
export function parseRolePermissions(value: string | null | undefined): RolePermissions {
  let stored: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(value ?? "");
    if (parsed && typeof parsed === "object") stored = parsed;
  } catch {
    // missing or malformed setting: defaults
  }
  const out = {} as RolePermissions;
  for (const role of ROLES) {
    const list = stored[role];
    out[role] = role !== "admin" && Array.isArray(list)
      ? PERMISSIONS.filter((p) => list.includes(p))
      : [...DEFAULT_ROLE_PERMISSIONS[role]];
  }
  return out;
}
