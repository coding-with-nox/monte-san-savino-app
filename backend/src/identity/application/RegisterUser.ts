import { Email } from "../domain/Email";
import { User } from "../domain/User";
import type { UserRepository } from "./ports/UserRepository";
import type { PasswordHasher } from "./ports/PasswordHasher";
import type { Role } from "../domain/Role";

export class RegisterUser {
  constructor(private readonly users: UserRepository, private readonly hasher: PasswordHasher) {}
  async execute(input: { id: string; email: string; password: string; role?: Role }) {
    const email = Email.create(input.email);
    const existing = await this.users.findByEmail(email);
    if (existing) throw new Error("Email already registered");
    const passwordHash = await this.hasher.hash(input.password);
    const user = new User(input.id, email, input.role ?? "user", passwordHash, true);
    await this.users.save(user);
    return { id: user.id, email: user.email.value, role: user.role };
  }
}
