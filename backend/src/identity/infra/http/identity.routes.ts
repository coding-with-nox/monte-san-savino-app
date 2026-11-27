import { Elysia, t } from "elysia";
import { RegisterUser } from "../../application/RegisterUser";
import { LoginWithPassword } from "../../application/LoginWithPassword";
import { AuthenticateUser } from "../../application/AuthenticateUser";
import { BcryptHasher } from "../crypto/bcryptHasher";
import { JwtTokenService } from "../tokens/jwtTokenService";
import { UserRepositoryDrizzle, isUniqueUsernameViolation } from "../persistence/userRepository.drizzle";
import { getTenantDbFromEnv } from "../../../tenancy/infra/tenantDbFactory";
import { tenantMiddleware } from "../../../tenancy/infra/http/tenant.middleware";
import { consumeAuthCode, createAuthCode } from "../tokens/pkceStore";
import { RefreshSession } from "../../application/RefreshSession";
import { judgeSessionHoursFromEnv, refreshCapFor } from "../../domain/judgeSession";
import { clientIp, createRateLimitGuard } from "../../../shared/infra/http/rateLimiter";
import crypto from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { logger } from "../../../shared/infra/logger/logger";
import { InvalidCredentialsError } from "../../domain/InvalidCredentialsError";
import { Email } from "../../domain/Email";
import { usersTable, passwordResetsTable } from "../persistence/schema";
import { isRegistrationClosed } from "../../../contest/infra/persistence/registrationSettings";
import { publicAppUrl } from "../../../contest/infra/http/class-print.routes";
import { normalizeUsername, UsernameTakenError } from "../../domain/username";
import {
  generateResetToken, hashResetToken, isResetTokenUsable, resetTokenExpiresAt
} from "../../domain/passwordReset";
import { EmailService } from "../../../shared/infra/email/emailService";
import { turnstileSecretFromEnv, verifyTurnstile } from "../captcha/turnstile";

/** Per-IP+email limiter for every credential endpoint (login, authorize, forgot/reset, register attempts). */
export const authRateLimit = createRateLimitGuard((body) => (typeof body?.email === "string" ? body.email.trim().toLowerCase() : ""));

export function resetAuthRateLimiter(now?: () => number) { authRateLimit.reset(now); }

const GENERIC_REGISTER_FAILURE = "Registration failed";

