import { Elysia } from "elysia";
import { eq } from "drizzle-orm";
import { eventsTable } from "../persistence/schema";
import { tenantMiddleware } from "../../../tenancy/infra/http/tenant.middleware";

export const publicRoutes = new Elysia({ prefix: "/public" })
  .use(tenantMiddleware)
  .get("/events", async ({ tenantDb, query }) => {
    const status = query?.status ? String(query.status) : null;
    if (status) {
      return await tenantDb.select().from(eventsTable).where(eq(eventsTable.status, status as any));
    }
    return await tenantDb.select().from(eventsTable);
  }, {
    detail: {
      summary: "Eventi pubblici",
      tags: ["Public"]
    }
  });
