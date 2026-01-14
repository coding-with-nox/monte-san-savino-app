import { Elysia, t } from "elysia";
import { RegisterUser } from "../../application/RegisterUser";
import { LoginWithPassword } from "../../application/LoginWithPassword";
import { BcryptHasher } from "../crypto/bcryptHasher";
import { JwtTokenService } from "../tokens/jwtTokenService";
import { UserRepositoryDrizzle } from "../persistence/userRepository.drizzle";

export const identityRoutes = new Elysia({ prefix: "/auth" })
  .post("/register", async ({ body, tenantDb }) => {
    const uc = new RegisterUser(new UserRepositoryDrizzle(tenantDb), new BcryptHasher());
    return await uc.execute({ id: crypto.randomUUID(), email: body.email, password: body.password });
  }, { body: t.Object({ email: t.String(), password: t.String({ minLength: 8 }) }) })
  .post("/login", async ({ body, tenantDb }) => {
    const uc = new LoginWithPassword(new UserRepositoryDrizzle(tenantDb), new BcryptHasher(), new JwtTokenService());
    return await uc.execute(body);
  }, { body: t.Object({ email: t.String(), password: t.String() }) });
