import { eq, inArray } from "drizzle-orm";
import { categoriesTable, judgeAssignmentsTable, modelsTable } from "./schema";
import { buildJudgeScope, type JudgeScope } from "../../domain/judgeScope";
import { mayVoteModel, type JudgeAssignmentRow } from "../../domain/expectedVoters";

/** Loads the authorization scope of the current user (managers/admins are privileged, no query needed). */
export async function loadJudgeScope(db: any, user: { id: string; role?: string }): Promise<JudgeScope> {
  if (user.role === "admin" || user.role === "manager") return buildJudgeScope(user.role, []);
  const rows = await db
    .select({ eventId: judgeAssignmentsTable.eventId, categoryId: judgeAssignmentsTable.categoryId })
    .from(judgeAssignmentsTable)
    .where(eq(judgeAssignmentsTable.judgeId, user.id as any));
  return buildJudgeScope(user.role, rows.map((r: any) => ({ eventId: r.eventId, categoryId: r.categoryId ?? null })));
}

/** Assignments (regular and stand-in) of every judge of the given events: input of the expected-voter rules. */
export async function loadEventAssignments(db: any, eventIds: string[]): Promise<JudgeAssignmentRow[]> {
  if (!eventIds.length) return [];
  const rows = await db
    .select({
      judgeId: judgeAssignmentsTable.judgeId,
      eventId: judgeAssignmentsTable.eventId,
      categoryId: judgeAssignmentsTable.categoryId,
      standingIn: judgeAssignmentsTable.standingIn
    })
    .from(judgeAssignmentsTable)
    .where(inArray(judgeAssignmentsTable.eventId, eventIds as any));
  return rows.map((r: any) => ({ judgeId: r.judgeId, eventId: r.eventId, categoryId: r.categoryId ?? null, standingIn: Boolean(r.standingIn) }));
}

export type JudgeContext = { judgeId: string; privileged: boolean; assignments: JudgeAssignmentRow[] };

/** Visibility context of a judge: the assignments of the events he is assigned to. Managers/admins are privileged. */
export async function loadJudgeContext(db: any, user: { id: string; role?: string }): Promise<JudgeContext> {
  if (user.role === "admin" || user.role === "manager") return { judgeId: user.id, privileged: true, assignments: [] };
  const own = await db
    .select({ eventId: judgeAssignmentsTable.eventId })
    .from(judgeAssignmentsTable)
    .where(eq(judgeAssignmentsTable.judgeId, user.id as any));
  const eventIds = [...new Set<string>(own.map((r: any) => r.eventId as string))];
  return { judgeId: user.id, privileged: false, assignments: await loadEventAssignments(db, eventIds) };
}

/**
 * Whether the judge may see and vote the model. Own models are NOT handled here (callers answer OWN_MODEL first).
 */
export function judgeCanVote(ctx: JudgeContext, model: { categoryId: string; eventId: string; userId: string }): boolean {
  return ctx.privileged || mayVoteModel(ctx.assignments, ctx.judgeId, { id: model.categoryId, eventId: model.eventId }, model.userId);
}

export async function loadCategoryRef(db: any, categoryId: string): Promise<{ id: string; eventId: string } | null> {
  const rows = await db
    .select({ id: categoriesTable.id, eventId: categoriesTable.eventId })
    .from(categoriesTable)
    .where(eq(categoriesTable.id, categoryId as any));
  return rows[0] ?? null;
}

export async function loadModelOwnerId(db: any, modelId: string): Promise<string | null> {
  const rows = await db.select({ userId: modelsTable.userId }).from(modelsTable).where(eq(modelsTable.id, modelId as any));
  return (rows[0]?.userId as string | undefined) ?? null;
}
