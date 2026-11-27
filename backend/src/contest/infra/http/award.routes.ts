import { Elysia, t } from "elysia";
import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { requireRole } from "../../../identity/infra/http/role.middleware";
import { tenantMiddleware } from "../../../tenancy/infra/http/tenant.middleware";
import { requireVisibleSection } from "../../../identity/infra/http/section.middleware";
import { userProfilesTable, usersTable } from "../../../identity/infra/persistence/schema";
import {
  awardBracketsTable,
  awardsTable,
  categoriesTable,
  judgeAssignmentsTable,
  judgeCompletionsTable,
  modelsTable,
  votesTable
} from "../persistence/schema";
import { isOverrideMedalAllowed, latestVotePerJudgeModel, parseAwardIssues, type Bracket } from "../../domain/categoryClosure";
import { DrizzleClosureStore } from "../persistence/categoryClosure";
import { formatModelCode, loadModelCodeFormatSettings } from "./model-code";

type CountRow = { categoryId: string; count: number };

/** Pure assembly of the monitoring response from per-category aggregate counts. */
export function buildMonitoringRows(
  cats: { id: string; name: string; status: string }[],
  counts: { models: CountRow[]; judges: CountRow[]; scored: CountRow[]; completions: CountRow[] }
) {
  const toMap = (rows: CountRow[]) => new Map(rows.map((r) => [r.categoryId, Number(r.count)]));
  const models = toMap(counts.models);
  const judges = toMap(counts.judges);
  const scored = toMap(counts.scored);
  const completions = toMap(counts.completions);
  return cats.map((cat) => {
    const totalModels = models.get(cat.id) ?? 0;
    const scoredModels = scored.get(cat.id) ?? 0;
    return {
      categoryId: cat.id,
      categoryName: cat.name,
      status: cat.status,
      totalModels,
      scoredModels,
      percentComplete: totalModels > 0 ? Math.round((scoredModels / totalModels) * 100) : 0,
      totalJudges: judges.get(cat.id) ?? 0,
      completedJudges: completions.get(cat.id) ?? 0
    };
  });
}

/** One row of the ranking: frozen awards (aggregate/override) or the live preview of an open category. */
type AwardListRow = {
  id: string | null;
  modelId: string;
  modelName: string | null;
  code: string | null;
  displayNumber: number | null;
  categoryId: string;
  categoryName: string | null;
  totalScore: number | null;
  medalLabel: string | null;
  medalRank: number | null;
  votes: number;
  source: "aggregate" | "override" | "live";
  averageRank: number | null;
  issues: string[];
  overrideNote: string | null;
};

/** Display name of a judge: profile name, else "Giudice <seq>". Never the email. */
function judgeDisplayName(u: { seqId: number | null; firstName: string | null; lastName: string | null }) {
  const name = [u.firstName, u.lastName].map((s) => (s ?? "").trim()).filter(Boolean).join(" ");
  return name || `Giudice ${u.seqId ?? ""}`.trim();
}

