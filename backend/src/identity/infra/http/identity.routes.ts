import { Elysia, t } from "elysia";
import { RegisterUser } from "../../application/RegisterUser";
import { LoginWithPassword } from "../../application/LoginWithPassword";
import { BcryptHasher } from "../crypto/bcryptHasher";
import { JwtTokenService } from "../tokens/jwtTokenService";
import { UserRepositoryDrizzle } from "../persistence/userRepository.drizzle";

export const identityRoutes = new Elysia({ prefix: "/auth" })
  .post("/register", async ({ body, tenantDb, set }) => {
    if (!tenantDb) {
      set.status = 500;
      return { error: "Tenant database not initialized" };
    }
    if (body.password.length < 8) {
      set.status = 400;
      return { error: "Password must be at least 8 characters long" };
    }
    try {
      const uc = new RegisterUser(new UserRepositoryDrizzle(tenantDb), new BcryptHasher());
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
    if (!tenantDb) {
      set.status = 500;
      return { error: "Tenant database not initialized" };
    }
    try {
      const uc = new LoginWithPassword(new UserRepositoryDrizzle(tenantDb), new BcryptHasher(), new JwtTokenService());
      return await uc.execute(body);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Login failed";
      set.status = message.toLowerCase().includes("credentials") ? 401 : 400;
      return { error: message };
    }
  }, {
    body: t.Object({ email: t.String(), password: t.String() }),
    detail: {
      summary: "Login con password",
      description: "Restituisce un JWT da usare con `Authorization: Bearer <token>`.",
      tags: ["Auth"]
    },
    response: {
      200: t.Object({ accessToken: t.String(), role: t.String() }),
      400: t.Object({ error: t.String() }),
      401: t.Object({ error: t.String() }),
      500: t.Object({ error: t.String() })
    }
  });
