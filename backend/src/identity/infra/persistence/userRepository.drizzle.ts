import { eq } from "drizzle-orm";
import { usersTable } from "./schema";
import { Email } from "../../domain/Email";
import { User } from "../../domain/User";

export class UserRepositoryDrizzle {
  constructor(private readonly db: any) {}
  async findByEmail(email: Email): Promise<User | null> {
    const rows = await this.db.select().from(usersTable).where(eq(usersTable.email, email.value));
    if (!rows.length) return null;
    const r = rows[0];
    return new User(r.id, Email.create(r.email), r.role, r.passwordHash, r.isActive);
  }
  async findById(id: string): Promise<User | null> {
    const rows = await this.db.select().from(usersTable).where(eq(usersTable.id, id as any));
    if (!rows.length) return null;
    const r = rows[0];
    return new User(r.id, Email.create(r.email), r.role, r.passwordHash, r.isActive);
  }
  async save(user: User): Promise<void> {
    await this.db.insert(usersTable).values({
      id: user.id, email: user.email.value, role: user.role, passwordHash: user.passwordHash, isActive: user.isActive
    }).onConflictDoUpdate({
      target: [usersTable.email],
      set: { role: user.role, passwordHash: user.passwordHash, isActive: user.isActive }
    });
  }
}
