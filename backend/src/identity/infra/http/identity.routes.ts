import { Elysia, t } from "elysia";
import { RegisterUser } from "../../application/RegisterUser";
import { LoginWithPassword } from "../../application/LoginWithPassword";
import { AuthenticateUser } from "../../application/AuthenticateUser";
import { BcryptHasher } from "../crypto/bcryptHasher";
import { JwtTokenService } from "../tokens/jwtTokenService";
import { UserRepositoryDrizzle } from "../persistence/userRepository.drizzle";
import { getTenantDbFromEnv } from "../../../tenancy/infra/tenantDbFactory";
import { tenantMiddleware } from "../../../tenancy/infra/http/tenant.middleware";
import { consumeAuthCode, createAuthCode } from "../tokens/pkceStore";
import { RefreshSession } from "../../application/RefreshSession";
import { clientIp, rateLimiterFromEnv, type SlidingWindowRateLimiter } from "../../../shared/infra/http/rateLimiter";
import crypto from "node:crypto";
import { logger } from "../../../shared/infra/logger/logger";
import { InvalidCredentialsError } from "../../domain/InvalidCredentialsError";

// Per-process limiter (not shared between replicas); built lazily so env is read at first use.
let limiter: SlidingWindowRateLimiter | null | undefined;
let limiterClock: (() => number) | undefined;
export function resetAuthRateLimiter(now?: () => number) { limiter = undefined; limiterClock = now; }

/** beforeHandle guard: limits attempts per IP+email (IP only when no email, e.g. /token). */
export function authRateLimit({ body, request, server, set }: any) {
  if (limiter === undefined) limiter = rateLimiterFromEnv(process.env, limiterClock);
  if (!limiter) return;
  const headers = { "x-forwarded-for": request.headers.get("x-forwarded-for") ?? undefined };
  const ip = clientIp(headers, server?.requestIP?.(request)?.address);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const r = limiter.hit(`${ip}|${email}`);
  if (!r.allowed) {
    set.status = 429;
    set.headers["retry-after"] = String(r.retryAfterSeconds);
    return { error: "Too many attempts, try again later" };
  }
}

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

export const identityRoutes = new Elysia({ prefix: "/auth" })
  .use(tenantMiddleware)
  .post("/register", async ({ body, tenantDb, set }) => {
    const db = tenantDb ?? getTenantDbFromEnv();
    if (body.password.length < 8) {
      set.status = 400;
      return { error: "Password must be at least 8 characters long" };
    }
    try {
      const hasher = new BcryptHasher();
      const uc = new RegisterUser(new UserRepositoryDrizzle(db), hasher);
      return await uc.execute({ id: crypto.randomUUID(), email: body.email, password: body.password });
    } catch (error) {
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
    body: t.Object({ email: t.String(), password: t.String() }),
    detail: {
      summary: "Registrazione utente",
      description: "Crea un nuovo account utente con ruolo `user` di default.",
      tags: ["Auth"]
    },
    response: {
      200: t.Object({ id: t.String(), email: t.String(), role: t.String() }),
      400: t.Object({ error: t.String() }),
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
      description: "Restituisce un JWT da usare con `Authorization: Bearer <token>` e un refresh token.",
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
      description: "Verifica credenziali e restituisce un codice di autorizzazione da scambiare con PKCE.",
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
    const refresh = await tokenService.signRefresh({
      sub: record.user.id,
      email: record.user.email,
      role: record.user.role,
      tenantId: record.user.tenantId ?? undefined
    });
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
  });
