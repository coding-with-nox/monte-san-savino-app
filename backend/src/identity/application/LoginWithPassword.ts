import { Email } from "../domain/Email";
import type { UserRepository } from "./ports/UserRepository";
import type { PasswordHasher } from "./ports/PasswordHasher";
import type { TokenService } from "./ports/TokenService";

export class LoginWithPassword {
  constructor(private readonly users: UserRepository, private readonly hasher: PasswordHasher, private readonly tokens: TokenService) {}
  async execute(input: { email: string; password: string }) {
    const email = Email.create(input.email);
    const user = await this.users.findByEmail(email);
    if (!user) {
      await this.hasher.hash(input.password); // equalize timing with the existing-user path
      throw new Error("Invalid credentials");
    }
    const ok = await this.hasher.verify(input.password, user.passwordHash);
    // Disabled accounts are indistinguishable from wrong credentials.
    if (!ok || !user.canLogin()) throw new Error("Invalid credentials");
    const access = await this.tokens.signAccess({ sub: user.id, email: user.email.value, role: user.role });
    const refresh = await this.tokens.signRefresh({ sub: user.id, email: user.email.value, role: user.role });
    return {
      accessToken: access.token,
      refreshToken: refresh.token,
      expiresIn: access.expiresIn,
      role: user.role
    };
  }
}
