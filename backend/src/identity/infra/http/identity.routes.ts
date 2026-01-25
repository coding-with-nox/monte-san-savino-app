import { Elysia, t } from "elysia";
import { RegisterUser } from "../../application/RegisterUser";
import { LoginWithPassword } from "../../application/LoginWithPassword";
import { AuthenticateUser } from "../../application/AuthenticateUser";
import { BcryptHasher } from "../crypto/bcryptHasher";
import { JwtTokenService } from "../tokens/jwtTokenService";
import { UserRepositoryDrizzle } from "../persistence/userRepository.drizzle";
import { getTenantDbFromEnv } from "../../../tenancy/infra/tenantDbFactory";
import { consumeAuthCode, createAuthCode } from "../tokens/pkceStore";
import crypto from "node:crypto";

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
  .post("/register", async ({ body, tenantDb, set }) => {
    const db = tenantDb ?? getTenantDbFromEnv();
    if (body.password.length < 8) {
      set.status = 400;
      return { error: "Password must be at least 8 characters long" };
    }
    try {
      const uc = new RegisterUser(new UserRepositoryDrizzle(db), new BcryptHasher());
      return await uc.execute({ id: crypto.randomUUID(), email: body.email, password: body.password });
    } catch (error) {
      set.status = 400;
      return { error: error instanceof Error ? error.message : "Registration failed" };
    }
  }, {
    body: t.Object({ email: t.String(), password: t.String() }),
    detail: {
      summary: "Registrazione utente",
      description: "Crea un nuovo account utente con ruolo `user` di default.",
      tags: ["Auth"]
    },
    response: {
      200: t.Object({ id: t.String(), email: t.String(), role: t.String() }),
      400: t.Object({ error: t.String() }),
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
      const message = error instanceof Error ? error.message : "Login failed";
      set.status = message.toLowerCase().includes("credentials") ? 401 : 400;
      return { error: message };
    }
  }, {
    body: t.Object({ email: t.String(), password: t.String() }),
    detail: {
      summary: "Login con password",
      description: "Restituisce un JWT da usare con `Authorization: Bearer <token>` e un refresh token.",
      tags: ["Auth"]
    },
    response: {
      200: t.Object({ accessToken: t.String(), refreshToken: t.String(), expiresIn: t.Number(), expires_in: t.Number(), role: t.String() }),
      400: t.Object({ error: t.String() }),
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
      500: t.Object({ error: t.String() })
    }
  })
  .post("/refresh", async ({ body, set }) => {
    try {
      const tokenService = new JwtTokenService();
      const payload = await tokenService.verify(body.refreshToken);
      if (payload.tokenType !== "refresh") {
        set.status = 401;
        return { error: "Invalid refresh token" };
      }
      const access = await tokenService.signAccess({
        sub: payload.sub as string,
        email: payload.email as string,
        role: payload.role as string,
        tenantId: payload.tenantId as any
      });
      const refresh = await tokenService.signRefresh({
        sub: payload.sub as string,
        email: payload.email as string,
        role: payload.role as string,
        tenantId: payload.tenantId as any
      });
      return buildTokenResponse(access.token, refresh.token, access.expiresIn, payload.role as string);
    } catch (error) {
      set.status = 401;
      return { error: error instanceof Error ? error.message : "Invalid refresh token" };
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
