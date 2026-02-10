import { Elysia } from "elysia";
import { eq } from "drizzle-orm";
import { requireRole } from "../../../identity/infra/http/role.middleware";
import { tenantMiddleware } from "../../../tenancy/infra/http/tenant.middleware";
import { categoriesTable } from "../persistence/schema";

export const publicCategoryRoutes = new Elysia({ prefix: "/public/categories" })
  .use(tenantMiddleware)
  .use(requireRole("user"))
  .get("/", async ({ tenantDb, query }) => {
    const eventId = query?.eventId ? String(query.eventId) : null;
    if (eventId) {
      return await tenantDb.select().from(categoriesTable).where(eq(categoriesTable.eventId, eventId as any));
    }
    return await tenantDb.select().from(categoriesTable);
  }, {
    detail: {
      summary: "Lista categorie (utente)",
      tags: ["Categories"],
      security: [{ bearerAuth: [] }]
    }
  });
