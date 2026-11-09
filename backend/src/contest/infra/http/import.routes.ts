import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";
import { requireRole } from "../../../identity/infra/http/role.middleware";
import { tenantMiddleware } from "../../../tenancy/infra/http/tenant.middleware";
import { categoriesTable, eventsTable, levelsTable } from "../persistence/schema";
import { parseClassesCsv, parseLevelsCsv, type ImportError } from "../../../shared/domain/csvImport";
import { isUuid } from "./class-print.routes";

const csvOpts = {
  parse: "text" as const,
  body: t.String(),
  detail: { tags: ["Admin"], security: [{ bearerAuth: [] }] }
};

export const adminImportRoutes = new Elysia({ prefix: "/admin/import" })
  .use(tenantMiddleware)
  .use(requireRole("manager"))
  .post("/levels", async ({ tenantDb, body, set }) => {
    const { valid, errors } = parseLevelsCsv(body);
    if (errors.length && errors[0].line === 0) {
      set.status = 422;
      return { created: 0, errors };
    }
    const existing = await tenantDb.select({ name: levelsTable.name }).from(levelsTable);
    const known = new Set((existing as any[]).map((l) => String(l.name).toLowerCase()));
    const out: ImportError[] = [...errors];
    let created = 0;
    for (const row of valid) {
      if (known.has(row.name.toLowerCase())) continue; // idempotente: gia' presente, nessuna modifica
      await tenantDb.insert(levelsTable).values({
        id: crypto.randomUUID(), name: row.name, sortOrder: null, freeToEnter: row.freeToEnter
      });
      known.add(row.name.toLowerCase());
      created++;
    }
    return { created, errors: out.sort((a, b) => a.line - b.line) };
  }, { ...csvOpts, detail: { ...csvOpts.detail, summary: "Import livelli da CSV (Level Name,Free To Enter(1/0))" } })
  .post("/classes", async ({ tenantDb, body, query, set }) => {
    const eventId = (query as any)?.eventId;
    if (!isUuid(eventId)) {
      set.status = 422;
      return { created: 0, errors: [{ line: 0, message: "eventId query parameter must be a valid uuid" }] };
    }
    const [event] = await tenantDb.select({ id: eventsTable.id }).from(eventsTable).where(eq(eventsTable.id, eventId as any)).limit(1);
    if (!event) {
      set.status = 404;
      return { created: 0, errors: [{ line: 0, message: "Event not found" }] };
    }
    const { valid, errors } = parseClassesCsv(body);
    if (errors.length && errors[0].line === 0) {
      set.status = 422;
      return { created: 0, errors };
    }
    const levels = await tenantDb.select({ id: levelsTable.id, name: levelsTable.name }).from(levelsTable);
    const levelByName = new Map((levels as any[]).map((l) => [String(l.name).toLowerCase(), l.id as string]));
    const existing = await tenantDb.select({ name: categoriesTable.name }).from(categoriesTable)
      .where(eq(categoriesTable.eventId, eventId as any));
    const known = new Set((existing as any[]).map((c) => String(c.name).toLowerCase()));
    const out: ImportError[] = [...errors];
    let created = 0;
    for (const row of valid) {
      const levelId = levelByName.get(row.levelName.toLowerCase());
      if (!levelId) { out.push({ line: row.line, message: `Unknown level "${row.levelName}"` }); continue; }
      if (known.has(row.name.toLowerCase())) continue; // idempotente
      await tenantDb.insert(categoriesTable).values({
        id: crypto.randomUUID(),
        eventId,
        name: row.name,
        status: "open",
        classNumber: row.classNumber || null,
        levelId,
        classGroup: row.group || null,
        presentationOrder: row.presentationOrder,
        outOfCompetition: row.outOfCompetition
      });
      known.add(row.name.toLowerCase());
      created++;
    }
    return { created, errors: out.sort((a, b) => a.line - b.line) };
  }, { ...csvOpts, detail: { ...csvOpts.detail, summary: "Import classi da CSV (query eventId obbligatoria)" } });
