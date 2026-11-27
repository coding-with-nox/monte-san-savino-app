import type { UserRepository } from "./ports/UserRepository";
import type { PasswordHasher } from "./ports/PasswordHasher";
import { findUserByIdentifier } from "./findUserByIdentifier";

export class AuthenticateUser {
  constructor(private readonly users: UserRepository, private readonly hasher: PasswordHasher) {}

  /** `identifier` is an email or a username (see findUserByIdentifier). */
  async execute(input: { email: string; password: string }) {
    const user = await findUserByIdentifier(this.users, input.email);
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
