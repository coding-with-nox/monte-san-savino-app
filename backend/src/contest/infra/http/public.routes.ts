import { Elysia } from "elysia";
import { eq } from "drizzle-orm";
import { eventsTable } from "../persistence/schema";
import { tenantMiddleware } from "../../../tenancy/infra/http/tenant.middleware";
import { loadPublicRegistration } from "../persistence/registrationSettings";
import { turnstileSiteKeyFromEnv } from "../../../identity/infra/captcha/turnstile";

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
  })
  .get("/registration", async ({ tenantDb }) => {
    return { ...(await loadPublicRegistration(tenantDb)), turnstileSiteKey: turnstileSiteKeyFromEnv() };
  }, {
    detail: {
      summary: "Stato registrazione e pagina iniziale (no auth); turnstileSiteKey per il widget anti-bot (null se non configurato)",
      tags: ["Public"]
    }
  });
