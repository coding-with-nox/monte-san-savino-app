import { Elysia, t } from "elysia";
import { and, eq } from "drizzle-orm";
import { requireRole } from "../../../identity/infra/http/role.middleware";
import { tenantMiddleware } from "../../../tenancy/infra/http/tenant.middleware";
import { categoriesTable } from "../persistence/schema";
import { closeCategory, reopenCategory } from "../persistence/categoryClosure";
import { domainErrorHandler } from "../../../shared/infra/http/domainErrorHandler";

export const categoryRoutes = new Elysia({ prefix: "/categories" })
  .use(tenantMiddleware)
  .use(requireRole("manager"))
  .use(domainErrorHandler)
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
  .patch("/:categoryId/status", async ({ tenantDb, params, body }) => {
    if (body.status === "closed") {
      // Same function as the judge completion path: validates, computes awards and closes atomically.
      await closeCategory(tenantDb as any, params.categoryId);
    } else {
      // Reopening invalidates awards and judge completions of the category.
      await reopenCategory(tenantDb as any, params.categoryId);
    }
    return { updated: true, status: body.status };
  }, {
    params: t.Object({ categoryId: t.String({ format: "uuid" }) }),
    body: t.Object({ status: t.Union([t.Literal("open"), t.Literal("closed")]) }),
    detail: {
      summary: "Apri/chiudi categoria",
      description: "Chiusura: richiede almeno un giudice assegnato e tutti i modelli votati da tutti i giudici assegnati (409 altrimenti); calcola i premi nella stessa transazione. Riapertura: elimina premi e completamenti della categoria.",
      tags: ["Categories"],
      security: [{ bearerAuth: [] }]
    }
  });
