import { Elysia, t } from "elysia";
import { and, eq } from "drizzle-orm";
import { requireRole } from "../../../identity/infra/http/role.middleware";
import { tenantMiddleware } from "../../../tenancy/infra/http/tenant.middleware";
import { eventsTable, registrationsTable } from "../persistence/schema";

export const eventRoutes = new Elysia({ prefix: "/events" })
  .use(tenantMiddleware)
  .use(requireRole("manager"))
  .get("/", async ({ tenantDb }) => {
    return await tenantDb.select().from(eventsTable);
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
  .post("/:eventId/enroll", async ({ tenantDb, user, params, body, set }) => {
    const existing = await tenantDb
      .select()
      .from(registrationsTable)
      .where(and(eq(registrationsTable.userId, user!.id as any), eq(registrationsTable.eventId, params.eventId as any)));
    if (existing.length) {
      set.status = 400;
      return { error: "Already enrolled" };
    }
    const id = crypto.randomUUID();
    await tenantDb.insert(registrationsTable).values({
      id,
      userId: user!.id as any,
      eventId: params.eventId,
      modelId: body.modelId ?? null,
      categoryId: body.categoryId ?? null,
      status: "pending",
      checkedIn: false
    });
    return { id, status: "pending" };
  }, {
    params: t.Object({ eventId: t.String() }),
    body: t.Object({
      modelId: t.Optional(t.String()),
      categoryId: t.Optional(t.String())
    }),
    detail: {
      summary: "Iscrivi utente a evento",
      tags: ["Enrollments"],
      security: [{ bearerAuth: [] }]
    }
  });
