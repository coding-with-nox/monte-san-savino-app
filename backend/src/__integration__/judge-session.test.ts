import { describe, it, expect, beforeEach, afterAll } from "bun:test";
import { decodeJwt, SignJWT } from "jose";
import { eq } from "drizzle-orm";
import { createUser, request, resetDb } from "./fixtures";
import { getTestDb } from "./testDb";
import { usersTable } from "../identity/infra/persistence/schema";
import { JwtTokenService } from "../identity/infra/tokens/jwtTokenService";

const HOUR = 3600;
const nowSec = () => Math.floor(Date.now() / 1000);
const PASSWORD = "password123";
/** Claims of a refresh token: `sst` is our session start, the rest are standard JWT claims. */
const decode = (token: string) => decodeJwt(token) as { sst?: number; iat?: number; exp?: number };

/** Registers a user, sets its DB role, and logs in through the password endpoint. */
async function loginAs(role: "user" | "judge") {
  const email = `${role}-session-${crypto.randomUUID()}@example.com`;
  await request("POST", "/auth/register", undefined, { email, password: PASSWORD, privacyAccepted: true, privacyVersion: "test" });
  if (role !== "user") await getTestDb().update(usersTable).set({ role }).where(eq(usersTable.email, email));
  const res = await request("POST", "/auth/login", undefined, { email, password: PASSWORD });
  expect(res.status).toBe(200);
  return { email, refreshToken: res.json.refreshToken as string, id: (await getTestDb().select().from(usersTable).where(eq(usersTable.email, email)))[0].id as string };
}

/** Refresh token signed with the same secret as the server, with a chosen session start (sst) or issue time (iat). */
async function refreshTokenFor(user: { id: string; email: string }, role: string, claims: { sst?: number; iat?: number }) {
  if (claims.sst !== undefined) {
    return (await new JwtTokenService().signRefresh({ sub: user.id, email: user.email, role, sst: claims.sst })).token;
  }
  return new SignJWT({ sub: user.id, email: user.email, role, tokenType: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(claims.iat)
    .setExpirationTime(nowSec() + 30 * 24 * HOUR)
    .sign(new TextEncoder().encode(process.env.JWT_SECRET!));
}

const refresh = (refreshToken: string) => request("POST", "/auth/refresh", undefined, { refreshToken });

describe("integration judge session (JUDGE_SESSION_HOURS, default 24)", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { delete process.env.JUDGE_SESSION_HOURS; await resetDb(); });

  it("a judge logs in once and refreshes within the session; sst is carried and the expiry is capped", async () => {
    const judge = await loginAs("judge");
    const first = decode(judge.refreshToken);
    expect(typeof first.sst).toBe("number");
    expect(first.exp! - first.sst!).toBeLessThanOrEqual(24 * HOUR);

    const res = await refresh(judge.refreshToken);
    expect(res.status).toBe(200);
    expect(res.json.role).toBe("judge");
    const next = decode(res.json.refreshToken);
    expect(next.sst).toBe(first.sst);
    expect(next.exp).toBeLessThanOrEqual(first.sst! + 24 * HOUR);
  });

  it("24 hours after the login the judge must log in again: refresh answers 401", async () => {
    const judge = await loginAs("judge");
    const expired = await refreshTokenFor(judge, "judge", { sst: nowSec() - 25 * HOUR });
    const res = await refresh(expired);
    expect(res.status).toBe(401);
    expect(res.json.error).toBe("Invalid refresh token");
  });

  it("JUDGE_SESSION_HOURS changes the cap", async () => {
    const judge = await loginAs("judge");
    const threeHoursAgo = await refreshTokenFor(judge, "judge", { sst: nowSec() - 3 * HOUR });
    process.env.JUDGE_SESSION_HOURS = "2";
    try {
      expect((await refresh(threeHoursAgo)).status).toBe(401);
    } finally {
      delete process.env.JUDGE_SESSION_HOURS;
    }
    expect((await refresh(threeHoursAgo)).status).toBe(200);
  });

  it("old judge refresh tokens without sst count from their issue time", async () => {
    const judge = await loginAs("judge");
    const oldIat = await refreshTokenFor(judge, "judge", { iat: nowSec() - 25 * HOUR });
    expect((await refresh(oldIat)).status).toBe(401);

    const recentIat = await refreshTokenFor(judge, "judge", { iat: nowSec() - HOUR });
    const res = await refresh(recentIat);
    expect(res.status).toBe(200);
    expect(decode(res.json.refreshToken).sst).toBe(decode(recentIat).iat);
  });

  it("other roles are not capped: an old session keeps refreshing, sst is carried", async () => {
    const user = await loginAs("user");
    const sst = nowSec() - 30 * HOUR;
    const old = await refreshTokenFor({ id: user.id, email: user.email }, "user", { sst });
    const res = await refresh(old);
    expect(res.status).toBe(200);
    const next = decode(res.json.refreshToken);
    expect(next.sst).toBe(sst);
    expect(next.exp! - nowSec()).toBeGreaterThan(6 * 24 * HOUR);
  });

  it("a judge deleted after login is refused", async () => {
    const judge = await createUser("judge");
    const token = await refreshTokenFor(judge, "judge", { sst: nowSec() - HOUR });
    await getTestDb().delete(usersTable).where(eq(usersTable.id, judge.id));
    expect((await refresh(token)).status).toBe(401);
  });
});
