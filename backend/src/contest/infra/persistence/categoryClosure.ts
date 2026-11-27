import { and, desc, eq, inArray } from "drizzle-orm";
import {
  awardBracketsTable, awardsTable, categoriesTable, judgeCompletionsTable, modelsTable, settingsTable, votesTable
} from "./schema";
import { loadEventAssignments } from "./judgeAccess";
import {
  assessCategory, categoryPhase, judgeMissingVoteModelIds, JUDGING_SETTING_KEYS, latestVotePerJudgeModel, parseJudgingRules,
  readyToClose, serializeAwardIssues, type AwardRow, type Bracket, type CategoryAssessment, type JudgingSettingKey, type LatestVote,
  type ModelExpectation
} from "../../domain/categoryClosure";
import { assignedJudgeIds, expectedVoterIds, type JudgeAssignmentRow } from "../../domain/expectedVoters";
import { CategoryClosedError, ConflictError, ForbiddenError, IncompleteVotesError, NotFoundError } from "../../domain/errors";

/** All operations are executed on a transaction-scoped store. */
export interface ClosureStore {
  /** SELECT ... FOR UPDATE on the category row. */
  lockCategory(categoryId: string): Promise<{ id: string; eventId: string; status: string } | null>;
  /** Assignments (regular and stand-in) of every judge of the event. */
  listEventAssignments(eventId: string): Promise<JudgeAssignmentRow[]>;
  /** Models of the category with their owners. */
  listCategoryModels(categoryId: string): Promise<{ modelId: string; ownerId: string }[]>;
  listVotedModelIds(judgeId: string, modelIds: string[]): Promise<string[]>;
  /** Newest first: ORDER BY created_at DESC, seq DESC. */
  listVotesNewestFirst(modelIds: string[]): Promise<LatestVote[]>;
  listBrackets(eventId: string): Promise<Bracket[]>;
  /** Values of the given settings keys (missing keys are absent from the result). */
  listSettingValues(keys: string[]): Promise<Partial<Record<JudgingSettingKey, string>>>;
  upsertCompletion(judgeId: string, categoryId: string): Promise<void>;
  listCompletedJudgeIds(categoryId: string): Promise<string[]>;
  upsertAwards(categoryId: string, rows: AwardRow[]): Promise<void>;
  deleteAwards(categoryId: string): Promise<void>;
  deleteCompletions(categoryId: string): Promise<void>;
  setStatus(categoryId: string, status: "open" | "closed"): Promise<void>;
}

export type CloseResult =
  | { outcome: "closed"; allDone: boolean; totalJudges: number; completedJudges: number }
  | { outcome: "pending"; allDone: false; totalJudges: number; completedJudges: number }
  | { outcome: "reconciliation"; allDone: true; totalJudges: number; completedJudges: number; discordantModelIds: string[] }
  | { outcome: "already_closed" };

type TxRunner = { transaction: <T>(fn: (tx: any) => Promise<T>) => Promise<T> };
const defaultStore = (tx: any): ClosureStore => new DrizzleClosureStore(tx);

type CategoryRow = { id: string; eventId: string; status: string };

/** Expected voters of every model of the category, from the event assignments and the model owners. */
async function loadExpectations(store: ClosureStore, category: CategoryRow): Promise<{ models: ModelExpectation[]; assigned: string[] }> {
  const ref = { id: category.id, eventId: category.eventId };
  const assignments = await store.listEventAssignments(category.eventId);
  const models = (await store.listCategoryModels(category.id)).map((m) => ({
    modelId: m.modelId,
    expectedJudgeIds: expectedVoterIds(assignments, ref, m.ownerId)
  }));
  return { models, assigned: assignedJudgeIds(assignments, ref) };
}

/** Awards, completion and discordance from the current votes. */
async function assess(store: ClosureStore, category: CategoryRow, models: ModelExpectation[]): Promise<CategoryAssessment> {
  const modelIds = models.map((m) => m.modelId);
  const votes = latestVotePerJudgeModel(await store.listVotesNewestFirst(modelIds));
  return assessCategory({
    models,
    votes,
    completedJudgeIds: await store.listCompletedJudgeIds(category.id),
    brackets: await store.listBrackets(category.eventId),
    rules: parseJudgingRules(await store.listSettingValues([...JUDGING_SETTING_KEYS]))
  });
}

/** Freezes the awards and closes the category (the caller holds the transaction). */
async function freezeAndClose(store: ClosureStore, category: CategoryRow, awards: AwardRow[]): Promise<void> {
  if (awards.length > 0) await store.upsertAwards(category.id, awards);
  await store.setStatus(category.id, "closed");
}

