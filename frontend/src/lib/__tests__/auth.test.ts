import { describe, it, expect, beforeEach } from "vitest";
import {
  clearToken,
  createCodeChallenge,
  decodeJwt,
  generateCodeVerifier,
  getRefreshToken,
  getRole,
  getToken,
  getTokenExpiresAt,
  roleAtLeast,
  setSession,
  type Role
} from "../auth";

function b64url(obj: unknown): string {
  return btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function makeJwt(payload: unknown): string {
  return `${b64url({ alg: "none" })}.${b64url(payload)}.sig`;
}

describe("auth session storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns null when nothing is stored", () => {
    expect(getToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(getTokenExpiresAt()).toBeNull();
  });

  it("stores tokens and computes the expiry from expiresIn seconds", () => {
    const before = Date.now();
    setSession("access", "refresh", 60);
    const after = Date.now();
    expect(getToken()).toBe("access");
    expect(getRefreshToken()).toBe("refresh");
    const exp = getTokenExpiresAt()!;
    expect(exp).toBeGreaterThanOrEqual(before + 60_000);
    expect(exp).toBeLessThanOrEqual(after + 60_000);
  });

  it("clearToken removes the whole session", () => {
    setSession("a", "r", 10);
    clearToken();
    expect(getToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(getTokenExpiresAt()).toBeNull();
  });
});

describe("decodeJwt", () => {
  it("decodes a base64url payload", () => {
    expect(decodeJwt(makeJwt({ role: "admin", sub: "1" }))).toEqual({ role: "admin", sub: "1" });
  });

  it("handles base64url characters and missing padding", () => {
    // "???>>>" style payloads produce '+' and '/' in plain base64
    const payload = { name: "???>>>~~~" };
    const token = makeJwt(payload);
    expect(decodeJwt(token)).toEqual(payload);
  });

  it("falls back to plain base64 JSON when the token has no dots", () => {
    expect(decodeJwt(btoa(JSON.stringify({ role: "judge" })))).toEqual({ role: "judge" });
  });

  it("returns an empty object for an undecodable dot-less token", () => {
    expect(decodeJwt("%%%not-base64%%%")).toEqual({});
  });

  it("returns an empty object for a malformed payload segment, like for dot-less tokens", () => {
    expect(decodeJwt("a.@@@.c")).toEqual({});
    expect(decodeJwt("a.bm90LWpzb24.c")).toEqual({});
    expect(decodeJwt("%%%not-base64%%%")).toEqual(decodeJwt("a.@@@.c"));
  });
});

describe("getRole", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("is null without a token", () => {
    expect(getRole()).toBeNull();
  });

  it("reads the role claim from the stored token", () => {
    setSession(makeJwt({ role: "manager" }), "r", 60);
    expect(getRole()).toBe("manager");
  });

  it("is null when the token has no role claim", () => {
    setSession(makeJwt({ sub: "x" }), "r", 60);
    expect(getRole()).toBeNull();
  });

  it("is null when the token is corrupt", () => {
    setSession("a.@@@.c", "r", 60);
    expect(getRole()).toBeNull();
  });
});

describe("roleAtLeast", () => {
  const order: Role[] = ["user", "staff", "judge", "manager", "admin"];

  it("respects the hierarchy for every pair", () => {
    order.forEach((actual, i) => {
      order.forEach((min, j) => {
        expect(roleAtLeast(actual, min)).toBe(i >= j);
      });
    });
  });

  it("admin satisfies everything, user only user", () => {
    expect(roleAtLeast("admin", "manager")).toBe(true);
    expect(roleAtLeast("user", "staff")).toBe(false);
  });
});

describe("PKCE helpers", () => {
  it("generates url-safe verifiers within the 43-128 byte bounds", () => {
    const short = generateCodeVerifier(1);
    const long = generateCodeVerifier(1000);
    expect(short).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(long).toMatch(/^[A-Za-z0-9_-]+$/);
    // base64url length of 43 bytes = 58 chars, of 128 bytes = 171 chars
    expect(short.length).toBe(58);
    expect(long.length).toBe(171);
  });

  it("generates different verifiers each time", () => {
    expect(generateCodeVerifier()).not.toBe(generateCodeVerifier());
  });

  it("creates the RFC 7636 S256 challenge", async () => {
    // Test vector from RFC 7636 appendix B
    const challenge = await createCodeChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk");
    expect(challenge).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });
});
