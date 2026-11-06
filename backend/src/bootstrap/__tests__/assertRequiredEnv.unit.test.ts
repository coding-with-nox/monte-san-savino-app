import { describe, it, expect } from "bun:test";
import { assertRequiredEnv } from "../assertRequiredEnv";

const jwt = "j".repeat(32);
const prod = { NODE_ENV: "production", JWT_SECRET: jwt, PG_PASSWORD: "pgs3cret", MINIO_ACCESS_KEY: "ak-real", MINIO_SECRET_KEY: "sk-real" };

describe("assertRequiredEnv", () => {
  it("rejects short JWT_SECRET without leaking it", () => {
    expect(() => assertRequiredEnv({ JWT_SECRET: "short" })).toThrow(/JWT_SECRET.*32/);
    try { assertRequiredEnv({ JWT_SECRET: "short" }); } catch (e) { expect(String(e)).not.toContain("short\""); }
    expect(() => assertRequiredEnv({ JWT_SECRET: jwt })).not.toThrow();
  });
  it("outside production does not require PG/MINIO secrets", () => {
    expect(() => assertRequiredEnv({ NODE_ENV: "development", JWT_SECRET: jwt })).not.toThrow();
  });
  it("production accepts strong values", () => {
    expect(() => assertRequiredEnv(prod)).not.toThrow();
  });
  for (const name of ["PG_PASSWORD", "MINIO_ACCESS_KEY", "MINIO_SECRET_KEY"] as const) {
    it(`production rejects missing ${name}`, () => {
      const env: any = { ...prod }; delete env[name];
      expect(() => assertRequiredEnv(env)).toThrow(new RegExp(name));
    });
    it(`production rejects known default ${name}`, () => {
      const weak = name === "PG_PASSWORD" ? "postgres" : "minioadmin";
      expect(() => assertRequiredEnv({ ...prod, [name]: weak })).toThrow(new RegExp(name));
    });
  }
});
