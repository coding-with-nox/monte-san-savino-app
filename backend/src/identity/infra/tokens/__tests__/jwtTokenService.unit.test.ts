import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { SignJWT } from "jose";
import { JwtTokenService } from "../jwtTokenService";
import { assertRequiredEnv } from "../../../../bootstrap/assertRequiredEnv";

const p = { sub: "u1", email: "a@b.it", role: "admin", tenantId: "t1" };
const TEST_SECRET = "unit-test-secret-0123456789abcdef0123";
const originalSecret = process.env.JWT_SECRET;

beforeAll(() => { process.env.JWT_SECRET = TEST_SECRET; });
afterAll(() => {
  if (originalSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalSecret;
});

describe("JWT_SECRET is mandatory", () => {
  const cases: [string, string | undefined][] = [
    ["missing", undefined],
    ["empty", ""],
    ["whitespace only", "   \t "],
  ];
  for (const [label, value] of cases) {
    it(`throws when JWT_SECRET is ${label}`, async () => {
      if (value === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = value;
      try {
        await expect(new JwtTokenService().signAccess(p)).rejects.toThrow(/JWT_SECRET/);
        await expect(new JwtTokenService().verify("x.y.z")).rejects.toThrow(/JWT_SECRET/);
        expect(() => assertRequiredEnv()).toThrow(/JWT_SECRET/);
      } finally {
        process.env.JWT_SECRET = TEST_SECRET;
      }
    });
  }
  it("startup check passes when JWT_SECRET is set and does not leak it on failure", () => {
    expect(() => assertRequiredEnv()).not.toThrow();
    process.env.JWT_SECRET = "  ";
    try { assertRequiredEnv(); } catch (e) { expect(String(e)).not.toContain(TEST_SECRET); }
    finally { process.env.JWT_SECRET = TEST_SECRET; }
  });
});

describe("JwtTokenService", () => {
  const svc = new JwtTokenService();
  it("signs access tokens with tokenType=access and claims", async () => {
    const { token, expiresIn } = await svc.signAccess(p);
    const v = await svc.verify(token);
    expect(v.tokenType).toBe("access");
    expect(v.sub).toBe("u1");
    expect(v.role).toBe("admin");
    expect(expiresIn).toBeGreaterThan(0);
  });
  it("signs refresh tokens with longer ttl", async () => {
    const a = await svc.signAccess(p);
    const r = await svc.signRefresh(p);
    expect((await svc.verify(r.token)).tokenType).toBe("refresh");
    expect(r.expiresIn).toBeGreaterThan(a.expiresIn);
  });
  it("rejects garbage, tampered and expired tokens", async () => {
    await expect(svc.verify("garbage")).rejects.toThrow();
    const { token } = await svc.signAccess(p);
    await expect(svc.verify(token.slice(0, -2) + "xx")).rejects.toThrow();
    const expired = await new SignJWT({ ...p }).setProtectedHeader({ alg: "HS256" })
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(new TextEncoder().encode(TEST_SECRET));
    await expect(svc.verify(expired)).rejects.toThrow();
  });
  it("rejects tokens signed with another secret", async () => {
    const bad = await new SignJWT({ ...p }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("1h")
      .sign(new TextEncoder().encode("other-secret"));
    await expect(svc.verify(bad)).rejects.toThrow();
  });
});

describe("hardening", () => {
  it("rejects JWT_SECRET shorter than 32 chars", async () => {
    process.env.JWT_SECRET = "too-short";
    try {
      await expect(new JwtTokenService().signAccess(p)).rejects.toThrow(/32/);
      expect(() => assertRequiredEnv()).toThrow(/JWT_SECRET/);
    } finally { process.env.JWT_SECRET = TEST_SECRET; }
  });
  it("only accepts HS256 tokens", async () => {
    const hs512 = await new SignJWT({ ...p }).setProtectedHeader({ alg: "HS512" }).setExpirationTime("1h")
      .sign(new TextEncoder().encode(TEST_SECRET));
    await expect(new JwtTokenService().verify(hs512)).rejects.toThrow();
  });
  it("access token default TTL is 15 minutes, refresh 30 days", async () => {
    const svc = new JwtTokenService();
    expect((await svc.signAccess(p)).expiresIn).toBe(900);
    expect((await svc.signRefresh(p)).expiresIn).toBe(60 * 60 * 24 * 30);
  });
});
