import { Elysia, t } from "elysia";
import { and, eq, inArray, sql } from "drizzle-orm";
import { requireRole } from "../../../identity/infra/http/role.middleware";
import { tenantMiddleware } from "../../../tenancy/infra/http/tenant.middleware";
import { awardBracketsTable, categoriesTable, eventsTable, honorsTable, judgeAssignmentsTable, levelsTable, modelsTable, previousResultsTable, votesTable } from "../persistence/schema";
import { usersTable } from "../../../identity/infra/persistence/schema";
import { VOTING_ROLES, type Role } from "../../../identity/domain/Role";
import { parseClassesCsv, parsePreviousResultsCsv, parseLevelsCsv, parseMedalBracketsCsv, parseHonorsCsv, parseJuryCsv, type ImportError, type JuryImportRow } from "../../../shared/domain/csvImport";
import { isUuid } from "./class-print.routes";
import { bracketInputError } from "../../domain/categoryClosure";
import { honorInputError, nextHonorSortOrder } from "../../domain/honors";

const csvOpts = {
  parse: "text" as const,
  body: t.String(),
  detail: { tags: ["Admin"], security: [{ bearerAuth: [] }] }
};

const NO_ROWS: ImportError = { line: 0, message: "No rows to import" };

function sortByLine(errors: ImportError[]): ImportError[] {
  return errors.sort((a, b) => a.line - b.line);
}

/** ?eventId= of the event-scoped imports: 422 when not a uuid, 404 when the event does not exist. */
async function checkImportEvent(tenantDb: any, eventId: unknown, set: { status?: unknown }): Promise<ImportError[] | null> {
  if (!isUuid(eventId)) {
    set.status = 422;
    return [{ line: 0, message: "eventId query parameter must be a valid uuid" }];
  }
  const [event] = await tenantDb.select({ id: eventsTable.id }).from(eventsTable).where(eq(eventsTable.id, eventId as any)).limit(1);
  if (!event) {
    set.status = 404;
    return [{ line: 0, message: "Event not found" }];
  }
  return null;
}

/**
 * Jury import, run inside the caller's transaction. Returns the errors (nothing written) or [] after
 * replacing the event's judge assignments. A judge who already voted in a class (or in the event, for
 * a whole-event assignment) cannot lose that assignment.
 */
