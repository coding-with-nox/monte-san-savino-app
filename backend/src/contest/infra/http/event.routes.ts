import { Elysia, t } from "elysia";
import { and, eq, sql } from "drizzle-orm";
import { requireRole } from "../../../identity/infra/http/role.middleware";
import { tenantMiddleware } from "../../../tenancy/infra/http/tenant.middleware";
import { categoriesTable, eventsTable, modelsTable, registrationsTable } from "../persistence/schema";
import { planEnrollment } from "../../domain/enrollment";
import { isEventEnrollmentClosed } from "./enrollment-guard";
import { isRegistrationClosed } from "../persistence/registrationSettings";
import { applyPage, withPagination } from "../../../shared/infra/http/pagination";
import { domainErrorHandler } from "../../../shared/infra/http/domainErrorHandler";
import { hasPermission } from "../../../identity/infra/http/permission.middleware";
import { logger } from "../../../shared/infra/logger/logger";

export const eventRoutes = new Elysia({ prefix: "/events" })
  .use(tenantMiddleware)
  .use(requireRole("manager"))
  .get("/", async ({ tenantDb, query, set }) => {
    return await withPagination(
      { query: query as any, set: set as any },
      async () => Number((await tenantDb.select({ n: sql<number>`count(*)::int` }).from(eventsTable))[0]?.n ?? 0),
      (page) => applyPage(tenantDb.select().from(eventsTable).$dynamic(), eventsTable.id, page)
    );
  }, {
    detail: {
      summary: "Lista eventi",
      tags: ["Events"],
      security: [{ bearerAuth: [] }]
    }
  })
  .post("/", async ({ tenantDb, body }) => {
    const id = crypto.randomUUID();
    await tenantDb.insert(eventsTable).values({
      id,
      name: body.name,
      status: body.status,
      startDate: body.startDate ?? null,
      endDate: body.endDate ?? null
    });
    return { id };
  }, {
    body: t.Object({
      name: t.String(),
      status: t.String(),
      startDate: t.Optional(t.String()),
      endDate: t.Optional(t.String())
    }),
    detail: {
      summary: "Crea evento",
      tags: ["Events"],
      security: [{ bearerAuth: [] }]
    }
  })
  .get("/:eventId", async ({ tenantDb, params }) => {
    const rows = await tenantDb.select().from(eventsTable).where(eq(eventsTable.id, params.eventId as any));
    return rows[0] ?? null;
  }, {
    params: t.Object({ eventId: t.String() }),
    detail: {
      summary: "Dettaglio evento",
      tags: ["Events"],
      security: [{ bearerAuth: [] }]
    }
  })
  .put("/:eventId", async ({ tenantDb, params, body }) => {
    await tenantDb.update(eventsTable).set(body).where(eq(eventsTable.id, params.eventId as any));
    return { updated: true };
  }, {
    params: t.Object({ eventId: t.String() }),
    body: t.Object({
      name: t.Optional(t.String()),
      status: t.Optional(t.String()),
      startDate: t.Optional(t.String()),
      endDate: t.Optional(t.String())
    }),
    detail: {
      summary: "Aggiorna evento",
      tags: ["Events"],
      security: [{ bearerAuth: [] }]
    }
  })
  .delete("/:eventId", async ({ tenantDb, params }) => {
    await tenantDb.delete(eventsTable).where(eq(eventsTable.id, params.eventId as any));
    return { deleted: true };
  }, {
    params: t.Object({ eventId: t.String() }),
    detail: {
      summary: "Elimina evento",
      tags: ["Events"],
      security: [{ bearerAuth: [] }]
    }
  });

export const enrollmentRoutes = new Elysia({ prefix: "/events" })
  .use(tenantMiddleware)
  .use(requireRole("user"))
  .use(domainErrorHandler)
  .post("/:eventId/enroll", async ({ tenantDb, user, params, body, set }) => {
    const db = tenantDb as any;
    const [event] = await db.select({ id: eventsTable.id, status: eventsTable.status }).from(eventsTable)
      .where(eq(eventsTable.id, params.eventId as any));
    let model = null;
    if (body.modelId) {
      [model] = await db.select({ id: modelsTable.id, userId: modelsTable.userId, categoryId: modelsTable.categoryId })
        .from(modelsTable).where(eq(modelsTable.id, body.modelId as any));
    }
    const categoryId = body.categoryId ?? model?.categoryId ?? null;
    let category = null;
    if (categoryId) {
      [category] = await db.select({ id: categoriesTable.id, eventId: categoriesTable.eventId, status: categoriesTable.status })
        .from(categoriesTable).where(eq(categoriesTable.id, categoryId as any));
    }
    const plan = planEnrollment({
      userId: user!.id,
      role: user!.role,
      eventId: params.eventId,
      event: event ?? null,
      category: category ?? null,
      model: model ?? null,
      requested: { modelId: body.modelId ?? null, categoryId: body.categoryId ?? null },
      windowClosed: await isEventEnrollmentClosed(db, params.eventId),
      registrationClosed: await isRegistrationClosed(db),
      canEnrollOnBehalf: await hasPermission(db, user!.role, "enrollOnBehalf")
    });

    // Task 02: one enrollment per user+event+model (multiple models allowed).
    // The advisory lock serializes concurrent requests for the same user+event so the
    // check+insert below cannot create duplicates even when the unique index does not exist.
    const id = crypto.randomUUID();
    const inserted: { id: string }[] = await db.transaction(async (tx: any) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`enroll:${plan.ownerUserId}:${params.eventId}`}, 0))`);
      const whereClause = plan.modelId
        ? and(
            eq(registrationsTable.userId, plan.ownerUserId as any),
            eq(registrationsTable.eventId, params.eventId as any),
            eq(registrationsTable.modelId, plan.modelId as any)
          )
        : and(
            eq(registrationsTable.userId, plan.ownerUserId as any),
            eq(registrationsTable.eventId, params.eventId as any)
          );
      const existing = await tx.select({ id: registrationsTable.id }).from(registrationsTable).where(whereClause).limit(1);
      if (existing.length) return [];
      return await tx.insert(registrationsTable).values({
        id,
        userId: plan.ownerUserId as any,
        eventId: params.eventId,
        modelId: plan.modelId,
        categoryId: plan.categoryId,
        status: "accepted",
        checkedIn: false
      }).onConflictDoNothing().returning({ id: registrationsTable.id });
    });
    if (!inserted.length) {
      set.status = 400;
      return { error: "Already enrolled" };
    }
    if (plan.ownerUserId !== user!.id) {
      logger.info(
        { actorId: user!.id, actorRole: user!.role, ownerId: plan.ownerUserId, modelId: plan.modelId, registrationId: id },
        "Enrollment on behalf of another user"
      );
    }
    return { id, status: "accepted" };
  }, {
    params: t.Object({ eventId: t.String({ format: "uuid" }) }),
    body: t.Object({
      modelId: t.Optional(t.String({ format: "uuid" })),
      categoryId: t.Optional(t.String({ format: "uuid" }))
    }),
    detail: {
      summary: "Iscrivi utente a evento",
      description: "Il modello deve appartenere all'utente (manager/admin o permesso enrollOnBehalf: qualsiasi), la categoria deve essere coerente con modello ed evento ed essere aperta; periodo iscrizioni rispettato (manager esenti).",
      tags: ["Enrollments"],
      security: [{ bearerAuth: [] }]
    }
  });
