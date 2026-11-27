import { PRINT_HTML_HEADERS, PRINT_SCRIPT } from "../../../shared/infra/http/printHeaders";
import { Elysia, t } from "elysia";
import { and, eq, isNull, or } from "drizzle-orm";
import QRCode from "qrcode";
import { escapeHtml } from "../../../shared/domain/escapeHtml";
import { parsePrintLang, pt, type PrintLang } from "../../../shared/domain/printI18n";
import { requireRole } from "../../../identity/infra/http/role.middleware";
import { tenantMiddleware } from "../../../tenancy/infra/http/tenant.middleware";
import { categoriesTable, eventsTable, judgeAssignmentsTable, modelsTable } from "../persistence/schema";
import { userProfilesTable, usersTable } from "../../../identity/infra/persistence/schema";
import { judgeSessionHoursFromEnv } from "../../../identity/domain/judgeSession";
import { formatModelCode, loadModelCodeFormatSettings } from "./model-code";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/** Public base URL of the judge app (PUBLIC_APP_URL, without trailing slashes). */
export function publicAppUrl(env: NodeJS.ProcessEnv = process.env): string {
  return (env.PUBLIC_APP_URL?.trim() || "http://localhost:5173").replace(/\/+$/, "");
}

/** The page a judge opens for one class; the class QR code encodes it. */
export function judgeAppUrl(appUrl: string, eventId: string, categoryId: string) {
  return `${appUrl}/judge?eventId=${encodeURIComponent(eventId)}&categoryId=${encodeURIComponent(categoryId)}`;
}

export function displayName(firstName?: string | null, lastName?: string | null, fallback?: string | null) {
  return [firstName, lastName].filter(Boolean).join(" ").trim() || fallback || "";
}

const PRINT_CSS = `
      body { font-family: Arial, sans-serif; margin: 24px; }
      h1 { margin-bottom: 4px; }
      p.sub { color: #555; margin-top: 0; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #ccc; padding: 8px; text-align: left; vertical-align: top; }
      th { background: #f2f2f2; }
      .qr { display: inline-block; width: 60mm; border: 1px solid #ccc; padding: 4mm; margin: 0 4mm 4mm 0; text-align: center; page-break-inside: avoid; break-inside: avoid; }
      .qr h2 { font-size: 12pt; margin: 2mm 0 0; }
      .qr p { font-size: 9pt; margin: 1mm 0; color: #555; }
      .judge-sheet + .judge-sheet { page-break-before: always; break-before: page; }
      @media print {
        @page { size: A4 portrait; margin: 12mm; }
        body { margin: 0; }
      }`;

export function page(lang: PrintLang, title: string, body: string) {
  return `<!DOCTYPE html>
<html lang="${lang}">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>${PRINT_CSS}
    </style>
  </head>
  <body>
    ${body}
    <script>${PRINT_SCRIPT}</script>
  </body>
</html>`;
}

export type ClassInfo = { name: string };
export type ExhibitorRow = { exhibitor: string; modelName: string; code: string };
export type JudgeRow = { judgeUserId: string; name: string; email?: string | null };
export type JuryQrRow = JudgeRow & { qrDataUrl: string };

export function renderExhibitorsHtml(cls: ClassInfo, rows: ExhibitorRow[], lang: PrintLang = "it") {
  const tr = rows
    .map((r) => `<tr><td>${escapeHtml(r.exhibitor)}</td><td>${escapeHtml(r.modelName)}</td><td>${escapeHtml(r.code)}</td></tr>`)
    .join("");
  return page(lang, `${pt(lang, "exhibitors.title")} ${cls.name}`, `<h1>${pt(lang, "exhibitors.heading")}</h1>
    <p class="sub"><strong>${pt(lang, "label.class")}:</strong> ${escapeHtml(cls.name)}</p>
    <table><thead><tr><th>${pt(lang, "col.exhibitor")}</th><th>${pt(lang, "col.model")}</th><th>${pt(lang, "col.code")}</th></tr></thead>
    <tbody>${tr || `<tr><td colspan="3">${pt(lang, "common.noModels")}</td></tr>`}</tbody></table>`);
}

export function renderJuryListHtml(cls: ClassInfo, judges: JudgeRow[], lang: PrintLang = "it") {
  const tr = judges
    .map((j) => `<tr><td>${escapeHtml(j.name)}</td><td>${escapeHtml(j.email ?? "")}</td></tr>`)
    .join("");
  return page(lang, `${pt(lang, "jury.title")} ${cls.name}`, `<h1>${pt(lang, "jury.heading")}</h1>
    <p class="sub"><strong>${pt(lang, "label.class")}:</strong> ${escapeHtml(cls.name)}</p>
    <table><thead><tr><th>${pt(lang, "col.judge")}</th><th>${pt(lang, "col.email")}</th></tr></thead>
    <tbody>${tr || `<tr><td colspan="2">${pt(lang, "common.noJudge")}</td></tr>`}</tbody></table>`);
}

