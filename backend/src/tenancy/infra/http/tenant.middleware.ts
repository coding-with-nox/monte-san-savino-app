import { Elysia } from "elysia";
import { getTenantDbFromEnv } from "../tenantDbFactory";

export const tenantMiddleware = new Elysia({ name: "tenant" }).derive(async () => {
  return { tenantDb: getTenantDbFromEnv() };
});
