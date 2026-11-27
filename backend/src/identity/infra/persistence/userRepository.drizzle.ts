import { and, eq, ne, sql } from "drizzle-orm";
import { usersTable } from "./schema";
import { Email } from "../../domain/Email";
import { User } from "../../domain/User";
import { UsernameTakenError } from "../../domain/username";

export class UserRepositoryDrizzle {
  constructor(private readonly db: any) {}
  async findByEmail(email: Email): Promise<User | null> {
    const rows = await this.db.select().from(usersTable).where(eq(usersTable.email, email.value));
    if (!rows.length) return null;
    return this.toUser(rows[0]);
  }
  async findByUsername(username: string): Promise<User | null> {
    const rows = await this.db.select().from(usersTable)
      .where(sql`lower(${usersTable.username}) = lower(${username})`);
    if (!rows.length) return null;
    return this.toUser(rows[0]);
  }
  async findById(id: string): Promise<User | null> {
    const rows = await this.db.select().from(usersTable).where(eq(usersTable.id, id as any));
    if (!rows.length) return null;
    return this.toUser(rows[0]);
  }
  async save(user: User): Promise<void> {
    await this.db.insert(usersTable).values({
      id: user.id, email: user.email.value, role: user.role, passwordHash: user.passwordHash, isActive: user.isActive,
      username: user.username
    }).onConflictDoUpdate({
      target: [usersTable.email],
      set: { role: user.role, passwordHash: user.passwordHash, isActive: user.isActive }
    });
  }
  private toUser(r: any): User {
    return new User(r.id, Email.create(r.email), r.role, r.passwordHash, r.isActive, null, r.username ?? null, r.sessionsRevokedAt ?? null);
  }
}

/** True when err (or its cause) is the unique violation of users.username (case-insensitive index). */
export function isUniqueUsernameViolation(err: unknown): boolean {
  for (let e: any = err, depth = 0; e && depth < 4; e = e.cause, depth++) {
    if (e.code === "23505" && (e.constraint === "ux_users_username" || String(e.message ?? "").includes("ux_users_username"))) return true;
  }
  return false;
}

/** Sets (or clears, with null) the username of a user. Throws UsernameTakenError when another account holds it. */
export async function setUsername(db: any, userId: string, username: string | null): Promise<void> {
  if (username) {
    const [clash] = await db.select({ id: usersTable.id }).from(usersTable)
      .where(and(sql`lower(${usersTable.username}) = lower(${username})`, ne(usersTable.id, userId as any)))
      .limit(1);
    if (clash) throw new UsernameTakenError();
  }
  try {
    await db.update(usersTable).set({ username }).where(eq(usersTable.id, userId as any));
  } catch (err) {
    if (isUniqueUsernameViolation(err)) throw new UsernameTakenError();
    throw err;
  }
}
