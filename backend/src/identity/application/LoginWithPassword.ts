import { Email } from "../domain/Email";
import type { UserRepository } from "./ports/UserRepository";
import type { PasswordHasher } from "./ports/PasswordHasher";
import type { TokenService } from "./ports/TokenService";

export class LoginWithPassword {
  constructor(private readonly users: UserRepository, private readonly hasher: PasswordHasher, private readonly tokens: TokenService) {}
  async execute(input: { email: string; password: string }) {
    const email = Email.create(input.email);
    const user = await this.users.findByEmail(email);
    if (!user) throw new Error("Invalid credentials");
    if (!user.canLogin()) throw new Error("User disabled");
    const ok = await this.hasher.verify(input.password, user.passwordHash);
    if (!ok) throw new Error("Invalid credentials");
    const token = await this.tokens.sign({ sub: user.id, email: user.email.value, role: user.role });
    return { accessToken: token, role: user.role };
  }
}
