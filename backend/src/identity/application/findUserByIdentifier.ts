import { Email } from "../domain/Email";
import { User } from "../domain/User";
import { isUsernameIdentifier } from "../domain/username";
import type { UserRepository } from "./ports/UserRepository";

/** Login field: contains '@' => email, otherwise username. Invalid emails still throw "Invalid email". */
export async function findUserByIdentifier(users: UserRepository, identifier: string): Promise<User | null> {
  if (isUsernameIdentifier(identifier)) return await users.findByUsername(identifier.trim());
  return await users.findByEmail(Email.create(identifier));
}
