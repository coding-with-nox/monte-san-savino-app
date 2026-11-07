import { eq } from "drizzle-orm";
import { categoriesTable, judgeAssignmentsTable } from "./schema";
import { buildJudgeScope, type JudgeScope } from "../../domain/judgeScope";

/** Loads the authorization scope of the current user (managers/admins are privileged, no query needed). */
export async function loadJudgeScope(db: any, user: { id: string; role?: string }): Promise<JudgeScope> {
  if (user.role === "admin" || user.role === "manager") return buildJudgeScope(user.role, []);
  const rows = await db
    .select({ eventId: judgeAssignmentsTable.eventId, categoryId: judgeAssignmentsTable.categoryId })
    .from(judgeAssignmentsTable)
    .where(eq(judgeAssignmentsTable.judgeId, user.id as any));
  return buildJudgeScope(user.role, rows.map((r: any) => ({ eventId: r.eventId, categoryId: r.categoryId ?? null })));
}

export async function loadCategoryRef(db: any, categoryId: string): Promise<{ id: string; eventId: string } | null> {
  const rows = await db
    .select({ id: categoriesTable.id, eventId: categoriesTable.eventId })
    .from(categoriesTable)
    .where(eq(categoriesTable.id, categoryId as any));
  return rows[0] ?? null;
}