/** `judgeUrl` is the class judge page (see judgeAppUrl): the same code for every judge of the class. */
export function renderJuryQrHtml(cls: ClassInfo, judgeUrl: string, judges: JuryQrRow[], lang: PrintLang = "it") {
  const cards = judges
    .map((j) => `<div class="qr">
      <img alt="${escapeHtml(judgeUrl)}" src="${escapeHtml(j.qrDataUrl)}" width="200" height="200"/>
      <h2>${escapeHtml(j.name)}</h2>
      <p>${escapeHtml(cls.name)}</p>
    </div>`)
    .join("");
  return page(lang, `${pt(lang, "juryQr.title")} ${cls.name}`, `<h1>${pt(lang, "juryQr.heading")}</h1>
    <p class="sub"><strong>${pt(lang, "label.class")}:</strong> ${escapeHtml(cls.name)}</p>
    ${cards || `<p>${pt(lang, "common.noJudge")}</p>`}`);
}

export type JudgeSheetClass = { categoryId: string; name: string; classNumber: string; standingIn: boolean };
export type JudgeSheet = { judgeUserId: string; name: string; email: string | null; classes: JudgeSheetClass[] };
export type JudgeAssignmentRow = { judgeUserId: string; name: string; email: string | null; categoryId: string | null; standingIn: boolean };
export type SheetCategory = { id: string; name: string; classNumber: string };

/**
 * One sheet per judge of the event. Assignments are one row per class (categoryId) or one whole-event row
 * (categoryId null): a whole-event judge gets every class of the event, as a regular judge.
 * A class-level row sets the stand-in flag of its class.
 */
