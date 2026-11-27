export const ROLES = ["user", "staff", "judge", "jury_president", "manager", "admin"] as const;
export type Role = (typeof ROLES)[number];
const order: readonly Role[] = ROLES;
export function roleAtLeast(actual: Role, minimum: Role): boolean {
  return order.indexOf(actual) >= order.indexOf(minimum);
}
/**
 * Roles that work at the front desk (check-in, presence, attendance). Not a rank: judges and the jury
 * president rank above staff but must never reach the desk, which shows participant identities.
 */
export const DESK_ROLES: readonly Role[] = ["staff", "manager", "admin"];
export function roleRank(role: Role): number {
  return order.indexOf(role);
}
