import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";
import { requireRole } from "../../../identity/infra/http/role.middleware";
import { registrationsTable, modelsTable } from "../persistence/schema";

function toCsv(rows: Record<string, any>[]) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((key) => JSON.stringify(row[key] ?? "")).join(","));
  }
  return lines.join("\n");
}

export const exportRoutes = new Elysia({ prefix: "/exports" })
  .use(requireRole("manager"))
  .get("/enrollments", async ({ tenantDb, query, set }) => {
    const eventId = query?.eventId ? String(query.eventId) : null;
    const rows = eventId
      ? await tenantDb.select().from(registrationsTable).where(eq(registrationsTable.eventId, eventId as any))
      : await tenantDb.select().from(registrationsTable);
    set.headers["content-type"] = "text/csv";
    return toCsv(rows);
  }, {
    detail: {
      summary: "Export iscrizioni CSV",
      tags: ["Exports"],
      security: [{ bearerAuth: [] }]
    }
  })
  .get("/models", async ({ tenantDb, query, set }) => {
    const categoryId = query?.categoryId ? String(query.categoryId) : null;
    const rows = categoryId
      ? await tenantDb.select().from(modelsTable).where(eq(modelsTable.categoryId, categoryId as any))
      : await tenantDb.select().from(modelsTable);
    set.headers["content-type"] = "text/csv";
    return toCsv(rows);
  }, {
    detail: {
      summary: "Export modelli CSV",
      tags: ["Exports"],
      security: [{ bearerAuth: [] }]
    }
  });
