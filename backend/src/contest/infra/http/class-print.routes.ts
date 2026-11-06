import { Elysia, t } from "elysia";
import { and, eq, isNull, or } from "drizzle-orm";
import QRCode from "qrcode";
import { escapeHtml } from "../../../shared/domain/escapeHtml";
import { requireRole } from "../../../identity/infra/http/role.middleware";
import { tenantMiddleware } from "../../../tenancy/infra/http/tenant.middleware";
import { categoriesTable, judgeAssignmentsTable, modelsTable } from "../persistence/schema";
import { userProfilesTable, usersTable } from "../../../identity/infra/persistence/schema";
import { formatModelCode, loadModelCodeFormatSettings } from "./model-code";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export function juryQrPayload(judgeUserId: string, categoryId: string) {
  return `jury:${judgeUserId}:${categoryId}`;
}

function displayName(firstName?: string | null, lastName?: string | null, fallback?: string | null) {
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
      @media print {
        @page { size: A4 portrait; margin: 12mm; }
        body { margin: 0; }
      }`;

function page(title: string, body: string) {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>${PRINT_CSS}
    </style>
  </head>
  <body>
    ${body}
    <script>window.onload = () => window.print();</script>
  </body>
</html>`;
}

export type ClassInfo = { name: string };
export type ExhibitorRow = { exhibitor: string; modelName: string; code: string };
export type JudgeRow = { judgeUserId: string; name: string; email?: string | null };
export type JuryQrRow = JudgeRow & { qrDataUrl: string };

export function renderExhibitorsHtml(cls: ClassInfo, rows: ExhibitorRow[]) {
  const tr = rows
    .map((r) => `<tr><td>${escapeHtml(r.exhibitor)}</td><td>${escapeHtml(r.modelName)}</td><td>${escapeHtml(r.code)}</td></tr>`)
    .join("");
  return page(`Espositori ${cls.name}`, `<h1>Espositori e modelli</h1>
    <p class="sub"><strong>Classe:</strong> ${escapeHtml(cls.name)}</p>
    <table><thead><tr><th>Espositore</th><th>Modello</th><th>Codice</th></tr></thead>
    <tbody>${tr || '<tr><td colspan="3">Nessun modello</td></tr>'}</tbody></table>`);
}

export function renderJuryListHtml(cls: ClassInfo, judges: JudgeRow[]) {
  const tr = judges
    .map((j) => `<tr><td>${escapeHtml(j.name)}</td><td>${escapeHtml(j.email ?? "")}</td></tr>`)
    .join("");
  return page(`Giuria ${cls.name}`, `<h1>Giuria</h1>
    <p class="sub"><strong>Classe:</strong> ${escapeHtml(cls.name)}</p>
    <table><thead><tr><th>Giudice</th><th>Email</th></tr></thead>
    <tbody>${tr || '<tr><td colspan="2">Nessun giudice assegnato</td></tr>'}</tbody></table>`);
}

export function renderJuryQrHtml(cls: ClassInfo, categoryId: string, judges: JuryQrRow[]) {
  const cards = judges
    .map((j) => `<div class="qr">
      <img alt="${escapeHtml(juryQrPayload(j.judgeUserId, categoryId))}" src="${escapeHtml(j.qrDataUrl)}" width="200" height="200"/>
      <h2>${escapeHtml(j.name)}</h2>
      <p>${escapeHtml(cls.name)}</p>
    </div>`)
    .join("");
  return page(`QR giuria ${cls.name}`, `<h1>QR giuria</h1>
    <p class="sub"><strong>Classe:</strong> ${escapeHtml(cls.name)}</p>
    ${cards || "<p>Nessun giudice assegnato</p>"}`);
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
  .get("/classes/:categoryId/exhibitors", async ({ tenantDb, params, set }) => {
    if (!isUuid(params.categoryId)) {
      set.status = 422;
      return { error: "categoryId must be a valid uuid" };
    }
    const cls = await loadClass(tenantDb, params.categoryId);
    if (!cls) {
      set.status = 404;
      return { error: "Class not found" };
    }
    const fmt = await loadModelCodeFormatSettings(tenantDb);
    const rows = await tenantDb
      .select({
        modelName: modelsTable.name,
        code: modelsTable.code,
        displayNumber: modelsTable.displayNumber,
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
        code: formatModelCode(r.code, (cls as any).seqId, r.displayNumber, fmt)
      }))
      .sort((a, b) => a.exhibitor.localeCompare(b.exhibitor) || a.modelName.localeCompare(b.modelName));
    set.headers["content-type"] = "text/html; charset=utf-8";
    set.headers["content-disposition"] = `inline; filename="class-exhibitors.html"`;
    return renderExhibitorsHtml(cls, list);
  }, {
    params,
    detail: { summary: "Stampa espositori e modelli della classe", tags: ["Exports"], security: [{ bearerAuth: [] }] }
  })
  .get("/classes/:categoryId/jury-list", async ({ tenantDb, params, set }) => {
    if (!isUuid(params.categoryId)) {
      set.status = 422;
      return { error: "categoryId must be a valid uuid" };
    }
    const cls = await loadClass(tenantDb, params.categoryId);
    if (!cls) {
      set.status = 404;
      return { error: "Class not found" };
    }
    const judges = await loadClassJudges(tenantDb, cls);
    set.headers["content-type"] = "text/html; charset=utf-8";
    set.headers["content-disposition"] = `inline; filename="class-jury-list.html"`;
    return renderJuryListHtml(cls, judges);
  }, {
    params,
    detail: { summary: "Stampa elenco giudici della classe", tags: ["Exports"], security: [{ bearerAuth: [] }] }
  })
  .get("/classes/:categoryId/jury-qr", async ({ tenantDb, params, set }) => {
    if (!isUuid(params.categoryId)) {
      set.status = 422;
      return { error: "categoryId must be a valid uuid" };
    }
    const cls = await loadClass(tenantDb, params.categoryId);
    if (!cls) {
      set.status = 404;
      return { error: "Class not found" };
    }
    const judges = await loadClassJudges(tenantDb, cls);
    const withQr: JuryQrRow[] = await Promise.all(judges.map(async (j) => ({
      ...j,
      qrDataUrl: await QRCode.toDataURL(juryQrPayload(j.judgeUserId, cls.id), { margin: 1, width: 200, errorCorrectionLevel: "M" })
    })));
    set.headers["content-type"] = "text/html; charset=utf-8";
    set.headers["content-disposition"] = `inline; filename="class-jury-qr.html"`;
    return renderJuryQrHtml(cls, cls.id, withQr);
  }, {
    params,
    detail: { summary: "Stampa QR giudici della classe", tags: ["Exports"], security: [{ bearerAuth: [] }] }
  });
