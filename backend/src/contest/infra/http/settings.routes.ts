import { Elysia, t } from "elysia";
import { requireRole } from "../../../identity/infra/http/role.middleware";
import { tenantMiddleware } from "../../../tenancy/infra/http/tenant.middleware";
import { settingsTable } from "../persistence/schema";

const DEFAULTS: Record<string, string> = {
  modelImages: "true",
  printCodePrefix: "MSS",
  exportIncludeModelCode: "true",
  exportIncludeModelDescription: "true"
};

export const settingsRoutes = new Elysia({ prefix: "/settings" })
  .use(tenantMiddleware)
  .use(requireRole("user"))
  .get("/", async ({ tenantDb }) => {
    const rows = await tenantDb.select().from(settingsTable);
    const result: Record<string, string> = { ...DEFAULTS };
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return result;
  }, {
    detail: {
      summary: "Leggi impostazioni",
      tags: ["Settings"],
      security: [{ bearerAuth: [] }]
    }
  });

export const adminSettingsRoutes = new Elysia({ prefix: "/admin/settings" })
  .use(tenantMiddleware)
  .use(requireRole("admin"))
  .put("/", async ({ tenantDb, body }) => {
    for (const [key, value] of Object.entries(body as Record<string, string>)) {
      await tenantDb
        .insert(settingsTable)
        .values({ key, value: String(value), updatedAt: new Date() })
        .onConflictDoUpdate({
          target: settingsTable.key,
          set: { value: String(value), updatedAt: new Date() }
        });
    }
    return { updated: true };
  }, {
    body: t.Record(t.String(), t.String()),
    detail: {
      summary: "Aggiorna impostazioni (admin)",
      tags: ["Settings"],
      security: [{ bearerAuth: [] }]
    }
  });