export function buildJudgeSheets(rows: JudgeAssignmentRow[], categories: SheetCategory[]): JudgeSheet[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const judges = new Map<string, { sheet: JudgeSheet; wholeEvent: boolean; specific: Map<string, boolean> }>();
  for (const r of rows) {
    let entry = judges.get(r.judgeUserId);
    if (!entry) {
      entry = { sheet: { judgeUserId: r.judgeUserId, name: r.name, email: r.email, classes: [] }, wholeEvent: false, specific: new Map() };
      judges.set(r.judgeUserId, entry);
    }
    if (r.categoryId === null) entry.wholeEvent = true;
    else entry.specific.set(r.categoryId, r.standingIn);
  }
  const out: JudgeSheet[] = [];
  for (const { sheet, wholeEvent, specific } of judges.values()) {
    const classes = new Map<string, JudgeSheetClass>();
    for (const [categoryId, standingIn] of specific) {
      const c = byId.get(categoryId);
      if (c) classes.set(categoryId, { categoryId, name: c.name, classNumber: c.classNumber, standingIn });
    }
    if (wholeEvent) {
      for (const c of categories) {
        if (!classes.has(c.id)) classes.set(c.id, { categoryId: c.id, name: c.name, classNumber: c.classNumber, standingIn: false });
      }
    }
    sheet.classes = [...classes.values()].sort((a, b) =>
      a.classNumber.localeCompare(b.classNumber, undefined, { numeric: true }) || a.name.localeCompare(b.name));
    out.push(sheet);
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export function renderJudgeSheetsHtml(
  event: { id: string; name: string },
  sheets: JudgeSheet[],
  opts: { lang: PrintLang; appUrl: string; sessionHours: number; qrByCategory: Record<string, string> }
) {
  const { lang, appUrl, sessionHours, qrByCategory } = opts;
  const standInMarker = escapeHtml(pt(lang, "judgeSheet.standIn"));
  const body = sheets.map((s) => {
    const rows = s.classes.map((c) => `<tr>
          <td>${escapeHtml(c.name)}${c.standingIn ? ` <strong>[${standInMarker}]</strong>` : ""}</td>
          <td>${escapeHtml(c.classNumber)}</td>
          <td><img alt="${escapeHtml(judgeAppUrl(appUrl, event.id, c.categoryId))}" src="${escapeHtml(qrByCategory[c.categoryId] ?? "")}" width="140" height="140"/><br/>${escapeHtml(pt(lang, "judgeSheet.scan"))}</td>
        </tr>`).join("");
    const classesTable = s.classes.length
      ? `<table><thead><tr><th>${pt(lang, "label.class")}</th><th>${pt(lang, "judgeSheet.classNumber")}</th><th>${pt(lang, "col.qr")}</th></tr></thead><tbody>${rows}</tbody></table>`
      : `<p>${pt(lang, "judgeSheet.noClasses")}</p>`;
    return `<section class="judge-sheet">
    <h1>${pt(lang, "judgeSheet.title")}</h1>
    <p class="sub"><strong>${pt(lang, "label.event")}:</strong> ${escapeHtml(event.name)}</p>
    <table><tbody>
      <tr><th>${pt(lang, "col.judge")}</th><td>${escapeHtml(s.name)}</td></tr>
      <tr><th>${pt(lang, "label.email")}</th><td>${escapeHtml(s.email ?? "")}</td></tr>
      <tr><th>${pt(lang, "judgeSheet.appUrl")}</th><td>${escapeHtml(appUrl)}</td></tr>
    </tbody></table>
    <p>${escapeHtml(pt(lang, "judgeSheet.instruction", { hours: sessionHours }))}</p>
    <h2>${pt(lang, "judgeSheet.classes")}</h2>
    ${classesTable}
  </section>`;
  }).join("");
  return page(lang, `${pt(lang, "judgeSheet.title")} ${event.name}`, body || `<p>${pt(lang, "common.noJudge")}</p>`);
}

async function loadClass(tenantDb: any, categoryId: string) {
  const [cls] = await tenantDb.select().from(categoriesTable).where(eq(categoriesTable.id, categoryId as any)).limit(1);
  return cls as { id: string; eventId: string; name: string } | undefined;
}

/** Giudici assegnati alla classe: assegnazione diretta, oppure all'intero evento (categoryId null). */
async function loadClassJudges(tenantDb: any, cls: { id: string; eventId: string }): Promise<JudgeRow[]> {
  const rows = await tenantDb
    .select({
      judgeUserId: judgeAssignmentsTable.judgeId,
      email: usersTable.email,
      firstName: userProfilesTable.firstName,
      lastName: userProfilesTable.lastName
    })
    .from(judgeAssignmentsTable)
    .leftJoin(usersTable, eq(usersTable.id, judgeAssignmentsTable.judgeId))
    .leftJoin(userProfilesTable, eq(userProfilesTable.userId, judgeAssignmentsTable.judgeId))
    .where(and(
      eq(judgeAssignmentsTable.eventId, cls.eventId as any),
      or(eq(judgeAssignmentsTable.categoryId, cls.id as any), isNull(judgeAssignmentsTable.categoryId))
    ));
  const seen = new Set<string>();
  const out: JudgeRow[] = [];
  for (const r of rows as any[]) {
    if (seen.has(r.judgeUserId)) continue;
    seen.add(r.judgeUserId);
    out.push({ judgeUserId: r.judgeUserId, email: r.email, name: displayName(r.firstName, r.lastName, r.email) });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

const params = t.Object({ categoryId: t.String() });

export const classPrintRoutes = new Elysia()
  .use(tenantMiddleware)
  .use(requireRole("manager"))
  .get("/classes/:categoryId/exhibitors", async ({ tenantDb, params, query, set }) => {
    if (!isUuid(params.categoryId)) {
      set.status = 422;
      return { error: "categoryId must be a valid uuid" };
    }
    const cls = await loadClass(tenantDb, params.categoryId);
    if (!cls) {
      set.status = 404;
      return { error: "Class not found" };
    }
    const lang = parsePrintLang(query?.lang);
    const fmt = await loadModelCodeFormatSettings(tenantDb);
    const rows = await tenantDb
      .select({
        modelName: modelsTable.name,
        code: modelsTable.code,
        displayNumber: modelsTable.displayNumber,
        teamCode: modelsTable.teamCode,
        email: usersTable.email,
        firstName: userProfilesTable.firstName,
        lastName: userProfilesTable.lastName
      })
      .from(modelsTable)
      .leftJoin(usersTable, eq(usersTable.id, modelsTable.userId))
      .leftJoin(userProfilesTable, eq(userProfilesTable.userId, modelsTable.userId))
      .where(eq(modelsTable.categoryId, cls.id as any));
    const list: ExhibitorRow[] = (rows as any[])
      .map((r) => ({
        exhibitor: displayName(r.firstName, r.lastName, r.email),
        modelName: r.modelName ?? "",
        code: formatModelCode(r.code, (cls as any).seqId, r.displayNumber, fmt, r.teamCode)
      }))
      .sort((a, b) => a.exhibitor.localeCompare(b.exhibitor) || a.modelName.localeCompare(b.modelName));
    Object.assign(set.headers, PRINT_HTML_HEADERS);
    set.headers["content-disposition"] = `inline; filename="class-exhibitors.html"`;
    return renderExhibitorsHtml(cls, list, lang);
  }, {
    params,
    detail: { summary: "Stampa espositori e modelli della classe", tags: ["Exports"], security: [{ bearerAuth: [] }] }
  })
  .get("/classes/:categoryId/jury-list", async ({ tenantDb, params, query, set }) => {
    if (!isUuid(params.categoryId)) {
      set.status = 422;
      return { error: "categoryId must be a valid uuid" };
    }
    const cls = await loadClass(tenantDb, params.categoryId);
    if (!cls) {
      set.status = 404;
      return { error: "Class not found" };
    }
    const lang = parsePrintLang(query?.lang);
    const judges = await loadClassJudges(tenantDb, cls);
    Object.assign(set.headers, PRINT_HTML_HEADERS);
    set.headers["content-disposition"] = `inline; filename="class-jury-list.html"`;
    return renderJuryListHtml(cls, judges, lang);
  }, {
    params,
    detail: { summary: "Stampa elenco giudici della classe", tags: ["Exports"], security: [{ bearerAuth: [] }] }
  })
  .get("/classes/:categoryId/jury-qr", async ({ tenantDb, params, query, set }) => {
    if (!isUuid(params.categoryId)) {
      set.status = 422;
      return { error: "categoryId must be a valid uuid" };
    }
    const cls = await loadClass(tenantDb, params.categoryId);
    if (!cls) {
      set.status = 404;
      return { error: "Class not found" };
    }
    const lang = parsePrintLang(query?.lang);
    const judges = await loadClassJudges(tenantDb, cls);
    const judgeUrl = judgeAppUrl(publicAppUrl(), cls.eventId, cls.id);
    const qrDataUrl = await QRCode.toDataURL(judgeUrl, { margin: 1, width: 200, errorCorrectionLevel: "M" });
    const withQr: JuryQrRow[] = judges.map((j) => ({ ...j, qrDataUrl }));
    Object.assign(set.headers, PRINT_HTML_HEADERS);
    set.headers["content-disposition"] = `inline; filename="class-jury-qr.html"`;
    return renderJuryQrHtml(cls, judgeUrl, withQr, lang);
  }, {
    params,
    detail: { summary: "Stampa QR giudici della classe (QR = pagina giudice della classe)", tags: ["Exports"], security: [{ bearerAuth: [] }] }
  })
  .get("/events/:eventId/judge-sheets", async ({ tenantDb, params, query, set }) => {
    if (!isUuid(params.eventId)) {
      set.status = 422;
      return { error: "eventId must be a valid uuid" };
    }
    const [event] = await tenantDb.select({ id: eventsTable.id, name: eventsTable.name })
      .from(eventsTable).where(eq(eventsTable.id, params.eventId as any)).limit(1);
    if (!event) {
      set.status = 404;
      return { error: "Event not found" };
    }
    const lang = parsePrintLang(query?.lang);
    const appUrl = publicAppUrl();
    const categories: SheetCategory[] = (await tenantDb
      .select({ id: categoriesTable.id, name: categoriesTable.name, classNumber: categoriesTable.classNumber, seqId: categoriesTable.seqId })
      .from(categoriesTable)
      .where(eq(categoriesTable.eventId, event.id as any)))
      .map((c: any) => ({ id: c.id, name: c.name, classNumber: c.classNumber || String(c.seqId) }));
    const rows = await tenantDb
      .select({
        judgeUserId: judgeAssignmentsTable.judgeId,
        categoryId: judgeAssignmentsTable.categoryId,
        standingIn: judgeAssignmentsTable.standingIn,
        email: usersTable.email,
        firstName: userProfilesTable.firstName,
        lastName: userProfilesTable.lastName
      })
      .from(judgeAssignmentsTable)
      .leftJoin(usersTable, eq(usersTable.id, judgeAssignmentsTable.judgeId))
      .leftJoin(userProfilesTable, eq(userProfilesTable.userId, judgeAssignmentsTable.judgeId))
      .where(eq(judgeAssignmentsTable.eventId, event.id as any));
    const sheets = buildJudgeSheets((rows as any[]).map((r) => ({
      judgeUserId: r.judgeUserId,
      name: displayName(r.firstName, r.lastName, r.email),
      email: r.email ?? null,
      categoryId: r.categoryId ?? null,
      standingIn: !!r.standingIn
    })), categories);
    const qrByCategory: Record<string, string> = {};
    for (const sheet of sheets) {
      for (const c of sheet.classes) {
        if (qrByCategory[c.categoryId] !== undefined) continue;
        qrByCategory[c.categoryId] = await QRCode.toDataURL(judgeAppUrl(appUrl, event.id, c.categoryId), { margin: 1, width: 140, errorCorrectionLevel: "M" });
      }
    }
    Object.assign(set.headers, PRINT_HTML_HEADERS);
    set.headers["content-disposition"] = `inline; filename="judge-sheets.html"`;
    return renderJudgeSheetsHtml(event, sheets, { lang, appUrl, sessionHours: judgeSessionHoursFromEnv(), qrByCategory });
  }, {
    params: t.Object({ eventId: t.String() }),
    detail: { summary: "Stampa schede giudice dell'evento (accesso e QR per classe)", tags: ["Exports"], security: [{ bearerAuth: [] }] }
  });
