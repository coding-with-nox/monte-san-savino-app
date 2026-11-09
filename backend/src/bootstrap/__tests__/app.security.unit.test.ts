import { describe, it, expect } from "bun:test";
import { Elysia } from "elysia";
import { isSwaggerEnabled, resolveCorsOrigin, SECURITY_HEADERS } from "../app";

describe("swagger/cors policy", () => {
  it("swagger gating", () => {
    expect(isSwaggerEnabled({ NODE_ENV: "production" })).toBe(false);
    expect(isSwaggerEnabled({ NODE_ENV: "production", ENABLE_SWAGGER: "true" })).toBe(true);
    expect(isSwaggerEnabled({ NODE_ENV: "development" })).toBe(true);
    expect(isSwaggerEnabled({})).toBe(true);
  });
  it("cors origin policy", () => {
    expect(resolveCorsOrigin({ NODE_ENV: "production", CORS_ORIGIN: "" })).toBeNull();
    expect(resolveCorsOrigin({ NODE_ENV: "production" })).toBeNull();
    expect(resolveCorsOrigin({ NODE_ENV: "production", CORS_ORIGIN: "https://a.it, https://b.it" })).toEqual(["https://a.it", "https://b.it"]);
    expect(resolveCorsOrigin({ NODE_ENV: "development" })).toBe(true);
  });
  it("security headers hook keeps handler content-type", async () => {
    const app = new Elysia()
      .onRequest(({ set }) => { Object.assign(set.headers, SECURITY_HEADERS); })
      .get("/h", ({ set }) => { set.headers["content-type"] = "text/html; charset=utf-8"; return "<p>x</p>"; })
      .get("/j", () => ({ ok: true }));
    const h = await app.handle(new Request("http://localhost/h"));
    expect(h.headers.get("content-type")).toContain("text/html");
    expect(h.headers.get("x-content-type-options")).toBe("nosniff");
    expect(h.headers.get("referrer-policy")).toBe("no-referrer");
    const nf = await app.handle(new Request("http://localhost/missing"));
    expect(nf.headers.get("x-content-type-options")).toBe("nosniff");
  });
});
