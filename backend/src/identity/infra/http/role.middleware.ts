import { Elysia } from "elysia";
import { roleAtLeast, type Role } from "../../domain/Role";
export function requireRole(minimum: Role) {
  return new Elysia().onBeforeHandle(({ user, set }) => {
    if (!user) { set.status = 401; return { error: "Unauthenticated" }; }
    if (!roleAtLeast(user.role as Role, minimum)) { set.status = 403; return { error: "Forbidden" }; }
  });
}