async function applyJuryImport(tx: any, eventId: string, rows: JuryImportRow[], errors: ImportError[]): Promise<ImportError[]> {
  const out: ImportError[] = [...errors];
  const categories = await tx.select({ id: categoriesTable.id, name: categoriesTable.name, classNumber: categoriesTable.classNumber })
    .from(categoriesTable).where(eq(categoriesTable.eventId, eventId as any)) as { id: string; name: string; classNumber: string | null }[];
  const categoryByNumber = new Map<string, { id: string; name: string; classNumber: string | null }[]>();
  for (const c of categories) {
    const key = (c.classNumber ?? "").trim();
    if (!key) continue;
    categoryByNumber.set(key, [...(categoryByNumber.get(key) ?? []), c]);
  }
  const emails = [...new Set(rows.map((r) => r.judgeEmail))];
  const users = emails.length === 0 ? [] : await tx.select({ id: usersTable.id, email: usersTable.email, role: usersTable.role })
    .from(usersTable).where(inArray(sql`lower(${usersTable.email})`, emails)) as { id: string; email: string; role: string }[];
  const userByEmail = new Map<string, { id: string; email: string; role: string }>(users.map((u) => [u.email.toLowerCase(), u]));

  const desired: { judgeId: string; categoryId: string | null; standingIn: boolean }[] = [];
  for (const row of rows) {
    const user = userByEmail.get(row.judgeEmail);
    if (!user) { out.push({ line: row.line, message: `No user with email ${row.judgeEmail}` }); continue; }
    if (!VOTING_ROLES.includes(user.role as Role)) {
      out.push({ line: row.line, message: `${row.judgeEmail} is not a judge (role must be judge, manager or admin; the jury president does not vote)` });
      continue;
    }
    let categoryId: string | null = null;
    if (row.classNumber !== null) {
      const matches = categoryByNumber.get(row.classNumber) ?? [];
      if (matches.length === 0) { out.push({ line: row.line, message: `Unknown Class Number "${row.classNumber}" in this event` }); continue; }
      if (matches.length > 1) { out.push({ line: row.line, message: `Class Number "${row.classNumber}" matches more than one class` }); continue; }
      categoryId = matches[0].id;
    }
    desired.push({ judgeId: user.id, categoryId, standingIn: row.standingIn });
  }
  if (out.length) return sortByLine(out);

  const existing = await tx.select({ judgeId: judgeAssignmentsTable.judgeId, categoryId: judgeAssignmentsTable.categoryId })
    .from(judgeAssignmentsTable).where(eq(judgeAssignmentsTable.eventId, eventId as any)) as { judgeId: string; categoryId: string | null }[];
  const keyOf = (judgeId: string, categoryId: string | null) => `${judgeId}|${categoryId ?? ""}`;
  const keep = new Set(desired.map((d) => keyOf(d.judgeId, d.categoryId)));
  const removed = existing.filter((a) => !keep.has(keyOf(a.judgeId, a.categoryId)));
  if (removed.length > 0) {
    const eventCategoryIds = categories.map((c) => c.id);
    const votes = eventCategoryIds.length === 0 ? [] : await tx.select({ judgeId: votesTable.judgeId, categoryId: modelsTable.categoryId })
      .from(votesTable)
      .innerJoin(modelsTable, eq(votesTable.modelId, modelsTable.id))
      .where(and(
        inArray(votesTable.judgeId, [...new Set(removed.map((a) => a.judgeId))]),
        inArray(modelsTable.categoryId, eventCategoryIds)
      )) as { judgeId: string; categoryId: string }[];
    const judges = await tx.select({ id: usersTable.id, email: usersTable.email })
      .from(usersTable).where(inArray(usersTable.id, [...new Set(removed.map((a) => a.judgeId))])) as { id: string; email: string }[];
    const emailById = new Map(judges.map((j) => [j.id, j.email]));
    for (const a of removed) {
      const scope = a.categoryId ? [a.categoryId] : eventCategoryIds;
      if (!votes.some((v) => v.judgeId === a.judgeId && scope.includes(v.categoryId))) continue;
      const judge = emailById.get(a.judgeId) ?? a.judgeId;
      const cls = a.categoryId ? categories.find((c) => c.id === a.categoryId) : undefined;
      const where = a.categoryId ? `class ${cls?.classNumber ?? ""} (${cls?.name ?? ""})` : "this event";
      out.push({ line: 0, message: `Judge ${judge} has already voted in ${where}: the assignment cannot be removed` });
    }
    if (out.length) return sortByLine(out);
  }

  await tx.delete(judgeAssignmentsTable).where(eq(judgeAssignmentsTable.eventId, eventId as any));
  if (desired.length > 0) {
    await tx.insert(judgeAssignmentsTable).values(desired.map((d) => ({
      id: crypto.randomUUID(), eventId, judgeId: d.judgeId, categoryId: d.categoryId, standingIn: d.standingIn
    })));
  }
  return [];
}

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
  }, { ...csvOpts, detail: { ...csvOpts.detail, summary: "Import classi da CSV (query eventId obbligatoria)" } })
  // Replaces ALL previous results. Atomic: any invalid row refuses the whole file (nothing is changed).
  .post("/previous-results", async ({ tenantDb, body, set }) => {
    const { valid, errors } = parsePreviousResultsCsv(body);
    if (errors.length || valid.length === 0) {
      set.status = 422;
      return { imported: 0, errors: errors.length ? errors : [{ line: 0, message: "No rows to import" }] };
    }
    await tenantDb.transaction(async (tx: any) => {
      await tx.delete(previousResultsTable);
      await tx.insert(previousResultsTable).values(valid.map((row) => ({
        id: crypto.randomUUID(),
        email: row.email,
        firstName: row.firstName,
        lastName: row.lastName,
        levelName: row.levelName,
        medalRank: row.medalRank,
        year: row.year
      })));
    });
    return { imported: valid.length, errors: [] };
  }, { ...csvOpts, detail: { ...csvOpts.detail, summary: "Import risultati precedenti da CSV (Email,First Name,Last Name,Level,Medal Rank,Year); sostituisce tutto" } })
  // Step 10 imports: ?eventId= required, all-or-nothing (any invalid row answers 422 and changes nothing).
  // Replaces the event's medal brackets (one transaction).
  .post("/medals", async ({ tenantDb, body, query, set }) => {
    const eventId = (query as any)?.eventId;
    const eventErrors = await checkImportEvent(tenantDb, eventId, set);
    if (eventErrors) return { imported: 0, errors: eventErrors };
    const { valid, errors } = parseMedalBracketsCsv(body);
    const out: ImportError[] = [...errors];
    for (const row of valid) {
      const error = bracketInputError(row);
      if (error) out.push({ line: row.line, message: error });
    }
    if (out.length === 0 && valid.length === 0) out.push(NO_ROWS);
    if (out.length) {
      set.status = 422;
      return { imported: 0, errors: sortByLine(out) };
    }
    await tenantDb.transaction(async (tx: any) => {
      await tx.delete(awardBracketsTable).where(eq(awardBracketsTable.eventId, eventId as any));
      await tx.insert(awardBracketsTable).values(valid.map((row) => ({
        id: crypto.randomUUID(),
        eventId,
        medalLabel: row.medalLabel,
        medalRank: row.medalRank,
        lowLimit: row.lowLimit,
        highLimit: row.highLimit
      })));
    });
    return { imported: valid.length, errors: [] };
  }, { ...csvOpts, detail: { ...csvOpts.detail, summary: "Import medaglie (Medal,Value,Low Limit,High Limit) per evento; sostituisce le fasce dell'evento" } })
  // Special awards: inserts new codes, updates name/order of existing codes (matched case-insensitively). Never deletes.
  .post("/honors", async ({ tenantDb, body, query, set }) => {
    const eventId = (query as any)?.eventId;
    const eventErrors = await checkImportEvent(tenantDb, eventId, set);
    if (eventErrors) return { imported: 0, errors: eventErrors };
    const { valid, errors } = parseHonorsCsv(body);
    const out: ImportError[] = [...errors];
    for (const row of valid) {
      const error = honorInputError({ code: row.code, name: row.name });
      if (error) out.push({ line: row.line, message: error });
    }
    if (out.length === 0 && valid.length === 0) out.push(NO_ROWS);
    if (out.length) {
      set.status = 422;
      return { imported: 0, errors: sortByLine(out) };
    }
    const existing = await tenantDb.select().from(honorsTable).where(eq(honorsTable.eventId, eventId as any)) as any[];
    const byCode = new Map<string, any>(existing.map((h) => [String(h.code).trim().toLowerCase(), h]));
    let nextOrder = nextHonorSortOrder(existing);
    const updates: { id: string; name: string; sortOrder: number }[] = [];
    const inserts: { id: string; eventId: string; code: string; name: string; sortOrder: number }[] = [];
    for (const row of valid) {
      const current = byCode.get(row.code.toLowerCase());
      if (current) {
        updates.push({ id: current.id, name: row.name, sortOrder: row.sortOrder ?? current.sortOrder });
      } else {
        inserts.push({ id: crypto.randomUUID(), eventId, code: row.code, name: row.name, sortOrder: row.sortOrder ?? nextOrder++ });
      }
    }
    await tenantDb.transaction(async (tx: any) => {
      for (const u of updates) {
        await tx.update(honorsTable).set({ name: u.name, sortOrder: u.sortOrder }).where(eq(honorsTable.id, u.id));
      }
      if (inserts.length > 0) await tx.insert(honorsTable).values(inserts);
    });
    return { imported: valid.length, errors: [] };
  }, { ...csvOpts, detail: { ...csvOpts.detail, summary: "Import premi speciali (Code,Name[,Order]) per evento; crea i codici nuovi, aggiorna nome/ordine degli esistenti, non cancella" } })
  // Judge assignments: replaces the event's assignments (one transaction). Refuses to remove an assignment whose judge already voted.
  .post("/jury", async ({ tenantDb, body, query, set }) => {
    const eventId = (query as any)?.eventId;
    const eventErrors = await checkImportEvent(tenantDb, eventId, set);
    if (eventErrors) return { imported: 0, errors: eventErrors };
    const parsed = parseJuryCsv(body);
    const initial: ImportError[] = parsed.errors.length === 0 && parsed.valid.length === 0 ? [NO_ROWS] : parsed.errors;
    const errors = await tenantDb.transaction(async (tx: any) =>
      applyJuryImport(tx, eventId as string, parsed.valid, initial)
    );
    if (errors.length) {
      set.status = 422;
      return { imported: 0, errors };
    }
    return { imported: parsed.valid.length, errors: [] };
  }, { ...csvOpts, detail: { ...csvOpts.detail, summary: "Import giurie per evento (Judge Email,Class Number,Stand-in); sostituisce le assegnazioni dell'evento, rifiuta la rimozione di giudici che hanno già votato" } });
