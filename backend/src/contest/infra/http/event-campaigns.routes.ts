import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";
import { requireRole } from "../../../identity/infra/http/role.middleware";
import { tenantMiddleware } from "../../../tenancy/infra/http/tenant.middleware";
import { eventCampaignsTable } from "../persistence/schema";

// Manager CRUD for event campaigns (Task 10)
export const eventCampaignsRoutes = new Elysia({ prefix: "/admin/event-campaigns" })
  .use(tenantMiddleware)
  .use(requireRole("manager"))
  .get("/", async ({ tenantDb, query }) => {
    const eventId = query?.eventId ? String(query.eventId) : null;
    if (eventId) {
      return await tenantDb
        .select()
        .from(eventCampaignsTable)
        .where(eq(eventCampaignsTable.eventId, eventId as any));
    }
    return await tenantDb.select().from(eventCampaignsTable);
  }, {
    detail: {
      summary: "Lista campagne evento",
      tags: ["Admin"],
      security: [{ bearerAuth: [] }]
    }
  })
  .post("/", async ({ tenantDb, body }) => {
    const id = crypto.randomUUID();
    await tenantDb.insert(eventCampaignsTable).values({
      id,
      eventId: body.eventId,
      name: body.name,
      enrollmentOpenDate: body.enrollmentOpenDate ?? null,
      enrollmentCloseDate: body.enrollmentCloseDate ?? null
    });
    return { id };
  }, {
    body: t.Object({
      eventId: t.String(),
      name: t.String(),
      enrollmentOpenDate: t.Optional(t.String()),
      enrollmentCloseDate: t.Optional(t.String())
    }),
    detail: {
      summary: "Crea campagna evento",
      tags: ["Admin"],
      security: [{ bearerAuth: [] }]
    }
  })
  .put("/:campaignId", async ({ tenantDb, params, body }) => {
    await tenantDb
      .update(eventCampaignsTable)
      .set(body as any)
      .where(eq(eventCampaignsTable.id, params.campaignId as any));
    return { updated: true };
  }, {
    params: t.Object({ campaignId: t.String() }),
    body: t.Object({
      name: t.Optional(t.String()),
      enrollmentOpenDate: t.Optional(t.String()),
      enrollmentCloseDate: t.Optional(t.String())
    }),
    detail: {
      summary: "Aggiorna campagna evento",
      tags: ["Admin"],
      security: [{ bearerAuth: [] }]
    }
  })
  .delete("/:campaignId", async ({ tenantDb, params }) => {
    await tenantDb
      .delete(eventCampaignsTable)
      .where(eq(eventCampaignsTable.id, params.campaignId as any));
    return { deleted: true };
  }, {
    params: t.Object({ campaignId: t.String() }),
    detail: {
      summary: "Elimina campagna evento",
      tags: ["Admin"],
      security: [{ bearerAuth: [] }]
    }
  });
