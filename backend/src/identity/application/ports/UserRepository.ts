import { Email } from "../../domain/Email";
import { User } from "../../domain/User";

export interface UserRepository {
  findByEmail(email: Email): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  save(user: User): Promise<void>;
}
