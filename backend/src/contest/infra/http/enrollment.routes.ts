import { Elysia, t } from "elysia";
import { and, eq } from "drizzle-orm";
import { requireRole } from "../../../identity/infra/http/role.middleware";
import { tenantMiddleware } from "../../../tenancy/infra/http/tenant.middleware";
import { registrationsTable } from "../persistence/schema";
import { usersTable, userProfilesTable } from "../../../identity/infra/persistence/schema";
import QRCode from "qrcode";

export const userEnrollmentRoutes = new Elysia({ prefix: "/enrollments" })
  .use(tenantMiddleware)
  .use(requireRole("user"))
  .get("/", async ({ tenantDb, user }) => {
    return await tenantDb.select().from(registrationsTable).where(eq(registrationsTable.userId, user!.id as any));
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
      .where(and(eq(registrationsTable.id, params.enrollmentId as any), eq(registrationsTable.userId, user!.id as any)));
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
  .use(tenantMiddleware)
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
  });

export const staffCheckinRoutes = new Elysia({ prefix: "/staff" })
  .use(tenantMiddleware)
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
  .get("/print/:enrollmentId", async ({ tenantDb, params, set }) => {
    // Fetch enrollment + user profile for badge
    const [enrollment] = await tenantDb
      .select()
      .from(registrationsTable)
      .where(eq(registrationsTable.id, params.enrollmentId as any));

    if (!enrollment) {
      set.status = 404;
      return { error: "Enrollment not found" };
    }

    const [profile] = await tenantDb
      .select({
        email: usersTable.email,
        firstName: userProfilesTable.firstName,
        lastName: userProfilesTable.lastName,
        city: userProfilesTable.city
      })
      .from(usersTable)
      .leftJoin(userProfilesTable, eq(usersTable.id, userProfilesTable.userId))
      .where(eq(usersTable.id, enrollment.userId as any));

    const qrDataUrl = await QRCode.toDataURL(`enrollment:${enrollment.id}`, { width: 200, margin: 1 });

    const name = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") || profile?.email || "Participant";

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Badge</title>
<style>
  @page { size: 86mm 54mm; margin: 0; }
  body { margin: 0; font-family: Arial, sans-serif; }
  .badge { width: 86mm; height: 54mm; padding: 4mm; box-sizing: border-box;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    border: 1px solid #ccc; }
  .badge h1 { font-size: 14pt; margin: 0 0 2mm; text-align: center; }
  .badge p { font-size: 9pt; margin: 0 0 1mm; color: #555; }
  .badge img { margin-top: 2mm; }
</style></head><body>
<div class="badge">
  <h1>${name}</h1>
  <p>${profile?.city ?? ""}</p>
  <p>ID: ${enrollment.id.slice(0, 8)}</p>
  <img src="${qrDataUrl}" width="100" height="100" />
</div>
</body></html>`;

    set.headers["content-type"] = "text/html; charset=utf-8";
    return html;
  }, {
    params: t.Object({ enrollmentId: t.String() }),
    detail: {
      summary: "Stampa badge (HTML con QR)",
      tags: ["Staff"],
      security: [{ bearerAuth: [] }]
    }
  });
