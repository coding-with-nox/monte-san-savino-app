export const ROLES = ["user", "staff", "judge", "manager", "admin"] as const;
export type Role = (typeof ROLES)[number];
const order: readonly Role[] = ROLES;
export function roleAtLeast(actual: Role, minimum: Role): boolean {
  return order.indexOf(actual) >= order.indexOf(minimum);
}
export function roleRank(role: Role): number {
  return order.indexOf(role);
}
