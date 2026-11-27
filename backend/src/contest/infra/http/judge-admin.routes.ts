import { Elysia, t } from "elysia";
import { eq, sql } from "drizzle-orm";
import { applyPage, withPagination } from "../../../shared/infra/http/pagination";
import { domainErrorHandler } from "../../../shared/infra/http/domainErrorHandler";
import { requireRole } from "../../../identity/infra/http/role.middleware";
import { tenantMiddleware } from "../../../tenancy/infra/http/tenant.middleware";
import { judgeAssignmentsTable } from "../persistence/schema";
import { usersTable } from "../../../identity/infra/persistence/schema";
import { VOTING_ROLES, type Role } from "../../../identity/domain/Role";

/** Only voting roles get assignments: not users, staff or the jury president (who supervises, never votes). */
const NOT_A_JUDGE = { error: "judgeId must be an active user with role judge, manager or admin", code: "NOT_A_JUDGE" };
async function isVotingUser(db: any, userId: string) {
  const [row] = await db.select({ role: usersTable.role, isActive: usersTable.isActive }).from(usersTable).where(eq(usersTable.id, userId as any));
  return !!row && row.isActive && VOTING_ROLES.includes(row.role as Role);
}

/** A stand-in judge covers one category only: standingIn without a category is refused (422). */
const STANDIN_NEEDS_CATEGORY = "standingIn requires a categoryId";

export const judgeAdminRoutes = new Elysia({ prefix: "/admin/judges" })
  .use(tenantMiddleware)
  .use(requireRole("manager"))
  .use(domainErrorHandler)
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
  .post("/assignments", async ({ tenantDb, body, set }) => {
    const categoryId = body.categoryId?.trim() ? body.categoryId.trim() : null;
    const standingIn = body.standingIn ?? false;
    if (standingIn && categoryId === null) {
      set.status = 422;
      return { error: STANDIN_NEEDS_CATEGORY };
    }
    if (!(await isVotingUser(tenantDb, body.judgeId))) {
      set.status = 422;
      return NOT_A_JUDGE;
    }
    const id = crypto.randomUUID();
    // Duplicate (same event, judge and category or event-wide) => 409 DUPLICATE from the unique index.
    await tenantDb.insert(judgeAssignmentsTable).values({
      id,
      eventId: body.eventId,
      judgeId: body.judgeId,
      categoryId,
      standingIn
    });
    return { id, standingIn };
  }, {
    body: t.Object({
      eventId: t.String({ format: "uuid" }),
      judgeId: t.String({ format: "uuid" }),
      categoryId: t.Optional(t.String({ format: "uuid" })),
      standingIn: t.Optional(t.Boolean())
    }),
    detail: {
      summary: "Assegna giudice (evento, categoria o come stand-in)",
      description: "Un giudice può avere più assegnazioni (una per categoria). categoryId assente = tutto l'evento. standingIn (solo con categoryId) = giudice sostituto della categoria. 409 se l'assegnazione esiste già.",
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
  .patch("/assignments/:assignmentId", async ({ tenantDb, params, body, set }) => {
    const categoryId = body.categoryId?.trim() ? body.categoryId.trim() : null;
    if (categoryId === null && body.standingIn === true) {
      set.status = 422;
      return { error: STANDIN_NEEDS_CATEGORY };
    }
    if (!(await isVotingUser(tenantDb, body.judgeId))) {
      set.status = 422;
      return NOT_A_JUDGE;
    }
    await tenantDb.update(judgeAssignmentsTable).set({
      eventId: body.eventId,
      judgeId: body.judgeId,
      categoryId,
      // Whole-event assignments are never stand-in; otherwise leave the flag as is unless it is sent.
      standingIn: categoryId === null ? false : body.standingIn
    }).where(eq(judgeAssignmentsTable.id, params.assignmentId as any));
    return { updated: true };
  }, {
    params: t.Object({ assignmentId: t.String() }),
    body: t.Object({
      eventId: t.String({ format: "uuid" }),
      judgeId: t.String({ format: "uuid" }),
      categoryId: t.Optional(t.String({ format: "uuid" })),
      standingIn: t.Optional(t.Boolean())
    }),
    detail: {
      summary: "Modifica assegnazione giudice",
      description: "Imposta standingIn (true/false) per attivare o disattivare il giudice sostituto della categoria. 409 se diventa un duplicato.",
      tags: ["Admin"],
      security: [{ bearerAuth: [] }]
    }
  });
