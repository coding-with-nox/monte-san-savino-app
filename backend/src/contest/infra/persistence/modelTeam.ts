import { and, eq, isNotNull, sql } from "drizzle-orm";
import { categoriesTable, memberRolesTable, modelsTable } from "./schema";
import { usersTable } from "../../../identity/infra/persistence/schema";
import { nextTeamCode } from "../../domain/teamCode";

export type TeamMemberInput = { name: string; surname: string; roleId?: string; role?: string; email?: string };
export type TeamMemberValues = { name: string; surname: string; role: string; roleId: string | null; email: string | null };

/**
 * Maps coauthors to rows: roleId must exist in member_roles (its name is stored as `role`);
 * a free-text `role` is still accepted for older clients. Returns null on a missing/unknown role.
 */
export async function resolveTeamMembers(db: any, members: TeamMemberInput[]): Promise<TeamMemberValues[] | null> {
  const roles: { id: string; name: string }[] = members.length ? await db.select().from(memberRolesTable) : [];
  const out: TeamMemberValues[] = [];
  for (const m of members) {
    const role = m.roleId
      ? roles.find((r) => r.id === m.roleId)
      : roles.find((r) => r.name.toLowerCase() === m.role?.trim().toLowerCase());
    if (!role && (m.roleId || !m.role?.trim())) return null;
    out.push({
      name: m.name,
      surname: m.surname,
      role: role?.name ?? m.role!.trim(),
      roleId: role?.id ?? null,
      email: m.email ?? null
    });
  }
  return out;
}

/** Next "<participant number>T<n>" code for the user; null when the user has no participant number. */
export async function nextTeamCodeForUser(db: any, userId: string): Promise<string | null> {
  const [user] = await db.select({ seqId: usersTable.seqId }).from(usersTable).where(eq(usersTable.id, userId as any)).limit(1);
  if (user?.seqId === null || user?.seqId === undefined) return null;
  const rows = await db
    .select({ teamCode: modelsTable.teamCode })
    .from(modelsTable)
    .where(and(eq(modelsTable.userId, userId as any), isNotNull(modelsTable.teamCode)));
  return nextTeamCode(user.seqId, rows.map((r: any) => r.teamCode));
}

/** Models the user already has in the event the category belongs to. */
export async function countParticipantModels(db: any, userId: string, categoryId: string): Promise<number> {
  const [category] = await db
    .select({ eventId: categoriesTable.eventId })
    .from(categoriesTable)
    .where(eq(categoriesTable.id, categoryId as any))
    .limit(1);
  if (!category) return 0;
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(modelsTable)
    .innerJoin(categoriesTable, eq(categoriesTable.id, modelsTable.categoryId))
    .where(and(eq(modelsTable.userId, userId as any), eq(categoriesTable.eventId, category.eventId as any)));
  return Number(row?.n ?? 0);
}
