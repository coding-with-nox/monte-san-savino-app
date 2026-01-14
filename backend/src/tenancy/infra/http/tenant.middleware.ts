import { Elysia } from "elysia";
import { getTenantDb } from "../tenantDbFactory";

export const tenantMiddleware = new Elysia({ name: "tenant" }).derive(async () => {
  const cfg = {
    host: process.env.PG_HOST ?? "localhost",
    port: Number(process.env.PG_PORT ?? "5432"),
    database: process.env.PG_DB ?? "tenant_db_1",
    user: process.env.PG_USER ?? "postgres",
    password: process.env.PG_PASSWORD ?? "postgres"
  };
  return { tenantDb: getTenantDb(cfg) };
});
