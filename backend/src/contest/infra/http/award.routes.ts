import { Elysia, t } from "elysia";
import { desc, eq, sql } from "drizzle-orm";
import { requireRole } from "../../../identity/infra/http/role.middleware";
import { tenantMiddleware } from "../../../tenancy/infra/http/tenant.middleware";
import { categoriesTable, modelsTable, votesTable } from "../persistence/schema";

export const awardRoutes = new Elysia({ prefix: "/awards" })
  .use(tenantMiddleware)
  .use(requireRole("manager"))
  .get("/events/:eventId", async ({ tenantDb, params }) => {
    const models = await tenantDb
      .select({
        modelId: modelsTable.id,
        modelName: modelsTable.name,
        categoryId: modelsTable.categoryId
      })
      .from(modelsTable)
      .innerJoin(categoriesTable, eq(categoriesTable.id, modelsTable.categoryId))
      .where(eq(categoriesTable.eventId, params.eventId as any));

    if (models.length === 0) {
      return [];
    }

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
      .where(sql`${votesTable.modelId} = ANY(${modelIds})`)
      .orderBy(desc(votesTable.createdAt), desc(votesTable.id));

    const latestRankByModel = new Map<string, Map<string, number>>();
    for (const vote of votes) {
      const perModel = latestRankByModel.get(vote.modelId) ?? new Map<string, number>();
      if (!perModel.has(vote.judgeId)) {
        perModel.set(vote.judgeId, vote.rank);
      }
      latestRankByModel.set(vote.modelId, perModel);
    }

    const rows = models.map((model: any) => {
      const ranks = Array.from(latestRankByModel.get(model.modelId)?.values() ?? []);
      const totalVotes = ranks.length;
      const averageRank = totalVotes > 0
        ? ranks.reduce((sum, rank) => sum + Number(rank), 0) / totalVotes
        : null;
      return {
        ...model,
        averageRank,
        votes: totalVotes
      };
    });

    return rows.sort((a, b) => (b.averageRank ?? 0) - (a.averageRank ?? 0));
  }, {
    params: t.Object({ eventId: t.String() }),
    detail: {
      summary: "Classifica premi",
      tags: ["Awards"],
      security: [{ bearerAuth: [] }]
    }
  });
