import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";
import { requireRole } from "../../../identity/infra/http/role.middleware";
import { tenantMiddleware } from "../../../tenancy/infra/http/tenant.middleware";
import { judgeAssignmentsTable } from "../persistence/schema";

export const judgeAdminRoutes = new Elysia({ prefix: "/admin/judges" })
  .use(tenantMiddleware)
  .use(requireRole("manager"))
  .get("/assignments", async ({ tenantDb, query }) => {
    const eventId = query?.eventId ? String(query.eventId) : null;
    if (eventId) {
      return await tenantDb.select().from(judgeAssignmentsTable).where(eq(judgeAssignmentsTable.eventId, eventId as any));
    }
    return await tenantDb.select().from(judgeAssignmentsTable);
  }, {
    detail: {
      summary: "Lista assegnazioni giudici",
      tags: ["Admin"],
      security: [{ bearerAuth: [] }]
    }
  })
  .post("/assignments", async ({ tenantDb, body }) => {
    const id = crypto.randomUUID();
    await tenantDb.insert(judgeAssignmentsTable).values({
      id,
      eventId: body.eventId,
      judgeId: body.judgeId
    });
    return { id };
  }, {
    body: t.Object({ eventId: t.String(), judgeId: t.String() }),
    detail: {
      summary: "Assegna giudice",
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
  });
