import { Email } from "../domain/Email";
import type { UserRepository } from "./ports/UserRepository";
import type { PasswordHasher } from "./ports/PasswordHasher";

export class AuthenticateUser {
  constructor(private readonly users: UserRepository, private readonly hasher: PasswordHasher) {}

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
    return user;
  }
}
