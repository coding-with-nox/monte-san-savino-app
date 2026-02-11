import { Elysia, t } from "elysia";
import { and, eq, sql } from "drizzle-orm";
import { requireRole } from "../../../identity/infra/http/role.middleware";
import { tenantMiddleware } from "../../../tenancy/infra/http/tenant.middleware";
import { categoriesTable, judgeAssignmentsTable, modelsTable, votesTable } from "../persistence/schema";

export const categoryRoutes = new Elysia({ prefix: "/categories" })
  .use(tenantMiddleware)
  .use(requireRole("manager"))
  .get("/", async ({ tenantDb, query }) => {
    const eventId = query?.eventId ? String(query.eventId) : null;
    if (eventId) {
      return await tenantDb.select().from(categoriesTable).where(eq(categoriesTable.eventId, eventId as any));
    }
    return await tenantDb.select().from(categoriesTable);
  }, {
    detail: {
      summary: "Lista categorie",
      tags: ["Categories"],
      security: [{ bearerAuth: [] }]
    }
  })
  .post("/", async ({ tenantDb, body, set }) => {
    const existing = await tenantDb.select().from(categoriesTable)
      .where(and(eq(categoriesTable.eventId, body.eventId as any), eq(categoriesTable.name, body.name as any)));
    if (existing.length > 0) {
      set.status = 409;
      return { error: "A category with this name already exists for this event" };
    }
    const id = crypto.randomUUID();
    await tenantDb.insert(categoriesTable).values({ id, eventId: body.eventId, name: body.name, status: "open" });
    return { id };
  }, {
    body: t.Object({ eventId: t.String(), name: t.String() }),
    detail: {
      summary: "Crea categoria",
      tags: ["Categories"],
      security: [{ bearerAuth: [] }]
    }
  })
  .put("/:categoryId", async ({ tenantDb, params, body }) => {
    await tenantDb.update(categoriesTable).set(body).where(eq(categoriesTable.id, params.categoryId as any));
    return { updated: true };
  }, {
    params: t.Object({ categoryId: t.String() }),
    body: t.Object({ name: t.Optional(t.String()) }),
    detail: {
      summary: "Aggiorna categoria",
      tags: ["Categories"],
      security: [{ bearerAuth: [] }]
    }
  })
  .delete("/:categoryId", async ({ tenantDb, params }) => {
    await tenantDb.delete(categoriesTable).where(eq(categoriesTable.id, params.categoryId as any));
    return { deleted: true };
  }, {
    params: t.Object({ categoryId: t.String() }),
    detail: {
      summary: "Elimina categoria",
      tags: ["Categories"],
      security: [{ bearerAuth: [] }]
    }
  })
  .patch("/:categoryId/status", async ({ tenantDb, params, body, set }) => {
    if (body.status === "closed") {
      // Validate: all judges assigned to this event must have voted on every model in this category
      const [category] = await tenantDb.select().from(categoriesTable).where(eq(categoriesTable.id, params.categoryId as any));
      if (!category) {
        set.status = 404;
        return { error: "Category not found" };
      }

      // Get all judges assigned to this event
      const judges = await tenantDb
        .select({ judgeId: judgeAssignmentsTable.judgeId })
        .from(judgeAssignmentsTable)
        .where(eq(judgeAssignmentsTable.eventId, category.eventId as any));

      // Get all models in this category
      const models = await tenantDb
        .select({ id: modelsTable.id })
        .from(modelsTable)
        .where(eq(modelsTable.categoryId, params.categoryId as any));

      if (judges.length > 0 && models.length > 0) {
        // Count expected votes vs actual votes
        const expectedVotes = judges.length * models.length;
        const modelIds = models.map(m => m.id);

        const [result] = await tenantDb
          .select({ count: sql<number>`count(*)` })
          .from(votesTable)
          .where(
            and(
              sql`${votesTable.modelId} = ANY(${modelIds})`,
              sql`${votesTable.judgeId} = ANY(${judges.map(j => j.judgeId)})`
            )
          );

        if (Number(result.count) < expectedVotes) {
          set.status = 400;
          return {
            error: "Cannot close category: not all judges have voted on all models",
            expected: expectedVotes,
            actual: Number(result.count)
          };
        }
      }
    }

    await tenantDb.update(categoriesTable)
      .set({ status: body.status })
      .where(eq(categoriesTable.id, params.categoryId as any));
    return { updated: true, status: body.status };
  }, {
    params: t.Object({ categoryId: t.String() }),
    body: t.Object({ status: t.Union([t.Literal("open"), t.Literal("closed")]) }),
    detail: {
      summary: "Apri/chiudi categoria",
      description: "Per chiudere una categoria tutti i giudici devono aver votato tutti i modelli.",
      tags: ["Categories"],
      security: [{ bearerAuth: [] }]
    }
  });
