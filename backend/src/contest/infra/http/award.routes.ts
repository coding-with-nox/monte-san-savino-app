import { Elysia, t } from "elysia";
import { and, eq, sql } from "drizzle-orm";
import { requireRole } from "../../../identity/infra/http/role.middleware";
import { categoriesTable, modelsTable, votesTable } from "../persistence/schema";

export const awardRoutes = new Elysia({ prefix: "/awards" })
  .use(requireRole("manager"))
  .get("/events/:eventId", async ({ tenantDb, params }) => {
    const rows = await tenantDb
      .select({
        modelId: modelsTable.id,
        modelName: modelsTable.name,
        categoryId: modelsTable.categoryId,
        averageRank: sql<number>`avg(${votesTable.rank})`,
        votes: sql<number>`count(${votesTable.id})`
      })
      .from(modelsTable)
      .innerJoin(categoriesTable, eq(categoriesTable.id, modelsTable.categoryId))
      .leftJoin(votesTable, eq(votesTable.modelId, modelsTable.id))
      .where(eq(categoriesTable.eventId, params.eventId as any))
      .groupBy(modelsTable.id);
    return rows.sort((a, b) => (b.averageRank ?? 0) - (a.averageRank ?? 0));
  }, {
    params: t.Object({ eventId: t.String() }),
    detail: {
      summary: "Classifica premi",
      tags: ["Awards"],
      security: [{ bearerAuth: [] }]
    }
  });
