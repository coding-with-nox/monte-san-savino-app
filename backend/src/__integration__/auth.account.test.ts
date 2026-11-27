import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { createUser, request, resetDb } from "./fixtures";
import { getTestDb } from "./testDb";
import { eq } from "drizzle-orm";
import { usersTable, userProfilesTable, passwordResetsTable } from "../identity/infra/persistence/schema";
import { hashResetToken } from "../identity/domain/passwordReset";
import { BcryptHasher } from "../identity/infra/crypto/bcryptHasher";
import { setTurnstileVerifier } from "../identity/infra/captcha/turnstile";
import { EmailService } from "../shared/infra/email/emailService";
import { publicAppUrl } from "../contest/infra/http/class-print.routes";

const PASSWORD = "password123";
const VALID_TOKEN = "valid-reset-token-0123456789abcdefghijklmnop";
const EXPIRED_TOKEN = "expired-reset-token-0123456789abcdefghijklmn";
const LONG = 20_000;

const register = (body: Record<string, unknown>) =>
  request("POST", "/auth/register", undefined, { privacyAccepted: true, privacyVersion: "2026-11-27", password: PASSWORD, ...body });

const login = (email: string, password = PASSWORD) => request("POST", "/auth/login", undefined, { email, password });

/** Captures the reset link instead of sending mail (no RESEND call in tests). */
let sentLinks: { to: string; link: string }[] = [];
const originalSend = EmailService.prototype.sendPasswordResetLink;
const originalEnv = { secret: process.env.TURNSTILE_SECRET_KEY, site: process.env.TURNSTILE_SITE_KEY };

beforeEach(async () => {
  await resetDb();
  await getTestDb().delete(passwordResetsTable);
  sentLinks = [];
  EmailService.prototype.sendPasswordResetLink = async function (params) {
    sentLinks.push({ to: params.to, link: params.link });
    return true;
  };
  delete process.env.TURNSTILE_SECRET_KEY;
  delete process.env.TURNSTILE_SITE_KEY;
  setTurnstileVerifier();
});

afterEach(() => {
  EmailService.prototype.sendPasswordResetLink = originalSend;
  setTurnstileVerifier();
  if (originalEnv.secret === undefined) delete process.env.TURNSTILE_SECRET_KEY; else process.env.TURNSTILE_SECRET_KEY = originalEnv.secret;
  if (originalEnv.site === undefined) delete process.env.TURNSTILE_SITE_KEY; else process.env.TURNSTILE_SITE_KEY = originalEnv.site;
});

describe("integration username on registration and login", () => {
  it("registers with a username and stores it", async () => {
    const res = await register({ email: "mario@example.com", username: "Mario.Rossi" });
    expect(res.status).toBe(200);
    const [row] = await getTestDb().select().from(usersTable).where(eq(usersTable.email, "mario@example.com"));
    expect(row.username).toBe("Mario.Rossi");
  }, LONG);

  it("answers 409 USERNAME_TAKEN for the same username in any case", async () => {
    expect((await register({ email: "first@example.com", username: "mario_rossi" })).status).toBe(200);
    const dup = await request("POST", "/auth/register", undefined, {
      email: "second@example.com", password: PASSWORD, privacyAccepted: true, privacyVersion: "2026-11-27", username: "MARIO_ROSSI"
    });
    expect(dup.status).toBe(409);
    expect(dup.json.code).toBe("USERNAME_TAKEN");
    const rows = await getTestDb().select().from(usersTable).where(eq(usersTable.email, "second@example.com"));
    expect(rows).toHaveLength(0);
  }, LONG);

  it("refuses an invalid username with 400", async () => {
    const res = await register({ email: "bad@example.com", username: "no@at" });
    expect(res.status).toBe(400);
    expect(res.json.error).toContain("@");
  }, LONG);

  it("logs in with the username (case-insensitive) in the email field", async () => {
    await register({ email: "login@example.com", username: "painter.one" });
    const ok = await login("PAINTER.one");
    expect(ok.status).toBe(200);
    expect(typeof ok.json.accessToken).toBe("string");
  }, LONG);

  it("answers the uniform Invalid credentials for a wrong password or an unknown username", async () => {
    await register({ email: "uniform@example.com", username: "uniform_user" });
    const wrongPassword = await login("uniform_user", "wrong-password");
    const unknown = await login("nobody_here");
    expect(wrongPassword.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrongPassword.json).toEqual({ error: "Invalid credentials" });
    expect(unknown.json).toEqual({ error: "Invalid credentials" });
  }, LONG);

  it("accepts the username on the PKCE authorize endpoint too", async () => {
    await register({ email: "pkce@example.com", username: "pkce_user" });
    const res = await request("POST", "/auth/authorize", undefined, {
      email: "pkce_user", password: PASSWORD,
      code_challenge: "challenge", code_challenge_method: "S256"
    });
    expect(res.status).toBe(200);
    expect(typeof res.json.code).toBe("string");
  }, LONG);
});