const managerAwardRoutes = new Elysia({ prefix: "/awards" })
  .use(tenantMiddleware)
  .use(requireRole("manager"))
  .get("/events/:eventId", async ({ tenantDb, params }) => {
    // Load all categories for this event
    const cats = await tenantDb
      .select()
      .from(categoriesTable)
      .where(eq(categoriesTable.eventId, params.eventId as any));

    const closedCatIds = cats.filter(c => c.status === "closed").map(c => c.id);
    const openCatIds = cats.filter(c => c.status !== "closed").map(c => c.id);
    const codeFormat = await loadModelCodeFormatSettings(tenantDb);
    const rows: AwardListRow[] = [];

    // --- Frozen awards from closed categories: source "aggregate", or "override" when the head judge changed them ---
    if (closedCatIds.length > 0) {
      const frozen = await tenantDb
        .select({
          id: awardsTable.id,
          modelId: awardsTable.modelId,
          categoryId: awardsTable.categoryId,
          categoryName: categoriesTable.name,
          categorySeqId: categoriesTable.seqId,
          totalScore: awardsTable.totalScore,
          medalLabel: awardsTable.medalLabel,
          medalRank: awardsTable.medalRank,
          source: awardsTable.source,
          issues: awardsTable.issues,
          overrideNote: awardsTable.overrideNote,
          modelName: modelsTable.name,
          code: modelsTable.code,
          displayNumber: modelsTable.displayNumber,
          teamCode: modelsTable.teamCode
        })
        .from(awardsTable)
        .leftJoin(modelsTable, eq(modelsTable.id, awardsTable.modelId))
        .innerJoin(categoriesTable, eq(categoriesTable.id, awardsTable.categoryId))
        .where(inArray(awardsTable.categoryId, closedCatIds as any));

      for (const row of frozen as any[]) {
        rows.push({
          id: row.id,
          modelId: row.modelId,
          modelName: row.modelName ?? null,
          code: formatModelCode(row.code, row.categorySeqId, row.displayNumber, codeFormat, row.teamCode) || null,
          displayNumber: row.displayNumber ?? null,
          categoryId: row.categoryId,
          categoryName: row.categoryName ?? null,
          totalScore: row.totalScore,
          medalLabel: row.medalLabel,
          medalRank: row.medalRank,
          votes: 0,
          source: row.source === "override" ? "override" : "aggregate",
          averageRank: null,
          issues: parseAwardIssues(row.issues),
          overrideNote: row.overrideNote ?? null
        });
      }
    }

    // --- Live preview for open categories (missing models are not judged, so they are left out) ---
    if (openCatIds.length > 0) {
      const models = await tenantDb
        .select({
          modelId: modelsTable.id,
          modelName: modelsTable.name,
          categoryId: modelsTable.categoryId,
          categoryName: categoriesTable.name,
          categorySeqId: categoriesTable.seqId,
          code: modelsTable.code,
          displayNumber: modelsTable.displayNumber,
          teamCode: modelsTable.teamCode
        })
        .from(modelsTable)
        .innerJoin(categoriesTable, eq(categoriesTable.id, modelsTable.categoryId))
        .where(and(inArray(categoriesTable.id, openCatIds as any), eq(modelsTable.missing, false)));

      if (models.length > 0) {
        const modelIds = models.map((model: any) => model.modelId);
        const votes = await tenantDb
          .select({
            id: votesTable.id,
            modelId: votesTable.modelId,
            judgeId: votesTable.judgeId,
            rank: votesTable.rank,
            createdAt: votesTable.createdAt
          })
          .from(votesTable)
          .where(inArray(votesTable.modelId, modelIds as any))
          .orderBy(desc(votesTable.createdAt), desc(votesTable.seq));

        const latestRankByModel = new Map<string, Map<string, number>>();
        for (const vote of votes) {
          const perModel = latestRankByModel.get(vote.modelId) ?? new Map<string, number>();
          if (!perModel.has(vote.judgeId)) {
            perModel.set(vote.judgeId, vote.rank);
          }
          latestRankByModel.set(vote.modelId, perModel);
        }

        for (const model of models as any[]) {
          const ranks = Array.from(latestRankByModel.get(model.modelId)?.values() ?? []);
          const totalVotes = ranks.length;
          const averageRank = totalVotes > 0
            ? ranks.reduce((sum: number, rank: number) => sum + Number(rank), 0) / totalVotes
            : null;
          rows.push({
            id: null,
            modelId: model.modelId,
            modelName: model.modelName ?? null,
            code: formatModelCode(model.code, model.categorySeqId, model.displayNumber, codeFormat, model.teamCode) || null,
            displayNumber: model.displayNumber ?? null,
            categoryId: model.categoryId,
            categoryName: model.categoryName ?? null,
            totalScore: null,
            medalLabel: null,
            medalRank: null,
            votes: totalVotes,
            source: "live",
            averageRank,
            issues: [], // issues are computed when the category is closed
            overrideNote: null
          });
        }
      }
    }

    return rows.sort((a, b) => (b.averageRank ?? 0) - (a.averageRank ?? 0));
  }, {
    params: t.Object({ eventId: t.String() }),
    detail: {
      summary: "Classifica premi (frozen per categorie chiuse, live per aperte)",
      description: "source: aggregate | override (categorie chiuse) | live (anteprima categorie aperte, id null). Missing esclusi.",
      tags: ["Awards"],
      security: [{ bearerAuth: [] }]
    }
  });

