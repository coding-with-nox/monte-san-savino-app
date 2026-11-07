import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import {
  awardBracketsTable, awardsTable, categoriesTable, judgeAssignmentsTable, judgeCompletionsTable, modelsTable, votesTable
} from "./schema";
import {
  computeAwards, evaluateCompletion, judgesWithMissingVotes, latestVotePerJudgeModel, missingVoteModelIds,
  type AwardRow, type Bracket, type LatestVote
} from "../../domain/categoryClosure";
import { CategoryClosedError, ConflictError, ForbiddenError, IncompleteVotesError, NotFoundError } from "../../domain/errors";

/** All operations are executed on a transaction-scoped store. */
export interface ClosureStore {
  /** SELECT ... FOR UPDATE on the category row. */
  lockCategory(categoryId: string): Promise<{ id: string; eventId: string; status: string } | null>;
  listAssignedJudgeIds(eventId: string, categoryId: string): Promise<string[]>;
  listCategoryModelIds(categoryId: string): Promise<string[]>;
  listVotedModelIds(judgeId: string, modelIds: string[]): Promise<string[]>;
  listVotePairs(modelIds: string[], judgeIds: string[]): Promise<{ judgeId: string; modelId: string }[]>;
  /** Newest first: ORDER BY created_at DESC, seq DESC. */
  listVotesNewestFirst(modelIds: string[], judgeIds: string[]): Promise<LatestVote[]>;
  listBrackets(eventId: string): Promise<Bracket[]>;
  upsertCompletion(judgeId: string, categoryId: string): Promise<void>;
  listCompletedJudgeIds(categoryId: string): Promise<string[]>;
  upsertAwards(categoryId: string, rows: AwardRow[]): Promise<void>;
  deleteAwards(categoryId: string): Promise<void>;
  deleteCompletions(categoryId: string): Promise<void>;
  setStatus(categoryId: string, status: "open" | "closed"): Promise<void>;
}

export type CloseResult =
  | { outcome: "closed"; allDone: true; totalJudges: number; completedJudges: number }
  | { outcome: "pending"; allDone: false; totalJudges: number; completedJudges: number }
  | { outcome: "already_closed" };

type TxRunner = { transaction: <T>(fn: (tx: any) => Promise<T>) => Promise<T> };
const defaultStore = (tx: any): ClosureStore => new DrizzleClosureStore(tx);

/**
 * Single entry point to close a category. Everything runs in ONE transaction holding a row lock on
 * the category, so concurrent completions/closures serialize and awards are all-or-nothing.
 *
 *  - { judgeId }: judge completion path. The judge must be assigned and must have voted every
 *    model (else 409 INCOMPLETE_VOTES). The completion is recorded, and the category is closed only if
 *    ALL assigned judges (distinct, assigned only) completed and there is at least one.
 *  - no judgeId: manager's manual close. Requires at least one assigned judge and that every assigned
 *    judge voted every model (else 409). Awards are computed exactly like the judge path.
 */
export async function closeCategory(
  db: TxRunner,
  categoryId: string,
  opts: { judgeId?: string } = {},
  makeStore: (tx: any) => ClosureStore = defaultStore
): Promise<CloseResult> {
  return await db.transaction(async (tx) => {
    const store = makeStore(tx);
    const category = await store.lockCategory(categoryId);
    if (!category) throw new NotFoundError("Category not found");
    if (category.status === "closed") {
      if (opts.judgeId) throw new CategoryClosedError("Category already closed");
      return { outcome: "already_closed" } as CloseResult;
    }

    const assigned = await store.listAssignedJudgeIds(category.eventId, categoryId);
    const modelIds = await store.listCategoryModelIds(categoryId);

    if (opts.judgeId) {
      if (!assigned.includes(opts.judgeId)) throw new ForbiddenError("Judge is not assigned to this category");
      const voted = await store.listVotedModelIds(opts.judgeId, modelIds);
      const missing = missingVoteModelIds(modelIds, voted);
      if (missing.length > 0) throw new IncompleteVotesError(missing.length, modelIds.length, missing);
      await store.upsertCompletion(opts.judgeId, categoryId);
    }

    const completed = await store.listCompletedJudgeIds(categoryId);
    const state = evaluateCompletion(assigned, completed);

    if (opts.judgeId) {
      if (!state.allDone) {
        return { outcome: "pending", allDone: false, totalJudges: state.totalJudges, completedJudges: state.completedJudges } as CloseResult;
      }
    } else {
      if (state.totalJudges === 0) throw new ConflictError("Cannot close category: no judges assigned", {}, "NO_JUDGES");
      const pairs = await store.listVotePairs(modelIds, assigned);
      if (judgesWithMissingVotes(assigned, modelIds, pairs).length > 0) {
        const actual = new Set(pairs.map((p) => `${p.judgeId}::${p.modelId}`)).size;
        throw new ConflictError(
          "Cannot close category: not all judges have voted on all models",
          { expected: assigned.length * modelIds.length, actual },
          "INCOMPLETE_VOTES"
        );
      }
    }

    // Freeze awards (same transaction as the status change: all or nothing)
    if (modelIds.length > 0) {
      const votes = await store.listVotesNewestFirst(modelIds, assigned);
      const brackets = await store.listBrackets(category.eventId);
      const awards = computeAwards(modelIds, assigned, latestVotePerJudgeModel(votes), brackets);
      await store.upsertAwards(categoryId, awards);
    }
    await store.setStatus(categoryId, "closed");
    return { outcome: "closed", allDone: true, totalJudges: state.totalJudges, completedJudges: state.completedJudges } as CloseResult;
  });
}

