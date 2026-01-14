export type Role = "user" | "staff" | "judge" | "manager" | "admin";
const order: Role[] = ["user", "staff", "judge", "manager", "admin"];
export function roleAtLeast(actual: Role, minimum: Role): boolean {
  return order.indexOf(actual) >= order.indexOf(minimum);
}
