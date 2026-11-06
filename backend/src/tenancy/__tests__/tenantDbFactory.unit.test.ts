import { describe, it, expect } from "bun:test";
import { getTenantDbConfigFromEnv, getTenantDb } from "../infra/tenantDbFactory";

describe("getTenantDbConfigFromEnv", () => {
  it("uses defaults", () => {
    expect(getTenantDbConfigFromEnv({})).toEqual({ host: "localhost", port: 5432, database: "tenant_db_1", user: "postgres", password: "postgres" });
  });
  it("reads env overrides and coerces port", () => {
    const c = getTenantDbConfigFromEnv({ PG_HOST: "h", PG_PORT: "6543", PG_DB: "d", PG_USER: "u", PG_PASSWORD: "p" });
    expect(c).toEqual({ host: "h", port: 6543, database: "d", user: "u", password: "p" });
  });
});

describe("getTenantDb", () => {
  it("caches per host/port/db/user (lazy pool, no connection made)", () => {
    const cfg = { host: "x", port: 1, database: "d", user: "u", password: "p" };
    expect(getTenantDb(cfg)).toBe(getTenantDb({ ...cfg, password: "other" }));
    expect(getTenantDb(cfg)).not.toBe(getTenantDb({ ...cfg, database: "d2" }));
  });
});
