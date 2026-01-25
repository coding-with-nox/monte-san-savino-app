import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";
import { requireRole } from "../../../identity/infra/http/role.middleware";
import { tenantMiddleware } from "../../../tenancy/infra/http/tenant.middleware";
import { categoriesTable } from "../persistence/schema";

export const categoryRoutes = new Elysia({ prefix: "/categories" })
  .use(tenantMiddleware)
  .use(requireRole("manager"))
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
  .post("/", async ({ tenantDb, body }) => {
    const id = crypto.randomUUID();
    await tenantDb.insert(categoriesTable).values({ id, eventId: body.eventId, name: body.name });
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
  });
