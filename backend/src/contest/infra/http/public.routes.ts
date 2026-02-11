import { Elysia } from "elysia";
import { eq } from "drizzle-orm";
import { eventsTable } from "../persistence/schema";
import { tenantMiddleware } from "../../../tenancy/infra/http/tenant.middleware";

export const publicRoutes = new Elysia({ prefix: "/public" })
  .use(tenantMiddleware)
  .get("/events", async ({ tenantDb, query }) => {
    const status = query?.status ? String(query.status) : null;
    if (status === "all") {
      return await tenantDb.select().from(eventsTable);
    }
    const filterStatus = status || "active";
    return await tenantDb.select().from(eventsTable).where(eq(eventsTable.status, filterStatus as any));
  }, {
    detail: {
      summary: "Eventi pubblici",
      tags: ["Public"]
    }
  });