/** Head judge (jury_president and above): override of an award and review of a closed category. */
const headJudgeAwardRoutes = new Elysia({ prefix: "/awards" })
  .use(tenantMiddleware)
  .use(requireRole("jury_president"))
  .patch("/:awardId", async ({ tenantDb, params, body, set, user }) => {
    const [award] = await tenantDb
      .select()
      .from(awardsTable)
      .where(eq(awardsTable.id, params.awardId as any));

    if (!award) {
      set.status = 404;
      return { error: "Award not found" };
    }

    const [cat] = await tenantDb
      .select({ eventId: categoriesTable.eventId, status: categoriesTable.status })
      .from(categoriesTable)
      .where(eq(categoriesTable.id, award.categoryId as any));
    if (!cat) {
      set.status = 404;
      return { error: "Category not found" };
    }

    const brackets = await tenantDb
      .select()
      .from(awardBracketsTable)
      .where(eq(awardBracketsTable.eventId, cat.eventId as any));
    if (!isOverrideMedalAllowed(brackets, body)) {
      set.status = 422;
      return { error: "Medal must be None (rank 0) or a bracket of the event with the same label and rank", code: "INVALID_MEDAL" };
    }

    if (cat.status !== "closed") {
      set.status = 409;
      return { error: "Can only override awards of closed categories", code: "CATEGORY_NOT_CLOSED" };
    }

    // The overridden medal is no longer derived from the votes: issues are cleared.
    await tenantDb
      .update(awardsTable)
      .set({
        medalLabel: body.medalLabel,
        medalRank: body.medalRank,
        source: "override",
        issues: null,
        overrideNote: body.note?.trim() || null,
        overriddenBy: user!.id
      })
      .where(eq(awardsTable.id, params.awardId as any));

    return { updated: true };
  }, {
    params: t.Object({ awardId: t.String() }),
    body: t.Object({
      medalLabel: t.String({ minLength: 1, maxLength: 40 }),
      medalRank: t.Integer({ minimum: 0, maximum: 10 }),
      note: t.Optional(t.String({ maxLength: 200 }))
    }),
    detail: {
      summary: "Override manuale premio (head judge)",
      description: "medalLabel/medalRank: 'None'/0 oppure una fascia del evento (stessa label e rank), altrimenti 422 INVALID_MEDAL. Categoria aperta: 409 CATEGORY_NOT_CLOSED. Azzera le issues, source = override.",
      tags: ["Awards"],
      security: [{ bearerAuth: [] }]
    }
  })
  .get("/categories/:categoryId/review", async ({ tenantDb, params, set }) => {
    const [cat] = await tenantDb
      .select({ id: categoriesTable.id, eventId: categoriesTable.eventId, name: categoriesTable.name, status: categoriesTable.status, seqId: categoriesTable.seqId })
      .from(categoriesTable)
      .where(eq(categoriesTable.id, params.categoryId as any));
    if (!cat) {
      set.status = 404;
      return { error: "Category not found" };
    }
    if (cat.status !== "closed") {
      set.status = 409;
      return { error: "Category is not closed", code: "CATEGORY_NOT_CLOSED" };
    }

    const store = new DrizzleClosureStore(tenantDb);
    const brackets = await store.listBrackets(cat.eventId);
    const awards = await tenantDb.select().from(awardsTable).where(eq(awardsTable.categoryId, cat.id as any));
    const awardByModel = new Map(awards.map((a: any) => [a.modelId as string, a]));
    const models = await tenantDb
      .select({ id: modelsTable.id, name: modelsTable.name, code: modelsTable.code, displayNumber: modelsTable.displayNumber, teamCode: modelsTable.teamCode })
      .from(modelsTable)
      .where(and(eq(modelsTable.categoryId, cat.id as any), eq(modelsTable.missing, false)));
    const modelIds = models.map((m: any) => m.id as string);

    // Latest vote per (judge, model), newest first in the query.
    const votes = modelIds.length
      ? latestVotePerJudgeModel(await tenantDb
        .select({ judgeId: votesTable.judgeId, modelId: votesTable.modelId, rank: votesTable.rank })
        .from(votesTable)
        .where(inArray(votesTable.modelId, modelIds as any))
        .orderBy(desc(votesTable.createdAt), desc(votesTable.seq)))
      : [];

    const judgeIds = [...new Set(votes.map((v) => v.judgeId))];
    const judges = judgeIds.length
      ? await tenantDb
        .select({ id: usersTable.id, seqId: usersTable.seqId, firstName: userProfilesTable.firstName, lastName: userProfilesTable.lastName })
        .from(usersTable)
        .leftJoin(userProfilesTable, eq(userProfilesTable.userId, usersTable.id))
        .where(inArray(usersTable.id, judgeIds as any))
      : [];
    const judgeNameById = new Map((judges as any[]).map((j) => [j.id as string, judgeDisplayName(j)]));
    const codeFormat = await loadModelCodeFormatSettings(tenantDb);

    const rows = models
      .map((m: any) => {
        const award = awardByModel.get(m.id) as any;
        return {
          modelId: m.id as string,
          name: m.name as string,
          code: formatModelCode(m.code, cat.seqId, m.displayNumber, codeFormat, m.teamCode) || null,
          displayNumber: (m.displayNumber ?? null) as number | null,
          totalScore: (award?.totalScore ?? null) as number | null,
          issues: parseAwardIssues(award?.issues),
          source: award ? (award.source === "override" ? "override" : "aggregate") : null,
          overrideNote: (award?.overrideNote ?? null) as string | null,
          award: award ? { id: award.id as string, medalLabel: award.medalLabel as string, medalRank: award.medalRank as number } : null,
          votes: votes
            .filter((v) => v.modelId === m.id)
            .map((v) => ({ judgeName: judgeNameById.get(v.judgeId) ?? "Giudice", rank: v.rank }))
            .sort((a, b) => a.judgeName.localeCompare(b.judgeName))
        };
      })
      .sort((a, b) => (a.displayNumber ?? Number.MAX_SAFE_INTEGER) - (b.displayNumber ?? Number.MAX_SAFE_INTEGER));

    return {
      categoryId: cat.id,
      categoryName: cat.name,
      eventId: cat.eventId,
      brackets: brackets
        .map((b: Bracket) => ({ medalLabel: b.medalLabel, medalRank: b.medalRank, lowLimit: b.lowLimit, highLimit: b.highLimit }))
        .sort((a: Bracket, b: Bracket) => a.medalRank - b.medalRank),
      rows
    };
  }, {
    params: t.Object({ categoryId: t.String() }),
    detail: {
      summary: "Revisione premi di una categoria chiusa (head judge)",
      description: "{ categoryId, categoryName, eventId, brackets (fasce dell'evento), rows: [{ modelId, name, code, displayNumber, totalScore, issues, source, overrideNote, award: {id, medalLabel, medalRank} | null, votes: [{ judgeName, rank }] }] }. Missing esclusi. 409 CATEGORY_NOT_CLOSED se la categoria è aperta.",
      tags: ["Awards"],
      security: [{ bearerAuth: [] }]
    }
  });