describe("integration username on the profile endpoints", () => {
  it("GET and PUT /users/profile expose and update the username, 409 on duplicates", async () => {
    const me = await createUser("user");
    const other = await createUser("user");
    const put = await request("PUT", "/users/profile", me.token, { username: "fresh_name" });
    expect(put.status).toBe(200);
    expect((await request("GET", "/users/profile", me.token)).json.username).toBe("fresh_name");
    const clash = await request("PUT", "/users/profile", other.token, { username: "FRESH_NAME" });
    expect(clash.status).toBe(409);
    expect(clash.json.code).toBe("USERNAME_TAKEN");
    const cleared = await request("PUT", "/users/profile", me.token, { username: null });
    expect(cleared.status).toBe(200);
    expect((await request("GET", "/users/profile", me.token)).json.username).toBeNull();
  }, LONG);

  it("admin profile endpoints read and set the username", async () => {
    const manager = await createUser("manager");
    const target = await createUser("user");
    const other = await createUser("user");
    const set = await request("PUT", `/admin/users/${target.id}/profile`, manager.token, { username: "admin_set" });
    expect(set.status).toBe(200);
    expect((await request("GET", `/admin/users/${target.id}/profile`, manager.token)).json.username).toBe("admin_set");
    const clash = await request("PUT", `/admin/users/${other.id}/profile`, manager.token, { username: "admin_set" });
    expect(clash.status).toBe(409);
  }, LONG);
});

