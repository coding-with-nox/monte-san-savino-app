import { describe, it, expect, beforeEach, afterAll } from "bun:test";
import { Elysia } from "elysia";
import { authRateLimit, resetAuthRateLimiter } from "../identity.routes";

const saved = { ...process.env };
afterAll(() => { for (const k of ["RATE_LIMIT_ENABLED", "RATE_LIMIT_MAX", "TRUST_PROXY"]) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } resetAuthRateLimiter(); });

let t = 0;
const app = new Elysia().post("/x", () => ({ ok: true }), { beforeHandle: authRateLimit });
const post = (email: string, headers: Record<string, string> = {}) =>
  app.handle(new Request("http://localhost/x", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify({ email }) }));

beforeEach(() => { t = 1_000_000; process.env.RATE_LIMIT_MAX = "2"; delete process.env.RATE_LIMIT_ENABLED; delete process.env.TRUST_PROXY; resetAuthRateLimiter(() => t); });

describe("authRateLimit", () => {
  it("returns 429 with Retry-After after the limit, per email", async () => {
    expect((await post("a@b.it")).status).toBe(200);
    expect((await post("A@b.it")).status).toBe(200);
    const res = await post("a@b.it");
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
    expect((await post("other@b.it")).status).toBe(200);
  });
  it("is disabled by RATE_LIMIT_ENABLED=false", async () => {
    process.env.RATE_LIMIT_ENABLED = "false"; resetAuthRateLimiter(() => t);
    for (let i = 0; i < 5; i++) expect((await post("a@b.it")).status).toBe(200);
  });
  it("uses X-Forwarded-For only with TRUST_PROXY=true", async () => {
    for (let i = 0; i < 2; i++) await post("a@b.it", { "x-forwarded-for": "1.1.1.1" });
    expect((await post("a@b.it", { "x-forwarded-for": "2.2.2.2" })).status).toBe(429); // header ignored
    process.env.TRUST_PROXY = "true"; resetAuthRateLimiter(() => t);
    for (let i = 0; i < 2; i++) await post("a@b.it", { "x-forwarded-for": "1.1.1.1" });
    expect((await post("a@b.it", { "x-forwarded-for": "2.2.2.2" })).status).toBe(200);
    expect((await post("a@b.it", { "x-forwarded-for": "1.1.1.1" })).status).toBe(429);
  });
});