const monitoringRoutes = new Elysia({ prefix: "/awards" })
  .use(tenantMiddleware)
  .use(requireRole("jury_president"))
  .get("/monitoring/:eventId", async ({ tenantDb, params }) => {
    const cats = await tenantDb
      .select()
      .from(categoriesTable)
      .where(eq(categoriesTable.eventId, params.eventId as any));

    if (cats.length === 0) return [];
    const catIds = cats.map((c) => c.id);
    const eventId = params.eventId;

    // One aggregate query per metric for the whole event (instead of 4-5 queries per category).
    const [modelRows, judgeRows, scoredRows, completionRows] = await Promise.all([
      tenantDb
        .select({ categoryId: modelsTable.categoryId, count: sql<number>`count(*)::int` })
        .from(modelsTable)
        .where(and(inArray(modelsTable.categoryId, catIds as any), eq(modelsTable.missing, false)))
        .groupBy(modelsTable.categoryId),
      // Judges assigned to a category: direct assignment + event-wide (category_id IS NULL) ones, DISTINCT judges.
      tenantDb
        .select({ categoryId: categoriesTable.id, count: sql<number>`count(distinct ${judgeAssignmentsTable.judgeId})::int` })
        .from(categoriesTable)
        .innerJoin(judgeAssignmentsTable, or(
          eq(judgeAssignmentsTable.categoryId, categoriesTable.id),
          and(isNull(judgeAssignmentsTable.categoryId), eq(judgeAssignmentsTable.eventId, categoriesTable.eventId))
        ))
        .where(eq(categoriesTable.eventId, eventId as any))
        .groupBy(categoriesTable.id),
      // Distinct models (not missing) with at least one vote from a judge assigned to that model's category.
      tenantDb
        .select({ categoryId: modelsTable.categoryId, count: sql<number>`count(distinct ${votesTable.modelId})::int` })
        .from(votesTable)
        .innerJoin(modelsTable, eq(modelsTable.id, votesTable.modelId))
        .innerJoin(categoriesTable, eq(categoriesTable.id, modelsTable.categoryId))
        .where(and(
          inArray(modelsTable.categoryId, catIds as any),
          eq(modelsTable.missing, false),
          sql`exists (
            select 1 from ${judgeAssignmentsTable} ja
            where ja.judge_id = ${votesTable.judgeId}
              and (ja.category_id = ${modelsTable.categoryId}
                   or (ja.category_id is null and ja.event_id = ${categoriesTable.eventId}))
          )`
        ))
        .groupBy(modelsTable.categoryId),
      tenantDb
        .select({ categoryId: judgeCompletionsTable.categoryId, count: sql<number>`count(*)::int` })
        .from(judgeCompletionsTable)
        .where(inArray(judgeCompletionsTable.categoryId, catIds as any))
        .groupBy(judgeCompletionsTable.categoryId)
    ]);

    return buildMonitoringRows(cats as any, { models: modelRows, judges: judgeRows, scored: scoredRows, completions: completionRows });
  }, {
    params: t.Object({ eventId: t.String() }),
    beforeHandle: requireVisibleSection("dashboard"),
    detail: {
      summary: "Monitoraggio live giudici per categoria",
      tags: ["Awards"],
      security: [{ bearerAuth: [] }]
    }
  });

export const awardRoutes = new Elysia()
  .use(managerAwardRoutes)
  .use(headJudgeAwardRoutes)
  .use(monitoringRoutes);
