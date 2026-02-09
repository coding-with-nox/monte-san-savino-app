import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";
import { requireRole } from "../../../identity/infra/http/role.middleware";
import { tenantMiddleware } from "../../../tenancy/infra/http/tenant.middleware";
import { sponsorsTable } from "../persistence/schema";

export const sponsorRoutes = new Elysia({ prefix: "/sponsors" })
  .use(tenantMiddleware)
  .use(requireRole("manager"))
  .get("/", async ({ tenantDb, query }) => {
    const eventId = query?.eventId ? String(query.eventId) : null;
    if (eventId) {
      return await tenantDb.select().from(sponsorsTable).where(eq(sponsorsTable.eventId, eventId as any));
    }
    return await tenantDb.select().from(sponsorsTable);
  }, {
    detail: {
      summary: "Lista sponsor",
      tags: ["Events"],
      security: [{ bearerAuth: [] }]
    }
  })
  .post("/", async ({ tenantDb, body }) => {
    const id = crypto.randomUUID();
    await tenantDb.insert(sponsorsTable).values({
      id,
      eventId: body.eventId,
      name: body.name,
      logoUrl: body.logoUrl ?? null,
      websiteUrl: body.websiteUrl ?? null,
      description: body.description ?? null,
      tier: body.tier ?? "bronze"
    });
    return { id };
  }, {
    body: t.Object({
      eventId: t.String(),
      name: t.String(),
      logoUrl: t.Optional(t.String()),
      websiteUrl: t.Optional(t.String()),
      description: t.Optional(t.String()),
      tier: t.Optional(t.Union([
        t.Literal("bronze"),
        t.Literal("silver"),
        t.Literal("gold"),
        t.Literal("platinum")
      ]))
    }),
    detail: {
      summary: "Crea sponsor",
      tags: ["Events"],
      security: [{ bearerAuth: [] }]
    }
  })
  .put("/:sponsorId", async ({ tenantDb, params, body }) => {
    await tenantDb.update(sponsorsTable).set(body).where(eq(sponsorsTable.id, params.sponsorId as any));
    return { updated: true };
  }, {
    params: t.Object({ sponsorId: t.String() }),
    body: t.Object({
      name: t.Optional(t.String()),
      logoUrl: t.Optional(t.String()),
      websiteUrl: t.Optional(t.String()),
      description: t.Optional(t.String()),
      tier: t.Optional(t.Union([
        t.Literal("bronze"),
        t.Literal("silver"),
        t.Literal("gold"),
        t.Literal("platinum")
      ]))
    }),
    detail: {
      summary: "Aggiorna sponsor",
      tags: ["Events"],
      security: [{ bearerAuth: [] }]
    }
  })
  .delete("/:sponsorId", async ({ tenantDb, params }) => {
    await tenantDb.delete(sponsorsTable).where(eq(sponsorsTable.id, params.sponsorId as any));
    return { deleted: true };
  }, {
    params: t.Object({ sponsorId: t.String() }),
    detail: {
      summary: "Elimina sponsor",
      tags: ["Events"],
      security: [{ bearerAuth: [] }]
    }
  });
