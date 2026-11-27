import { Elysia } from "elysia";
import { roleAtLeast, type Role } from "../../domain/Role";
import { authMiddleware } from "./auth.middleware";
import { tenantMiddleware } from "../../../tenancy/infra/http/tenant.middleware";
/** Allows only the listed roles (no hierarchy). Use it where a higher rank must not inherit access. */
export function requireAnyRole(roles: readonly Role[]) {
  return new Elysia()
    .use(tenantMiddleware)
    .use(authMiddleware)
    .onBeforeHandle(({ user, set }) => {
      if (!user?.id) {
        set.status = 401;
        return { error: "Unauthenticated" };
      }
      if (!roles.includes(user.role as Role)) {
        set.status = 403;
        return { error: "Forbidden" };
      }
    })
    .as("scoped");
}
export function requireRole(minimum: Role) {
  return new Elysia()
    .use(tenantMiddleware)
    .use(authMiddleware)
    .onBeforeHandle(({ user, set }) => {
      if (!user?.id) {
        set.status = 401;
        return { error: "Unauthenticated" };
      }
      if (!roleAtLeast(user.role as Role, minimum)) {
        set.status = 403;
        return { error: "Forbidden" };
      }
    })
    .as("scoped");
}