describe("integration forgotten password", () => {
  let resetUser: { id: string; email: string };

  beforeEach(async () => {
    const user = await createUser("user");
    await getTestDb().update(usersTable)
      .set({ passwordHash: await new BcryptHasher().hash(PASSWORD) })
      .where(eq(usersTable.id, user.id));
    await getTestDb().insert(passwordResetsTable).values([
      { id: crypto.randomUUID(), userId: user.id, tokenHash: hashResetToken(VALID_TOKEN), expiresAt: new Date(Date.now() + 60 * 60_000) },
      { id: crypto.randomUUID(), userId: user.id, tokenHash: hashResetToken(EXPIRED_TOKEN), expiresAt: new Date(Date.now() - 60_000) }
    ]);
    resetUser = { id: user.id, email: user.email };
  });

  it("answers { sent: true } for known and unknown emails alike, and sends a link only for known accounts", async () => {
    const user = resetUser;
    const known = await request("POST", "/auth/forgot-password", undefined, { email: user.email });
    const unknown = await request("POST", "/auth/forgot-password", undefined, { email: "nobody@example.com" });
    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(known.json).toEqual({ sent: true });
    expect(unknown.json).toEqual({ sent: true });
    expect(sentLinks).toHaveLength(1);
    expect(sentLinks[0].to).toBe(user.email);
    expect(sentLinks[0].link.startsWith(`${publicAppUrl()}/reset-password?token=`)).toBe(true);
  }, LONG);

  it("invalidates the previous unused token when a new one is issued", async () => {
    const user = resetUser;
    await request("POST", "/auth/forgot-password", undefined, { email: user.email });
    const first = new URL(sentLinks[0].link).searchParams.get("token")!;
    await request("POST", "/auth/forgot-password", undefined, { email: user.email });
    const second = new URL(sentLinks[1].link).searchParams.get("token")!;
    expect((await request("POST", "/auth/reset-password", undefined, { token: first, password: "brandnew1" })).status).toBe(400);
    expect((await request("POST", "/auth/reset-password", undefined, { token: second, password: "brandnew1" })).status).toBe(200);
  }, LONG);

  it("resets the password with a valid token once: the token is then used", async () => {
    const user = resetUser;
    const res = await request("POST", "/auth/reset-password", undefined, { token: VALID_TOKEN, password: "newpassword1" });
    expect(res.status).toBe(200);
    expect((await login(user.email, "newpassword1")).status).toBe(200);
    expect((await login(user.email, PASSWORD)).status).toBe(401);
    const again = await request("POST", "/auth/reset-password", undefined, { token: VALID_TOKEN, password: "anotherpass1" });
    expect(again.status).toBe(400);
    expect(again.json.code).toBe("INVALID_OR_EXPIRED_TOKEN");
  }, LONG);

  it("refuses an expired token and an unknown token with INVALID_OR_EXPIRED_TOKEN", async () => {
    const expired = await request("POST", "/auth/reset-password", undefined, { token: EXPIRED_TOKEN, password: "newpassword1" });
    const unknown = await request("POST", "/auth/reset-password", undefined, { token: "never-issued", password: "newpassword1" });
    expect(expired.status).toBe(400);
    expect(expired.json.code).toBe("INVALID_OR_EXPIRED_TOKEN");
    expect(unknown.status).toBe(400);
    expect(unknown.json.code).toBe("INVALID_OR_EXPIRED_TOKEN");
  }, LONG);

  it("requires a password of at least 8 characters", async () => {
    const res = await request("POST", "/auth/reset-password", undefined, { token: VALID_TOKEN, password: "short" });
    expect(res.status).toBe(400);
    expect(res.json.error).toContain("8");
  }, LONG);
});

describe("integration Turnstile on self registration", () => {
  it("requires a valid token when TURNSTILE_SECRET_KEY is set (verifier mocked)", async () => {
    process.env.TURNSTILE_SECRET_KEY = "test-secret";
    const seen: { secret: string; token: string }[] = [];
    setTurnstileVerifier(async (input) => { seen.push({ secret: input.secret, token: input.token }); return input.token === "good-token"; });

    const missing = await register({ email: "captcha1@example.com" });
    expect(missing.status).toBe(400);
    expect(missing.json.code).toBe("CAPTCHA_FAILED");

    const rejected = await register({ email: "captcha2@example.com", turnstileToken: "bad-token" });
    expect(rejected.status).toBe(400);
    expect(rejected.json.code).toBe("CAPTCHA_FAILED");

    const notCreated = await getTestDb().select().from(usersTable).where(eq(usersTable.email, "captcha2@example.com"));
    expect(notCreated).toHaveLength(0);

    const ok = await register({ email: "captcha3@example.com", turnstileToken: "good-token" });
    expect(ok.status).toBe(200);
    // A missing token is refused without calling Cloudflare; the two real attempts were verified.
    expect(seen).toEqual([
      { secret: "test-secret", token: "bad-token" },
      { secret: "test-secret", token: "good-token" }
    ]);
  }, LONG);

  it("skips the check when no secret is configured", async () => {
    let calls = 0;
    setTurnstileVerifier(async () => { calls += 1; return false; });
    const res = await register({ email: "nocaptcha@example.com" });
    expect(res.status).toBe(200);
    expect(calls).toBe(0);
  }, LONG);

  it("exposes turnstileSiteKey on GET /public/registration (null when unset)", async () => {
    expect((await request("GET", "/public/registration")).json.turnstileSiteKey).toBeNull();
    process.env.TURNSTILE_SITE_KEY = "0x4AAAA-site";
    expect((await request("GET", "/public/registration")).json.turnstileSiteKey).toBe("0x4AAAA-site");
  });
});
