import { Elysia, t } from "elysia";
import { and, eq } from "drizzle-orm";
import { requireRole } from "../../../identity/infra/http/role.middleware";
import { registrationsTable } from "../persistence/schema";

export const userEnrollmentRoutes = new Elysia({ prefix: "/enrollments" })
  .use(requireRole("user"))
  .get("/", async ({ tenantDb, user }) => {
    return await tenantDb.select().from(registrationsTable).where(eq(registrationsTable.userId, user.id as any));
  }, {
    detail: {
      summary: "Lista iscrizioni utente",
      tags: ["Enrollments"],
      security: [{ bearerAuth: [] }]
    }
  })
  .get("/:enrollmentId", async ({ tenantDb, user, params, set }) => {
    const rows = await tenantDb
      .select()
      .from(registrationsTable)
      .where(and(eq(registrationsTable.id, params.enrollmentId as any), eq(registrationsTable.userId, user.id as any)));
    if (!rows.length) {
      set.status = 404;
      return { error: "Not found" };
    }
    return rows[0];
  }, {
    params: t.Object({ enrollmentId: t.String() }),
    detail: {
      summary: "Dettaglio iscrizione",
      tags: ["Enrollments"],
      security: [{ bearerAuth: [] }]
    }
  });

export const adminEnrollmentRoutes = new Elysia({ prefix: "/admin/enrollments" })
  .use(requireRole("manager"))
  .get("/", async ({ tenantDb, query }) => {
    const eventId = query?.eventId ? String(query.eventId) : null;
    if (eventId) {
      return await tenantDb.select().from(registrationsTable).where(eq(registrationsTable.eventId, eventId as any));
    }
    return await tenantDb.select().from(registrationsTable);
  }, {
    detail: {
      summary: "Lista iscrizioni (admin)",
      tags: ["Enrollments"],
      security: [{ bearerAuth: [] }]
    }
  })
  .patch("/:enrollmentId/status", async ({ tenantDb, params, body }) => {
    await tenantDb.update(registrationsTable).set({ status: body.status }).where(eq(registrationsTable.id, params.enrollmentId as any));
    return { updated: true };
  }, {
    params: t.Object({ enrollmentId: t.String() }),
    body: t.Object({ status: t.String() }),
    detail: {
      summary: "Aggiorna stato iscrizione",
      tags: ["Enrollments"],
      security: [{ bearerAuth: [] }]
    }
  });

export const staffCheckinRoutes = new Elysia({ prefix: "/staff" })
  .use(requireRole("staff"))
  .post("/checkin/:enrollmentId", async ({ tenantDb, params }) => {
    await tenantDb.update(registrationsTable).set({ checkedIn: true }).where(eq(registrationsTable.id, params.enrollmentId as any));
    return { checkedIn: true };
  }, {
    params: t.Object({ enrollmentId: t.String() }),
    detail: {
      summary: "Check-in partecipante",
      tags: ["Staff"],
      security: [{ bearerAuth: [] }]
    }
  })
  .get("/print/:enrollmentId", async ({ params }) => {
    return { message: `Badge for ${params.enrollmentId}` };
  }, {
    params: t.Object({ enrollmentId: t.String() }),
    detail: {
      summary: "Stampa badge (stub)",
      tags: ["Staff"],
      security: [{ bearerAuth: [] }]
    }
  });
