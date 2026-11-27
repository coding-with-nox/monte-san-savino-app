import { describe, it, expect } from "bun:test";
import { RefreshSession } from "../RefreshSession";
import { Email } from "../../domain/Email";
import { User } from "../../domain/User";
import type { UserRepository } from "../ports/UserRepository";
import type { TokenService } from "../ports/TokenService";

const repo = (u: User | null): UserRepository => ({ findByEmail: async () => null, findById: async () => u, save: async () => {} });
const tokens = (payload: any, signed: any[] = []): TokenService => ({
  signAccess: async (p) => { signed.push(p); return { token: "a", expiresIn: 900 }; },
  signRefresh: async (p) => { signed.push(p); return { token: "r", expiresIn: 1 }; },
  verify: async () => payload
});
const user = (active = true, role: any = "judge") => new User("u1", Email.create("a@b.it"), role, "h", active);
const refreshPayload = { tokenType: "refresh", sub: "u1", role: "admin", tenantId: "t1", iat: Math.floor(Date.now() / 1000) };

describe("RefreshSession", () => {
  it("uses the role from the DB, not from the old token", async () => {
    const signed: any[] = [];
    const r = await new RefreshSession(repo(user(true, "judge")), tokens(refreshPayload, signed)).execute("x");
    expect(r.role).toBe("judge");
    expect(signed.every((p) => p.role === "judge" && p.tenantId === "t1")).toBe(true);
  });
  it("rejects deactivated users", async () => {
    await expect(new RefreshSession(repo(user(false)), tokens(refreshPayload)).execute("x")).rejects.toThrow("Invalid refresh token");
  });
  it("rejects deleted users", async () => {
    await expect(new RefreshSession(repo(null), tokens(refreshPayload)).execute("x")).rejects.toThrow("Invalid refresh token");
  });
  it("rejects access tokens and unverifiable tokens", async () => {
    await expect(new RefreshSession(repo(user()), tokens({ ...refreshPayload, tokenType: "access" })).execute("x")).rejects.toThrow("Invalid refresh token");
    const bad: TokenService = { ...tokens(refreshPayload), verify: async () => { throw new Error("expired"); } };
    await expect(new RefreshSession(repo(user()), bad).execute("x")).rejects.toThrow("Invalid refresh token");
  });
});

const HOUR = 3600;
const nowSec = () => Math.floor(Date.now() / 1000);
/** Token service whose verify returns `payload` and that records every refresh token signed (payload + expiry options). */
const capturing = (payload: any) => {
  const refreshes: { payload: any; options?: { expiresAt?: number } }[] = [];
  const svc: TokenService = {
    signAccess: async () => ({ token: "a", expiresIn: 900 }),
    signRefresh: async (p, options) => { refreshes.push({ payload: p, options }); return { token: "r", expiresIn: 1 }; },
    verify: async () => payload
  };
  return { svc, refreshes };
};

describe("RefreshSession judge session cap", () => {
  const base = { tokenType: "refresh", sub: "u1" };

  it("judge within JUDGE_SESSION_HOURS: keeps the session start and caps the new refresh token", async () => {
    const sst = nowSec() - 23 * HOUR;
    const { svc, refreshes } = capturing({ ...base, sst });
    await new RefreshSession(repo(user(true, "judge")), svc, 24).execute("x");
    expect(refreshes[0].payload.sst).toBe(sst);
    expect(refreshes[0].options).toEqual({ expiresAt: sst + 24 * HOUR });
  });

  it("judge past the cap: refused with the same generic error, no token signed", async () => {
    const { svc, refreshes } = capturing({ ...base, sst: nowSec() - 25 * HOUR });
    await expect(new RefreshSession(repo(user(true, "judge")), svc, 24).execute("x")).rejects.toThrow("Invalid refresh token");
    expect(refreshes).toHaveLength(0);
  });

  it("the cap follows the configured hours", async () => {
    const { svc } = capturing({ ...base, sst: nowSec() - 2 * HOUR });
    await expect(new RefreshSession(repo(user(true, "judge")), svc, 1).execute("x")).rejects.toThrow("Invalid refresh token");
    await expect(new RefreshSession(repo(user(true, "judge")), svc, 3).execute("x")).resolves.toBeDefined();
  });

  it("other roles are not capped, and keep the carried session start", async () => {
    const sst = nowSec() - 30 * HOUR;
    const { svc, refreshes } = capturing({ ...base, sst });
    await new RefreshSession(repo(user(true, "user")), svc, 24).execute("x");
    expect(refreshes[0].options).toBeUndefined();
    expect(refreshes[0].payload.sst).toBe(sst);
  });

  it("old refresh tokens without sst use their iat as session start", async () => {
    const old = { ...base, iat: nowSec() - 25 * HOUR };
    await expect(new RefreshSession(repo(user(true, "judge")), capturing(old).svc, 24).execute("x")).rejects.toThrow("Invalid refresh token");

    const recentIat = nowSec() - HOUR;
    const { svc, refreshes } = capturing({ ...base, iat: recentIat });
    await new RefreshSession(repo(user(true, "judge")), svc, 24).execute("x");
    expect(refreshes[0].payload.sst).toBe(recentIat);
    expect(refreshes[0].options).toEqual({ expiresAt: recentIat + 24 * HOUR });
  });

  it("old non-judge tokens keep working and get an sst from their iat", async () => {
    const iat = nowSec() - 40 * HOUR;
    const { svc, refreshes } = capturing({ ...base, iat });
    await new RefreshSession(repo(user(true, "user")), svc, 24).execute("x");
    expect(refreshes[0].payload.sst).toBe(iat);
  });

  it("tokens with neither sst nor iat are rejected", async () => {
    await expect(new RefreshSession(repo(user(true, "user")), capturing({ ...base }).svc, 24).execute("x")).rejects.toThrow("Invalid refresh token");
  });
});