function base64Url(buffer: Buffer) {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function computePkceChallenge(verifier: string) {
  const hash = crypto.createHash("sha256").update(verifier).digest();
  return base64Url(hash);
}

function buildTokenResponse(accessToken: string, refreshToken: string, expiresIn: number, role: string) {
  return {
    accessToken,
    refreshToken,
    expiresIn,
    expires_in: expiresIn,
    role
  };
}

function remoteIpOf(request: Request, server: any): string | undefined {
  return clientIp({ "x-forwarded-for": request.headers.get("x-forwarded-for") ?? undefined }, server?.requestIP?.(request)?.address);
}

export const identityRoutes = new Elysia({ prefix: "/auth" })
  .use(tenantMiddleware)
  .post("/register", async ({ body, tenantDb, set, request, server }) => {
    const db = tenantDb ?? getTenantDbFromEnv();
    if (await isRegistrationClosed(db)) {
      set.status = 403;
      return { error: "Registration is closed", code: "REGISTRATION_CLOSED" };
    }
    if (body.password.length < 8) {
      set.status = 400;
      return { error: "Password must be at least 8 characters long" };
    }
    if (body.privacyAccepted !== true) {
      set.status = 400;
      return { error: "The privacy notice must be accepted" };
    }
    const username = normalizeUsername(body.username);
    if (!username.ok) {
      set.status = 400;
      return { error: username.error };
    }
    // Anti-bot: mandatory only when the Turnstile secret is configured.
    const turnstileSecret = turnstileSecretFromEnv();
    if (turnstileSecret) {
      const verified = body.turnstileToken
        ? await verifyTurnstile({ secret: turnstileSecret, token: body.turnstileToken, remoteIp: remoteIpOf(request, server) })
        : false;
      if (!verified) {
        set.status = 400;
        return { error: "Captcha verification failed", code: "CAPTCHA_FAILED" };
      }
    }
    try {
      const hasher = new BcryptHasher();
      const uc = new RegisterUser(new UserRepositoryDrizzle(db), hasher);
      const created = await uc.execute({ id: crypto.randomUUID(), email: body.email, password: body.password, username: username.value });
      // Accountability (GDPR art. 7/5.2): store when and which privacy notice version was acknowledged.
      await db.update(usersTable)
        .set({ privacyAcceptedAt: new Date(), privacyPolicyVersion: body.privacyVersion.slice(0, 32) })
        .where(eq(usersTable.id, created.id as any));
      return created;
    } catch (error) {
      if (error instanceof UsernameTakenError || isUniqueUsernameViolation(error)) {
        set.status = 409;
        return { error: "Username already taken", code: "USERNAME_TAKEN" };
      }
      const message = error instanceof Error ? error.message : GENERIC_REGISTER_FAILURE;
      if (message === "Email already registered") {
        // Do not reveal whether the email exists: answer like a success (the frontend then logs in,
        // which fails with the uniform "Invalid credentials" unless the password matches).
        await new BcryptHasher().hash(body.password); // equalize timing
        return { id: crypto.randomUUID(), email: body.email.trim().toLowerCase(), role: "user" };
      }
      set.status = 400;
      return { error: message };
    }
  }, {
    beforeHandle: authRateLimit,
    body: t.Object({
      email: t.String(),
      password: t.String(),
      privacyAccepted: t.Boolean(),
      privacyVersion: t.String({ minLength: 1, maxLength: 32 }),
      username: t.Optional(t.String({ maxLength: 100 })),
      turnstileToken: t.Optional(t.String({ maxLength: 2048 }))
    }),
    detail: {
      summary: "Registrazione utente",
      description: "Crea un nuovo account utente con ruolo `user` di default. `username` e' opzionale (3-30 caratteri [a-zA-Z0-9._-]). Con TURNSTILE_SECRET_KEY impostata, `turnstileToken` e' obbligatorio.",
      tags: ["Auth"]
    },
    response: {
      200: t.Object({ id: t.String(), email: t.String(), role: t.String() }),
      400: t.Object({ error: t.String(), code: t.Optional(t.String()) }),
      403: t.Object({ error: t.String(), code: t.String() }),
      409: t.Object({ error: t.String(), code: t.String() }),
      429: t.Object({ error: t.String() }),
      500: t.Object({ error: t.String() })
    }
  })
  .post("/login", async ({ body, tenantDb, set }) => {
    const db = tenantDb ?? getTenantDbFromEnv();
    try {
      const uc = new LoginWithPassword(new UserRepositoryDrizzle(db), new BcryptHasher(), new JwtTokenService());
      const result = await uc.execute(body);
      return buildTokenResponse(result.accessToken, result.refreshToken, result.expiresIn, result.role);
    } catch (error) {
      if (error instanceof InvalidCredentialsError) {
        // The client always gets the same generic error; the reason is for operators only (no email, no password).
        logger.warn({ reason: error.reason, ...error.detail }, "login rejected");
      }
      const message = error instanceof Error ? error.message : "Login failed";
      set.status = message.toLowerCase().includes("credentials") ? 401 : 400;
      return { error: message };
    }
  }, {
    beforeHandle: authRateLimit,
    body: t.Object({ email: t.String(), password: t.String() }),
    detail: {
      summary: "Login con password",
      description: "Restituisce un JWT da usare con `Authorization: Bearer <token>` e un refresh token. Il campo `email` accetta anche lo username (senza '@').",
      tags: ["Auth"]
    },
    response: {
      200: t.Object({ accessToken: t.String(), refreshToken: t.String(), expiresIn: t.Number(), expires_in: t.Number(), role: t.String() }),
      400: t.Object({ error: t.String() }),
      429: t.Object({ error: t.String() }),
      401: t.Object({ error: t.String() }),
      500: t.Object({ error: t.String() })
    }
  })
  .post("/authorize", async ({ body, tenantDb, set }) => {
    const db = tenantDb ?? getTenantDbFromEnv();
    if (body.code_challenge_method !== "S256") {
      set.status = 400;
      return { error: "Unsupported code challenge method" };
    }
    try {
      const uc = new AuthenticateUser(new UserRepositoryDrizzle(db), new BcryptHasher());
      const user = await uc.execute({ email: body.email, password: body.password });
      const code = createAuthCode({
        codeChallenge: body.code_challenge,
        user: { id: user.id, email: user.email.value, role: user.role, tenantId: user.tenantId ?? null }
      });
      return { code };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Authorization failed";
      set.status = message.toLowerCase().includes("credentials") ? 401 : 400;
      return { error: message };
    }
  }, {
    beforeHandle: authRateLimit,
    body: t.Object({
      email: t.String(),
      password: t.String(),
      code_challenge: t.String(),
      code_challenge_method: t.String()
    }),
    detail: {
      summary: "Avvia flusso PKCE",
      description: "Verifica credenziali e restituisce un codice di autorizzazione da scambiare con PKCE. Il campo `email` accetta anche lo username (senza '@').",
      tags: ["Auth"]
    },
    response: {
      200: t.Object({ code: t.String() }),
      400: t.Object({ error: t.String() }),
      429: t.Object({ error: t.String() }),
      401: t.Object({ error: t.String() }),
      500: t.Object({ error: t.String() })
    }
  })
  .post("/token", async ({ body, set }) => {
    if (body.code_verifier.length < 43 || body.code_verifier.length > 128) {
      set.status = 400;
      return { error: "Invalid code verifier length" };
    }
    const record = consumeAuthCode(body.code);
    if (!record) {
      set.status = 400;
      return { error: "Invalid or expired authorization code" };
    }
    const expectedChallenge = computePkceChallenge(body.code_verifier);
    if (expectedChallenge !== record.codeChallenge) {
      set.status = 400;
      return { error: "Invalid code verifier" };
    }
    const tokenService = new JwtTokenService();
    const access = await tokenService.signAccess({
      sub: record.user.id,
      email: record.user.email,
      role: record.user.role,
      tenantId: record.user.tenantId ?? undefined
    });
    const judgeSessionHours = judgeSessionHoursFromEnv();
    const refresh = await tokenService.signRefresh({
      sub: record.user.id,
      email: record.user.email,
      role: record.user.role,
      tenantId: record.user.tenantId ?? undefined,
      sst: record.sessionStart
    }, refreshCapFor(record.user.role, record.sessionStart, judgeSessionHours));
    return buildTokenResponse(access.token, refresh.token, access.expiresIn, record.user.role);
  }, {
    beforeHandle: authRateLimit,
    body: t.Object({
      code: t.String(),
      code_verifier: t.String()
    }),
    detail: {
      summary: "Scambia codice con token",
      description: "Conferma PKCE e restituisce access token + refresh token.",
      tags: ["Auth"]
    },
    response: {
      200: t.Object({ accessToken: t.String(), refreshToken: t.String(), expiresIn: t.Number(), expires_in: t.Number(), role: t.String() }),
      400: t.Object({ error: t.String() }),
      429: t.Object({ error: t.String() }),
      500: t.Object({ error: t.String() })
    }
  })
  .post("/refresh", async ({ body, tenantDb, set }) => {
    const db = tenantDb ?? getTenantDbFromEnv();
    try {
      const uc = new RefreshSession(new UserRepositoryDrizzle(db), new JwtTokenService());
      const r = await uc.execute(body.refreshToken);
      return buildTokenResponse(r.accessToken, r.refreshToken, r.expiresIn, r.role);
    } catch {
      set.status = 401;
      return { error: "Invalid refresh token" };
    }
  }, {
    body: t.Object({ refreshToken: t.String() }),
    detail: {
      summary: "Refresh token",
      description: "Restituisce un nuovo access token usando un refresh token valido.",
      tags: ["Auth"]
    },
    response: {
      200: t.Object({ accessToken: t.String(), refreshToken: t.String(), expiresIn: t.Number(), expires_in: t.Number(), role: t.String() }),
      401: t.Object({ error: t.String() }),
      500: t.Object({ error: t.String() })
    }
  })
  .post("/forgot-password", async ({ body, tenantDb }) => {
    const db = tenantDb ?? getTenantDbFromEnv();
    const now = Date.now();
    // Same answer whether or not the account exists (no enumeration).
    let address: Email | null = null;
    try {
      address = Email.create(body.email);
    } catch {
      address = null; // malformed address: treated like an unknown account
    }
    const user = address ? await new UserRepositoryDrizzle(db).findByEmail(address) : null;
    const account = user?.canLogin() ? { id: user.id, email: user.email.value } : null;
    if (!account) {
      await new BcryptHasher().hash(body.email); // equalize timing with the account path
      return { sent: true };
    }
    const token = generateResetToken();
    await db.transaction(async (tx: any) => {
      // Previous unused tokens of the account stop working.
      await tx.update(passwordResetsTable)
        .set({ usedAt: new Date(now) })
        .where(and(eq(passwordResetsTable.userId, account.id as any), isNull(passwordResetsTable.usedAt)));
      await tx.insert(passwordResetsTable).values({
        id: crypto.randomUUID(),
        userId: account.id as any,
        tokenHash: hashResetToken(token),
        expiresAt: resetTokenExpiresAt(now)
      });
    });
    await new BcryptHasher().hash(token); // equalize timing with the unknown-account path
    const link = `${publicAppUrl()}/reset-password?token=${encodeURIComponent(token)}`;
    // Sent in the background: the answer does not depend on the mail provider. Logs a warning when email is not configured.
    void new EmailService().sendPasswordResetLink({ to: account.email, link, lang: body.lang ?? "it" });
    return { sent: true };
  }, {
    beforeHandle: authRateLimit,
    body: t.Object({
      email: t.String(),
      lang: t.Optional(t.Union([t.Literal("it"), t.Literal("en"), t.Literal("es"), t.Literal("fr"), t.Literal("de")]))
    }),
    detail: {
      summary: "Password dimenticata: invia link di reset",
      description: "Risponde sempre `{ sent: true }`. Se l'account esiste e' attivo invia un link `${PUBLIC_APP_URL}/reset-password?token=...` valido 60 minuti (monouso).",
      tags: ["Auth"]
    },
    response: {
      200: t.Object({ sent: t.Boolean() }),
      429: t.Object({ error: t.String() })
    }
  })
  .post("/reset-password", async ({ body, tenantDb, set }) => {
    if (body.password.length < 8) {
      set.status = 400;
      return { error: "Password must be at least 8 characters long" };
    }
    const db = tenantDb ?? getTenantDbFromEnv();
    const now = new Date();
    const passwordHash = await new BcryptHasher().hash(body.password);
    const tokenHash = hashResetToken(body.token);
    const reset = await db.transaction(async (tx: any) => {
      const [row] = await tx.select().from(passwordResetsTable).where(eq(passwordResetsTable.tokenHash, tokenHash)).limit(1);
      if (!row || !isResetTokenUsable(row, now.getTime())) return false;
      // Claim the token atomically: a concurrent reset with the same token finds it already used.
      const [claimed] = await tx.update(passwordResetsTable)
        .set({ usedAt: now })
        .where(and(eq(passwordResetsTable.id, row.id), isNull(passwordResetsTable.usedAt)))
        .returning({ id: passwordResetsTable.id });
      if (!claimed) return false;
      // New password: every existing session (stolen refresh tokens included) ends now (SEC-06).
      await tx.update(usersTable).set({ passwordHash, sessionsRevokedAt: now }).where(eq(usersTable.id, row.userId));
      await tx.update(passwordResetsTable)
        .set({ usedAt: now })
        .where(and(eq(passwordResetsTable.userId, row.userId), isNull(passwordResetsTable.usedAt)));
      return true;
    });
    if (!reset) {
      set.status = 400;
      return { error: "Invalid or expired token", code: "INVALID_OR_EXPIRED_TOKEN" };
    }
    return { reset: true };
  }, {
    beforeHandle: authRateLimit,
    body: t.Object({
      token: t.String({ minLength: 1, maxLength: 200 }),
      password: t.String({ maxLength: 512 })
    }),
    detail: {
      summary: "Reimposta password con il token ricevuto via email",
      description: "Token monouso, valido 60 minuti. Con token mancante, scaduto o gia' usato risponde 400 `INVALID_OR_EXPIRED_TOKEN`.",
      tags: ["Auth"]
    },
    response: {
      200: t.Object({ reset: t.Boolean() }),
      400: t.Object({ error: t.String(), code: t.Optional(t.String()) }),
      429: t.Object({ error: t.String() })
    }
  });
