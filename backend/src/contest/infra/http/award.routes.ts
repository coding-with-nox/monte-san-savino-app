import { Elysia, t } from "elysia";
import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { requireRole } from "../../../identity/infra/http/role.middleware";
import { tenantMiddleware } from "../../../tenancy/infra/http/tenant.middleware";
import {
  awardsTable,
  categoriesTable,
  judgeAssignmentsTable,
  judgeCompletionsTable,
  modelsTable,
  votesTable
} from "../persistence/schema";

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

export const awardRoutes = new Elysia({ prefix: "/awards" })
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

    // --- Frozen awards from closed categories ---
    const frozenRows: Array<{
      id: string;
      modelId: string;
      categoryId: string;
      totalScore: number | null;
      medalLabel: string | null;
      medalRank: number | null;
      votes: number;
      source: "live" | "frozen";
      averageRank: number | null;
    }> = [];

    if (closedCatIds.length > 0) {
      const frozen = await tenantDb
        .select({
          id: awardsTable.id,
          modelId: awardsTable.modelId,
          categoryId: awardsTable.categoryId,
          totalScore: awardsTable.totalScore,
          medalLabel: awardsTable.medalLabel,
          medalRank: awardsTable.medalRank
        })
        .from(awardsTable)
        .where(inArray(awardsTable.categoryId, closedCatIds as any));

      for (const row of frozen) {
        frozenRows.push({
          id: row.id,
          modelId: row.modelId,
          categoryId: row.categoryId,
          totalScore: row.totalScore,
          medalLabel: row.medalLabel,
          medalRank: row.medalRank,
          votes: 0,
          source: "frozen",
          averageRank: null
        });
      }
    }

    // --- Live preview for open categories ---
    const liveRows: Array<{
      modelId: string;
      categoryId: string;
      totalScore: number | null;
      medalLabel: string | null;
      medalRank: number | null;
      votes: number;
      source: "live" | "frozen";
      averageRank: number | null;
    }> = [];

    if (openCatIds.length > 0) {
      const models = await tenantDb
        .select({
          modelId: modelsTable.id,
          modelName: modelsTable.name,
          categoryId: modelsTable.categoryId
        })
        .from(modelsTable)
        .innerJoin(categoriesTable, eq(categoriesTable.id, modelsTable.categoryId))
        .where(inArray(categoriesTable.id, openCatIds as any));

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
          liveRows.push({
            modelId: model.modelId,
            categoryId: model.categoryId,
            totalScore: null,
            medalLabel: null,
            medalRank: null,
            votes: totalVotes,
            source: "live",
            averageRank
          });
        }
      }
    }

    const combined = [...frozenRows, ...liveRows];
    const allModelIds = Array.from(new Set(combined.map((r) => r.modelId)));
    const nameRows = allModelIds.length > 0
      ? await tenantDb
        .select({ id: modelsTable.id, name: modelsTable.name })
        .from(modelsTable)
        .where(inArray(modelsTable.id, allModelIds as any))
      : [];
    const nameById = new Map<string, string>((nameRows as any[]).map((m) => [m.id, m.name]));
    return combined
      .map((r) => ({ ...r, modelName: nameById.get(r.modelId) ?? null }))
      .sort((a, b) => (b.averageRank ?? 0) - (a.averageRank ?? 0));
  }, {
    params: t.Object({ eventId: t.String() }),
    detail: {
      summary: "Classifica premi (frozen per categorie chiuse, live per aperte)",
      tags: ["Awards"],
      security: [{ bearerAuth: [] }]
    }
  })
  .patch("/:awardId", async ({ tenantDb, params, body, set }) => {
    const [award] = await tenantDb
      .select()
      .from(awardsTable)
      .where(eq(awardsTable.id, params.awardId as any));

    if (!award) {
      set.status = 404;
      return { error: "Award not found" };
    }

    const [cat] = await tenantDb
      .select()
      .from(categoriesTable)
      .where(eq(categoriesTable.id, award.categoryId as any));

    if (!cat || cat.status !== "closed") {
      set.status = 400;
      return { error: "Can only override awards on closed categories" };
    }

    await tenantDb
      .update(awardsTable)
      .set({
        medalLabel: body.medalLabel,
        medalRank: body.medalRank,
        source: "override"
      })
      .where(eq(awardsTable.id, params.awardId as any));

    return { updated: true };
  }, {
    params: t.Object({ awardId: t.String() }),
    body: t.Object({ medalLabel: t.String(), medalRank: t.Integer() }),
    detail: {
      summary: "Override manuale premio (head judge)",
      tags: ["Awards"],
      security: [{ bearerAuth: [] }]
    }
  })
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
        .where(inArray(modelsTable.categoryId, catIds as any))
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
      // Distinct models with at least one vote from a judge assigned to that model's category.
      tenantDb
        .select({ categoryId: modelsTable.categoryId, count: sql<number>`count(distinct ${votesTable.modelId})::int` })
        .from(votesTable)
        .innerJoin(modelsTable, eq(modelsTable.id, votesTable.modelId))
        .innerJoin(categoriesTable, eq(categoriesTable.id, modelsTable.categoryId))
        .where(and(
          inArray(modelsTable.categoryId, catIds as any),
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
    detail: {
      summary: "Monitoraggio live giudici per categoria",
      tags: ["Awards"],
      security: [{ bearerAuth: [] }]
    }
  });
