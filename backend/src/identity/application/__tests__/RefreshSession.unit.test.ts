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
const refreshPayload = { tokenType: "refresh", sub: "u1", role: "admin", tenantId: "t1" };

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
