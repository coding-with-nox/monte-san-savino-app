import { createContext, useContext } from "react";
import { Role } from "./auth";

/** What the backend grants to the current user (GET /settings/section-visibility), provided by App. */
export type Access = {
  /** null = unknown (loading or endpoint unavailable): fall back to the role-based behaviour. */
  sections: string[] | null;
  permissions: string[];
};

export type Permission = "enrollOnBehalf";

export const NO_ACCESS: Access = { sections: null, permissions: [] };

export const AccessContext = createContext<Access>(NO_ACCESS);

export const useAccess = () => useContext(AccessContext);

/** Admins always have every permission. */
export function hasPermission(role: Role | null, permissions: string[], permission: Permission) {
  return role === "admin" || (!!role && permissions.includes(permission));
}
