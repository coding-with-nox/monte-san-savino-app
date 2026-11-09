import { Elysia, t } from "elysia";
import { eq, sql } from "drizzle-orm";
import { applyPage, withPagination } from "../../../shared/infra/http/pagination";
import { requireRole } from "../../../identity/infra/http/role.middleware";
import { tenantMiddleware } from "../../../tenancy/infra/http/tenant.middleware";
import { judgeAssignmentsTable } from "../persistence/schema";

export const judgeAdminRoutes = new Elysia({ prefix: "/admin/judges" })
  .use(tenantMiddleware)
  .use(requireRole("manager"))
  .get("/assignments", async ({ tenantDb, query, set }) => {
    const eventId = query?.eventId ? String(query.eventId) : null;
    const where = eventId ? eq(judgeAssignmentsTable.eventId, eventId as any) : undefined;
    return await withPagination(
      { query: query as any, set: set as any },
      async () => Number((await tenantDb.select({ n: sql<number>`count(*)::int` }).from(judgeAssignmentsTable).where(where))[0]?.n ?? 0),
      (page) => applyPage(tenantDb.select().from(judgeAssignmentsTable).where(where).$dynamic(), judgeAssignmentsTable.id, page)
    );
  }, {
    detail: {
      summary: "Lista assegnazioni giudici",
      tags: ["Admin"],
      security: [{ bearerAuth: [] }]
    }
  })
  .post("/assignments", async ({ tenantDb, body }) => {
    const id = crypto.randomUUID();
    const categoryId = body.categoryId?.trim() ? body.categoryId.trim() : null;
    await tenantDb.insert(judgeAssignmentsTable).values({
      id,
      eventId: body.eventId,
      judgeId: body.judgeId,
      categoryId
    });
    return { id };
  }, {
    body: t.Object({
      eventId: t.String({ format: "uuid" }),
      judgeId: t.String({ format: "uuid" }),
      categoryId: t.Optional(t.String({ format: "uuid" }))
    }),
    detail: {
      summary: "Assegna giudice (evento o categoria)",
      description: "Se categoryId è fornito, il giudice è assegnato a quella specifica categoria. Altrimenti a tutto l'evento.",
      tags: ["Admin"],
      security: [{ bearerAuth: [] }]
    }
  })
  .delete("/assignments/:assignmentId", async ({ tenantDb, params }) => {
    await tenantDb.delete(judgeAssignmentsTable).where(eq(judgeAssignmentsTable.id, params.assignmentId as any));
    return { deleted: true };
  }, {
    params: t.Object({ assignmentId: t.String() }),
    detail: {
      summary: "Rimuovi assegnazione giudice",
      tags: ["Admin"],
      security: [{ bearerAuth: [] }]
    }
  })
  .patch("/assignments/:assignmentId", async ({ tenantDb, params, body }) => {
    const categoryId = body.categoryId?.trim() ? body.categoryId.trim() : null;
    await tenantDb.update(judgeAssignmentsTable).set({
      eventId: body.eventId,
      judgeId: body.judgeId,
      categoryId
    }).where(eq(judgeAssignmentsTable.id, params.assignmentId as any));
    return { updated: true };
  }, {
    params: t.Object({ assignmentId: t.String() }),
    body: t.Object({
      eventId: t.String({ format: "uuid" }),
      judgeId: t.String({ format: "uuid" }),
      categoryId: t.Optional(t.String({ format: "uuid" }))
    }),
    detail: {
      summary: "Modifica assegnazione giudice",
      tags: ["Admin"],
      security: [{ bearerAuth: [] }]
    }
  });