/** Reopens a closed category, invalidating its awards and judge completions (one transaction). */
export async function reopenCategory(
  db: TxRunner,
  categoryId: string,
  makeStore: (tx: any) => ClosureStore = defaultStore
): Promise<{ reopened: boolean }> {
  return await db.transaction(async (tx) => {
    const store = makeStore(tx);
    const category = await store.lockCategory(categoryId);
    if (!category) throw new NotFoundError("Category not found");
    if (category.status !== "closed") return { reopened: false };
    await store.deleteAwards(categoryId);
    await store.deleteCompletions(categoryId);
    await store.setStatus(categoryId, "open");
    return { reopened: true };
  });
}

export class DrizzleClosureStore implements ClosureStore {
  constructor(private readonly db: any) {}

  async lockCategory(categoryId: string) {
    const rows = await this.db
      .select({ id: categoriesTable.id, eventId: categoriesTable.eventId, status: categoriesTable.status })
      .from(categoriesTable)
      .where(eq(categoriesTable.id, categoryId as any))
      .for("update");
    return rows[0] ?? null;
  }
  async listAssignedJudgeIds(eventId: string, categoryId: string) {
    const rows = await this.db
      .select({ judgeId: judgeAssignmentsTable.judgeId })
      .from(judgeAssignmentsTable)
      .where(and(
        eq(judgeAssignmentsTable.eventId, eventId as any),
        or(eq(judgeAssignmentsTable.categoryId, categoryId as any), isNull(judgeAssignmentsTable.categoryId))
      ));
    return [...new Set<string>(rows.map((r: any) => r.judgeId))];
  }
  async listCategoryModelIds(categoryId: string) {
    const rows = await this.db.select({ id: modelsTable.id }).from(modelsTable).where(eq(modelsTable.categoryId, categoryId as any));
    return rows.map((r: any) => r.id as string);
  }
  async listVotedModelIds(judgeId: string, modelIds: string[]) {
    if (!modelIds.length) return [];
    const rows = await this.db
      .selectDistinct({ modelId: votesTable.modelId })
      .from(votesTable)
      .where(and(eq(votesTable.judgeId, judgeId as any), inArray(votesTable.modelId, modelIds as any)));
    return rows.map((r: any) => r.modelId as string);
  }
  async listVotePairs(modelIds: string[], judgeIds: string[]) {
    if (!modelIds.length || !judgeIds.length) return [];
    return await this.db
      .selectDistinct({ judgeId: votesTable.judgeId, modelId: votesTable.modelId })
      .from(votesTable)
      .where(and(inArray(votesTable.modelId, modelIds as any), inArray(votesTable.judgeId, judgeIds as any)));
  }
  async listVotesNewestFirst(modelIds: string[], judgeIds: string[]) {
    if (!modelIds.length || !judgeIds.length) return [];
    return await this.db
      .select({ judgeId: votesTable.judgeId, modelId: votesTable.modelId, rank: votesTable.rank })
      .from(votesTable)
      .where(and(inArray(votesTable.modelId, modelIds as any), inArray(votesTable.judgeId, judgeIds as any)))
      .orderBy(desc(votesTable.createdAt), desc(votesTable.seq));
  }
  async listBrackets(eventId: string) {
    return await this.db.select().from(awardBracketsTable).where(eq(awardBracketsTable.eventId, eventId as any));
  }
  async upsertCompletion(judgeId: string, categoryId: string) {
    await this.db
      .insert(judgeCompletionsTable)
      .values({ id: crypto.randomUUID() as any, judgeId: judgeId as any, categoryId: categoryId as any })
      .onConflictDoNothing();
  }
  async listCompletedJudgeIds(categoryId: string) {
    const rows = await this.db
      .select({ judgeId: judgeCompletionsTable.judgeId })
      .from(judgeCompletionsTable)
      .where(eq(judgeCompletionsTable.categoryId, categoryId as any));
    return rows.map((r: any) => r.judgeId as string);
  }
  async upsertAwards(categoryId: string, rows: AwardRow[]) {
    for (const r of rows) {
      await this.db
        .insert(awardsTable)
        .values({
          id: crypto.randomUUID() as any, categoryId: categoryId as any, modelId: r.modelId as any,
          totalScore: r.totalScore, medalLabel: r.medalLabel, medalRank: r.medalRank, source: "aggregate"
        })
        .onConflictDoUpdate({
          target: [awardsTable.categoryId, awardsTable.modelId],
          set: { totalScore: r.totalScore, medalLabel: r.medalLabel, medalRank: r.medalRank, source: "aggregate" }
        });
    }
  }
  async deleteAwards(categoryId: string) {
    await this.db.delete(awardsTable).where(eq(awardsTable.categoryId, categoryId as any));
  }
  async deleteCompletions(categoryId: string) {
    await this.db.delete(judgeCompletionsTable).where(eq(judgeCompletionsTable.categoryId, categoryId as any));
  }
  async setStatus(categoryId: string, status: "open" | "closed") {
    await this.db.update(categoriesTable).set({ status }).where(eq(categoriesTable.id, categoryId as any));
  }
}

/** Loads the completion state for read-only endpoints (only assigned judges count). */
export async function loadCompletionState(db: any, categoryId: string) {
  const store = new DrizzleClosureStore(db);
  const rows = await db
    .select({ id: categoriesTable.id, eventId: categoriesTable.eventId, status: categoriesTable.status })
    .from(categoriesTable)
    .where(eq(categoriesTable.id, categoryId as any));
  const category = rows[0];
  if (!category) return null;
  const assigned = await store.listAssignedJudgeIds(category.eventId, categoryId);
  const completed = await store.listCompletedJudgeIds(categoryId);
  return { category, ...evaluateCompletion(assigned, completed) };
}