/**
 * Single entry point to close a category. Everything runs in ONE transaction holding a row lock on
 * the category, so concurrent completions/closures serialize and awards are all-or-nothing.
 *
 *  - { judgeId }: judge completion path. The judge must be assigned and must have voted every model where he
 *    is an expected voter (else 409 INCOMPLETE_VOTES). The completion is recorded. When every counted judge
 *    completed: with no discordant votes the category is closed; otherwise it enters reconciliation and stays open.
 *  - no judgeId: manager's manual close. Requires at least one assigned judge (else 409 NO_JUDGES).
 *    Missing votes are allowed: unvoted models get a score of 0 and the awards flag the issues.
 *
 * Awards use the expected voters of each model and the judging rules stored in settings.
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

    const { models, assigned } = await loadExpectations(store, category);

    if (opts.judgeId) {
      const judgeId = opts.judgeId;
      if (!assigned.includes(judgeId)) throw new ForbiddenError("Judge is not assigned to this category");
      const voted = await store.listVotedModelIds(judgeId, models.map((m) => m.modelId));
      const missing = judgeMissingVoteModelIds(models, judgeId, voted);
      if (missing.length > 0) {
        const expectedCount = models.filter((m) => m.expectedJudgeIds.includes(judgeId)).length;
        throw new IncompleteVotesError(missing.length, expectedCount, missing);
      }
      await store.upsertCompletion(judgeId, categoryId);
    } else if (assigned.length === 0) {
      throw new ConflictError("Cannot close category: no judges assigned", {}, "NO_JUDGES");
    }

    const assessment = await assess(store, category, models);
    const { completion, discordantModelIds } = assessment;
    const totals = { totalJudges: completion.totalJudges, completedJudges: completion.completedJudges };

    if (opts.judgeId) {
      if (!completion.allDone) return { outcome: "pending", allDone: false, ...totals } as CloseResult;
      if (discordantModelIds.length > 0) {
        return { outcome: "reconciliation", allDone: true, ...totals, discordantModelIds } as CloseResult;
      }
    }
    await freezeAndClose(store, category, assessment.awards);
    return { outcome: "closed", allDone: completion.allDone, ...totals } as CloseResult;
  });
}

/**
 * Run after every vote. A category in reconciliation (all counted judges completed) closes as soon as no
 * discordant votes are left. Returns `closed: true` when this call closed it.
 */
export async function reconcileCategory(
  db: TxRunner,
  categoryId: string,
  makeStore: (tx: any) => ClosureStore = defaultStore
): Promise<{ closed: boolean }> {
  return await db.transaction(async (tx) => {
    const store = makeStore(tx);
    const category = await store.lockCategory(categoryId);
    if (!category || category.status === "closed") return { closed: false };
    // Cheap exit: nothing can be complete before the first judge completes.
    if ((await store.listCompletedJudgeIds(categoryId)).length === 0) return { closed: false };
    const { models } = await loadExpectations(store, category);
    const assessment = await assess(store, category, models);
    if (!readyToClose(category.status, assessment)) return { closed: false };
    await freezeAndClose(store, category, assessment.awards);
    return { closed: true };
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
  async listEventAssignments(eventId: string) {
    return await loadEventAssignments(this.db, [eventId]);
  }
  async listCategoryModels(categoryId: string) {
    const rows = await this.db
      .select({ modelId: modelsTable.id, ownerId: modelsTable.userId })
      .from(modelsTable)
      .where(eq(modelsTable.categoryId, categoryId as any));
    return rows.map((r: any) => ({ modelId: r.modelId as string, ownerId: r.ownerId as string }));
  }
  async listVotedModelIds(judgeId: string, modelIds: string[]) {
    if (!modelIds.length) return [];
    const rows = await this.db
      .selectDistinct({ modelId: votesTable.modelId })
      .from(votesTable)
      .where(and(eq(votesTable.judgeId, judgeId as any), inArray(votesTable.modelId, modelIds as any)));
    return rows.map((r: any) => r.modelId as string);
  }
  async listVotesNewestFirst(modelIds: string[]) {
    if (!modelIds.length) return [];
    return await this.db
      .select({ judgeId: votesTable.judgeId, modelId: votesTable.modelId, rank: votesTable.rank })
      .from(votesTable)
      .where(inArray(votesTable.modelId, modelIds as any))
      .orderBy(desc(votesTable.createdAt), desc(votesTable.seq));
  }
  async listBrackets(eventId: string) {
    return await this.db.select().from(awardBracketsTable).where(eq(awardBracketsTable.eventId, eventId as any));
  }
  async listSettingValues(keys: string[]) {
    const rows = await this.db
      .select({ key: settingsTable.key, value: settingsTable.value })
      .from(settingsTable)
      .where(inArray(settingsTable.key, keys));
    return Object.fromEntries(rows.map((r: any) => [r.key, r.value])) as Partial<Record<JudgingSettingKey, string>>;
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
      const issues = serializeAwardIssues(r.issues);
      await this.db
        .insert(awardsTable)
        .values({
          id: crypto.randomUUID() as any, categoryId: categoryId as any, modelId: r.modelId as any,
          totalScore: r.totalScore, medalLabel: r.medalLabel, medalRank: r.medalRank, source: "aggregate", issues
        })
        .onConflictDoUpdate({
          target: [awardsTable.categoryId, awardsTable.modelId],
          set: { totalScore: r.totalScore, medalLabel: r.medalLabel, medalRank: r.medalRank, source: "aggregate", issues }
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

/**
 * Completion state for read-only endpoints. `phase` is "reconciliation" only when every counted judge
 * completed and discordant votes remain; `discordantModelIds` are the models with DISCORDANT_VOTES.
 */
export async function loadCompletionState(db: any, categoryId: string) {
  const rows = await db
    .select({ id: categoriesTable.id, eventId: categoriesTable.eventId, status: categoriesTable.status })
    .from(categoriesTable)
    .where(eq(categoriesTable.id, categoryId as any));
  const category: CategoryRow | undefined = rows[0];
  if (!category) return null;
  const store = new DrizzleClosureStore(db);
  const { models } = await loadExpectations(store, category);
  const assessment = await assess(store, category, models);
  return {
    category,
    phase: categoryPhase(category.status, assessment),
    totalJudges: assessment.completion.totalJudges,
    completedJudges: assessment.completion.completedJudges,
    allDone: assessment.completion.allDone,
    discordantModelIds: assessment.discordantModelIds
  };
}
