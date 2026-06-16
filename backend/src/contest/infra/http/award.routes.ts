import { Elysia, t } from "elysia";
import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
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
          .orderBy(desc(votesTable.createdAt), desc(votesTable.id));

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
    return combined.sort((a, b) => (b.averageRank ?? 0) - (a.averageRank ?? 0));
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

    return await Promise.all(cats.map(async (cat) => {
      // Count models in category
      const models = await tenantDb
        .select({ id: modelsTable.id })
        .from(modelsTable)
        .where(eq(modelsTable.categoryId, cat.id as any));
      const totalModels = models.length;

      // Count judges assigned to this category (direct + event-wide)
      const judges = await tenantDb
        .select({ judgeId: judgeAssignmentsTable.judgeId })
        .from(judgeAssignmentsTable)
        .where(or(
          eq(judgeAssignmentsTable.categoryId, cat.id as any),
          and(
            isNull(judgeAssignmentsTable.categoryId),
            eq(judgeAssignmentsTable.eventId, cat.eventId as any)
          )
        ));
      const totalJudges = judges.length;

      // Count distinct models that received at least one vote from assigned judges
      let scoredModels = 0;
      if (totalModels > 0 && totalJudges > 0) {
        const judgeIds = judges.map(j => j.judgeId);
        const modelIds = models.map(m => m.id);
        const votes = await tenantDb
          .select({ judgeId: votesTable.judgeId, modelId: votesTable.modelId })
          .from(votesTable)
          .where(and(
            inArray(votesTable.judgeId, judgeIds as any),
            inArray(votesTable.modelId, modelIds as any)
          ));
        scoredModels = new Set(votes.map(v => v.modelId)).size;
      }

      // Count judge completions for this category
      const completions = await tenantDb
        .select({ id: judgeCompletionsTable.id })
        .from(judgeCompletionsTable)
        .where(eq(judgeCompletionsTable.categoryId, cat.id as any));

      const percentComplete = totalModels > 0
        ? Math.round((scoredModels / totalModels) * 100)
        : 0;

      return {
        categoryId: cat.id,
        categoryName: cat.name,
        status: cat.status,
        totalModels,
        scoredModels,
        percentComplete,
        totalJudges,
        completedJudges: completions.length
      };
    }));
  }, {
    params: t.Object({ eventId: t.String() }),
    detail: {
      summary: "Monitoraggio live giudici per categoria",
      tags: ["Awards"],
      security: [{ bearerAuth: [] }]
    }
  });
