import { Email } from "../domain/Email";
import type { UserRepository } from "./ports/UserRepository";
import type { PasswordHasher } from "./ports/PasswordHasher";

export class AuthenticateUser {
  constructor(private readonly users: UserRepository, private readonly hasher: PasswordHasher) {}

  async execute(input: { email: string; password: string }) {
    const email = Email.create(input.email);
    const user = await this.users.findByEmail(email);
    if (!user) throw new Error("Invalid credentials");
    if (!user.canLogin()) throw new Error("User disabled");
    const ok = await this.hasher.verify(input.password, user.passwordHash);
    if (!ok) throw new Error("Invalid credentials");
    return user;
  }
}
