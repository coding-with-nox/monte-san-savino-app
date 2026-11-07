import { describe, it, expect } from "bun:test";
import { getTenantDbConfigFromEnv, getTenantDb, getPoolTuningFromEnv } from "../infra/tenantDbFactory";

describe("getTenantDbConfigFromEnv", () => {
  it("uses dev defaults outside production", () => {
    expect(getTenantDbConfigFromEnv({})).toEqual({ host: "localhost", port: 5432, database: "tenant_db_1", user: "postgres", password: "postgres" });
  });
  it("in production requires a non-default PG_PASSWORD", () => {
    expect(() => getTenantDbConfigFromEnv({ NODE_ENV: "production" })).toThrow(/PG_PASSWORD/);
    expect(() => getTenantDbConfigFromEnv({ NODE_ENV: "production", PG_PASSWORD: "postgres" })).toThrow(/PG_PASSWORD/);
    expect(getTenantDbConfigFromEnv({ NODE_ENV: "production", PG_PASSWORD: "s3cret" }).password).toBe("s3cret");
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

describe("getPoolTuningFromEnv", () => {
  it("defaults", () => {
    expect(getPoolTuningFromEnv({})).toEqual({ max: 10, idleTimeoutMillis: 30000, connectionTimeoutMillis: 10000 });
  });
  it("reads overrides", () => {
    expect(getPoolTuningFromEnv({ PG_POOL_MAX: "25", PG_POOL_IDLE_TIMEOUT_MS: "5000", PG_POOL_CONNECTION_TIMEOUT_MS: "2000" }))
      .toEqual({ max: 25, idleTimeoutMillis: 5000, connectionTimeoutMillis: 2000 });
  });
  it("ignores invalid values", () => {
    expect(getPoolTuningFromEnv({ PG_POOL_MAX: "0", PG_POOL_IDLE_TIMEOUT_MS: "abc", PG_POOL_CONNECTION_TIMEOUT_MS: "-1" }))
      .toEqual({ max: 10, idleTimeoutMillis: 30000, connectionTimeoutMillis: 10000 });
  });
});
