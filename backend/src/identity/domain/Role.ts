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
/**
 * Roles that vote (judge routes, judge assignments). The jury president supervises the judges and
 * pushes them to revisit unbalanced votes, but never votes: it is not in this list.
 */
export const VOTING_ROLES: readonly Role[] = ["judge", "manager", "admin"];
export function roleRank(role: Role): number {
  return order.indexOf(role);
}
