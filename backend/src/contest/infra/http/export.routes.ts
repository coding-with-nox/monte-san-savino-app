import { Elysia, t } from "elysia";
import { and, eq } from "drizzle-orm";
import QRCode from "qrcode";
import { escapeHtml } from "../../../shared/domain/escapeHtml";
import { requireRole } from "../../../identity/infra/http/role.middleware";
import { tenantMiddleware } from "../../../tenancy/infra/http/tenant.middleware";
import { categoriesTable, eventsTable, modelsTable, registrationsTable, settingsTable } from "../persistence/schema";
import { userProfilesTable, usersTable } from "../../../identity/infra/persistence/schema";
import { formatModelCode, loadModelCodeFormatSettings } from "./model-code";

type ExportSettings = {
  includeModelCode: boolean;
  includeModelDescription: boolean;
  includeParticipantEmail: boolean;
  excelSheetName: string;
  excelFilePrefix: string;
  displayNumberPadding: number;
};

type ZipEntry = {
  name: string;
  data: Uint8Array;
};

const textEncoder = new TextEncoder();

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let j = 0; j < 8; j += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    c = CRC32_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function concatBytes(parts: Uint8Array[]) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function buildZip(entries: ZipEntry[]) {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = textEncoder.encode(entry.name);
    const dataBytes = entry.data;
    const crc = crc32(dataBytes);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, 0, true);
    localView.setUint16(12, 0, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, dataBytes.length, true);
    localView.setUint32(22, dataBytes.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    localParts.push(localHeader, dataBytes);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, 0, true);
    centralView.setUint16(14, 0, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, dataBytes.length, true);
    centralView.setUint32(24, dataBytes.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);

    centralParts.push(centralHeader);
    offset += localHeader.length + dataBytes.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const endRecord = new Uint8Array(22);
  const endView = new DataView(endRecord.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);
  endView.setUint16(20, 0, true);

  return concatBytes([...localParts, ...centralParts, endRecord]);
}

function xmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function sanitizeSheetName(name: string) {
  const cleaned = name.replace(/[\\/\?\*\[\]:]/g, " ").trim();
  return (cleaned || "Sheet1").slice(0, 31);
}

function columnName(index: number) {
  let n = index + 1;
  let name = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

function buildWorksheetXml(headers: string[], rows: Record<string, any>[]) {
  const normalizedRows = rows.length > 0 ? rows : [{ info: "Nessun dato" }];
  const effectiveHeaders = rows.length > 0 ? headers : ["info"];

  const xmlRows: string[] = [];

  const headerCells = effectiveHeaders
    .map((header, colIndex) => {
      const ref = `${columnName(colIndex)}1`;
      return `<c r=\"${ref}\" t=\"inlineStr\" s=\"1\"><is><t>${xmlEscape(header)}</t></is></c>`;
    })
    .join("");
  xmlRows.push(`<row r=\"1\">${headerCells}</row>`);

  normalizedRows.forEach((row, rowIdx) => {
    const rowNumber = rowIdx + 2;
    const cells = effectiveHeaders
      .map((header, colIdx) => {
        const ref = `${columnName(colIdx)}${rowNumber}`;
        const value = String(row[header] ?? "");
        return `<c r=\"${ref}\" t=\"inlineStr\"><is><t xml:space=\"preserve\">${xmlEscape(value)}</t></is></c>`;
      })
      .join("");
    xmlRows.push(`<row r=\"${rowNumber}\">${cells}</row>`);
  });

  return `<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>
<worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\">
  <sheetData>
    ${xmlRows.join("\n")}
  </sheetData>
</worksheet>`;
}

function toXlsx(sheetName: string, rows: Record<string, any>[]) {
  const safeSheetName = sanitizeSheetName(sheetName);
  const headers = rows.length > 0 ? Object.keys(rows[0]) : ["info"];

  const contentTypes = `<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>
<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\">
  <Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/>
  <Default Extension=\"xml\" ContentType=\"application/xml\"/>
  <Override PartName=\"/xl/workbook.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml\"/>
  <Override PartName=\"/xl/worksheets/sheet1.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/>
  <Override PartName=\"/xl/styles.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml\"/>
</Types>`;

  const rels = `<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>
<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">
  <Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"xl/workbook.xml\"/>
</Relationships>`;

  const workbook = `<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>
<workbook xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\">
  <sheets>
    <sheet name=\"${xmlEscape(safeSheetName)}\" sheetId=\"1\" r:id=\"rId1\"/>
  </sheets>
</workbook>`;

  const workbookRels = `<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>
<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">
  <Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet1.xml\"/>
  <Relationship Id=\"rId2\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles\" Target=\"styles.xml\"/>
</Relationships>`;

  const styles = `<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>
<styleSheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\">
  <fonts count=\"2\">
    <font><sz val=\"11\"/><name val=\"Calibri\"/></font>
    <font><b/><sz val=\"11\"/><name val=\"Calibri\"/></font>
  </fonts>
  <fills count=\"2\">
    <fill><patternFill patternType=\"none\"/></fill>
    <fill><patternFill patternType=\"gray125\"/></fill>
  </fills>
  <borders count=\"1\">
    <border><left/><right/><top/><bottom/><diagonal/></border>
  </borders>
  <cellStyleXfs count=\"1\">
    <xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\"/>
  </cellStyleXfs>
  <cellXfs count=\"2\">
    <xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\"/>
    <xf numFmtId=\"0\" fontId=\"1\" fillId=\"0\" borderId=\"0\" xfId=\"0\" applyFont=\"1\"/>
  </cellXfs>
</styleSheet>`;

  const worksheet = buildWorksheetXml(headers, rows);

  return buildZip([
    { name: "[Content_Types].xml", data: textEncoder.encode(contentTypes) },
    { name: "_rels/.rels", data: textEncoder.encode(rels) },
    { name: "xl/workbook.xml", data: textEncoder.encode(workbook) },
    { name: "xl/_rels/workbook.xml.rels", data: textEncoder.encode(workbookRels) },
    { name: "xl/styles.xml", data: textEncoder.encode(styles) },
    { name: "xl/worksheets/sheet1.xml", data: textEncoder.encode(worksheet) }
  ]);
}

function boolFromSetting(value: string | undefined, fallback: boolean) {
  if (value === undefined) return fallback;
  return value.toLowerCase() === "true";
}

function normalizePlainText(value: string | undefined, fallback: string, maxLen = 40) {
  const cleaned = (value ?? "").trim();
  return (cleaned || fallback).slice(0, maxLen);
}

function normalizeFilePart(value: string | undefined, fallback: string) {
  const cleaned = (value ?? "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return cleaned || fallback;
}

async function loadExportSettings(tenantDb: any): Promise<ExportSettings> {
  const rows = await tenantDb.select().from(settingsTable);
  const map = new Map<string, string>();
  for (const row of rows as Array<{ key: string; value: string }>) {
    map.set(row.key, row.value);
  }
  const codeFormat = await loadModelCodeFormatSettings(tenantDb);
  return {
    includeModelCode: boolFromSetting(map.get("exportIncludeModelCode"), true),
    includeModelDescription: boolFromSetting(map.get("exportIncludeModelDescription"), true),
    includeParticipantEmail: boolFromSetting(map.get("exportIncludeParticipantEmail"), true),
    excelSheetName: normalizePlainText(map.get("excelSheetName"), "Export", 31),
    excelFilePrefix: normalizeFilePart(map.get("excelFilePrefix"), "contest-export"),
    displayNumberPadding: codeFormat.displayNumberPadding
  };
}

function setXlsxHeaders(set: any, filename: string) {
  set.headers["content-type"] = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  set.headers["content-disposition"] = `attachment; filename=\"${filename}.xlsx\"`;
}

function fullName(firstName?: string | null, lastName?: string | null, fallback?: string | null) {
  const name = [firstName, lastName].filter(Boolean).join(" ").trim();
  return name || fallback || "";
}

function buildFileName(settings: ExportSettings, suffix: string, extra?: string) {
  const parts = [settings.excelFilePrefix, suffix, extra].filter(Boolean);
  return normalizeFilePart(parts.join("-"), "export");
}

function buildSheetName(settings: ExportSettings, suffix: string) {
  return sanitizeSheetName(`${settings.excelSheetName}-${suffix}`);
}

function formatModelCodeForExport(settings: ExportSettings, code: number | null | undefined, categorySeqId?: number | null, displayNumber?: number | null) {
  return formatModelCode(code, categorySeqId ?? null, displayNumber ?? null, {
    displayNumberPadding: settings.displayNumberPadding
  });
}

export function socialHref(kind: "instagram" | "facebook", value: string | null | undefined): string | null {
  const v = (value ?? "").trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  if (/^[A-Za-z0-9._]+$/.test(v)) {
    return kind === "instagram" ? `https://instagram.com/${v}` : `https://facebook.com/${v}`;
  }
  return null;
}

function renderLink(href: string | null, label: string | null | undefined) {
  const text = (label ?? "").trim();
  if (!text) return "";
  if (!href || !/^https?:\/\//i.test(href)) return escapeHtml(text);
  return `<a href="${escapeHtml(href)}">${escapeHtml(text)}</a>`;
}

export function renderSocialHtml(u: { instagram?: string | null; facebook?: string | null; website?: string | null }) {
  const parts: string[] = [];
  if (u.instagram) parts.push(`IG: ${renderLink(socialHref("instagram", u.instagram), u.instagram)}`);
  if (u.facebook) parts.push(`FB: ${renderLink(socialHref("facebook", u.facebook), u.facebook)}`);
  if (u.website) parts.push(`Web: ${renderLink(u.website, u.website)}`);
  return parts.join("<br/>");
}

export function modelQrPayload(modelId: string) {
  return `model:${modelId}`;
}

async function modelQrDataUrl(modelId: string) {
  return QRCode.toDataURL(modelQrPayload(modelId), { margin: 1, width: 160, errorCorrectionLevel: "M" });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ExportFilters = { eventId?: string; categoryId?: string; userId?: string; modelId?: string };
export type ExportFiltersResult =
  | { ok: true; filters: ExportFilters }
  | { ok: false; status: 422; error: string };

/**
 * Parses optional, combinable export filters (all uuid). Invalid uuid -> 422.
 * With requireEventUnlessScoped, eventId is mandatory unless userId or modelId is present.
 */
export function parseExportFilters(
  query: Record<string, unknown> | undefined,
  opts: { requireEventUnlessScoped?: boolean } = {}
): ExportFiltersResult {
  const filters: ExportFilters = {};
  for (const key of ["eventId", "categoryId", "userId", "modelId"] as const) {
    const raw = query?.[key];
    if (raw === undefined || raw === null || raw === "") continue;
    const value = String(raw);
    if (!UUID_RE.test(value)) return { ok: false, status: 422, error: `${key} must be a valid uuid` };
    filters[key] = value;
  }
  if (opts.requireEventUnlessScoped && !filters.eventId && !filters.userId && !filters.modelId) {
    return { ok: false, status: 422, error: "eventId is required unless userId or modelId is provided" };
  }
  return { ok: true, filters };
}

function buildModelFilterConditions(filters: ExportFilters) {
  const conds: any[] = [];
  if (filters.eventId) conds.push(eq(categoriesTable.eventId, filters.eventId as any));
  if (filters.categoryId) conds.push(eq(modelsTable.categoryId, filters.categoryId as any));
  if (filters.userId) conds.push(eq(modelsTable.userId, filters.userId as any));
  if (filters.modelId) conds.push(eq(modelsTable.id, filters.modelId as any));
  return conds;
}

export const exportFilterQuerySchema = t.Object({
  eventId: t.Optional(t.String()),
  categoryId: t.Optional(t.String()),
  userId: t.Optional(t.String()),
  modelId: t.Optional(t.String())
});

function filtersFileSuffix(filters: ExportFilters) {
  return [filters.eventId, filters.userId, filters.modelId].filter(Boolean).join("-") || undefined;
}

async function getLabelRows(tenantDb: any, filters: ExportFilters, exportSettings: ExportSettings) {
  const conds = buildModelFilterConditions(filters);
  const rows = await tenantDb
    .select({
      modelId: modelsTable.id,
      userEmail: usersTable.email,
      firstName: userProfilesTable.firstName,
      lastName: userProfilesTable.lastName,
      categoryName: categoriesTable.name,
      categorySeqId: categoriesTable.seqId,
      modelName: modelsTable.name,
      modelCode: modelsTable.code,
      displayNumber: modelsTable.displayNumber,
      notes: modelsTable.notes
    })
    .from(modelsTable)
    .innerJoin(categoriesTable, eq(categoriesTable.id, modelsTable.categoryId))
    .leftJoin(usersTable, eq(usersTable.id, modelsTable.userId))
    .leftJoin(userProfilesTable, eq(userProfilesTable.userId, modelsTable.userId))
    .where(conds.length ? and(...conds) : undefined);

  return Promise.all((rows as any[]).map(async (row) => ({
    utente: fullName(row.firstName, row.lastName, row.userEmail) || row.userEmail || "",
    categoria: row.categoryName ?? "",
    nomeModello: row.modelName ?? "",
    codice: formatModelCodeForExport(exportSettings, row.modelCode, row.categorySeqId, row.displayNumber),
    note: row.notes ?? "",
    qrPayload: modelQrPayload(row.modelId),
    qr: await modelQrDataUrl(row.modelId)
  })));
}

const managerExportRoutes = new Elysia()
  .use(requireRole("manager"))
  .get("/enrollments", async ({ tenantDb, query, set }) => {
    const eventId = query?.eventId ? String(query.eventId) : null;
    const exportSettings = await loadExportSettings(tenantDb);

    const queryBuilder = tenantDb
      .select({
        enrollmentId: registrationsTable.id,
        eventName: eventsTable.name,
        userId: registrationsTable.userId,
        email: usersTable.email,
        participant: userProfilesTable.firstName,
        participantLastName: userProfilesTable.lastName,
        modelName: modelsTable.name,
        modelCode: modelsTable.code,
        modelDescription: modelsTable.description,
        categoryName: categoriesTable.name,
        categorySeqId: categoriesTable.seqId,
        displayNumber: modelsTable.displayNumber,
        checkedIn: registrationsTable.checkedIn
      })
      .from(registrationsTable)
      .leftJoin(eventsTable, eq(eventsTable.id, registrationsTable.eventId))
      .leftJoin(usersTable, eq(usersTable.id, registrationsTable.userId))
      .leftJoin(userProfilesTable, eq(userProfilesTable.userId, registrationsTable.userId))
      .leftJoin(modelsTable, eq(modelsTable.id, registrationsTable.modelId))
      .leftJoin(categoriesTable, eq(categoriesTable.id, registrationsTable.categoryId));

    const rows = eventId
      ? await queryBuilder.where(eq(registrationsTable.eventId, eventId as any))
      : await queryBuilder;

    const excelRows = rows.map((row: any) => {
      const base: Record<string, string> = {
        enrollmentId: row.enrollmentId,
        eventName: row.eventName ?? "",
        partecipante: fullName(row.participant, row.participantLastName, row.email ?? row.userId),
        modello: row.modelName ?? "",
        categoria: row.categoryName ?? "",
        checkIn: row.checkedIn ? "true" : "false"
      };

      if (exportSettings.includeParticipantEmail) {
        base.email = row.email ?? "";
      }
      if (exportSettings.includeModelCode) {
        base.codice = formatModelCodeForExport(exportSettings, row.modelCode, row.categorySeqId, row.displayNumber);
      }
      if (exportSettings.includeModelDescription) {
        base.descrizione = row.modelDescription ?? "";
      }
      return base;
    });

    setXlsxHeaders(set, buildFileName(exportSettings, "enrollments", eventId ?? undefined));
    return toXlsx(buildSheetName(exportSettings, "Enrollments"), excelRows);
  }, {
    detail: {
      summary: "Export iscrizioni Excel (XLSX)",
      tags: ["Exports"],
      security: [{ bearerAuth: [] }]
    }
  })
  .get("/models", async ({ tenantDb, query, set }) => {
    const categoryId = query?.categoryId ? String(query.categoryId) : null;
    const exportSettings = await loadExportSettings(tenantDb);

    const baseQuery = tenantDb
      .select({
        id: modelsTable.id,
        userId: modelsTable.userId,
        categoryId: modelsTable.categoryId,
        name: modelsTable.name,
        description: modelsTable.description,
        code: modelsTable.code,
        imageUrl: modelsTable.imageUrl,
        categorySeqId: categoriesTable.seqId,
        displayNumber: modelsTable.displayNumber
      })
      .from(modelsTable)
      .innerJoin(categoriesTable, eq(categoriesTable.id, modelsTable.categoryId));
    const rows = categoryId
      ? await baseQuery.where(eq(modelsTable.categoryId, categoryId as any))
      : await baseQuery;

    const excelRows = rows.map((row: any) => {
      const base: Record<string, string> = {
        id: row.id,
        userId: row.userId,
        categoryId: row.categoryId,
        nome: row.name
      };
      if (exportSettings.includeModelCode) {
        base.codice = formatModelCodeForExport(exportSettings, row.code, row.categorySeqId, row.displayNumber);
      }
      if (exportSettings.includeModelDescription) {
        base.descrizione = row.description ?? "";
      }
      return base;
    });

    setXlsxHeaders(set, buildFileName(exportSettings, "models"));
    return toXlsx(buildSheetName(exportSettings, "Models"), excelRows);
  }, {
    detail: {
      summary: "Export modelli Excel (XLSX)",
      tags: ["Exports"],
      security: [{ bearerAuth: [] }]
    }
  })
  .get("/users/by-event/excel", async ({ tenantDb, query, set }) => {
    const eventId = query?.eventId ? String(query.eventId) : "";
    if (!eventId) {
      set.status = 400;
      return { error: "eventId is required" };
    }

    const exportSettings = await loadExportSettings(tenantDb);

    // Task 04: deduplicate users (multiple registrations post Task-02 fix)
    const allUserRows = await tenantDb
      .select({
        userId: registrationsTable.userId,
        email: usersTable.email,
        firstName: userProfilesTable.firstName,
        lastName: userProfilesTable.lastName,
        instagram: userProfilesTable.instagram,
        facebook: userProfilesTable.facebook,
        website: userProfilesTable.website
      })
      .from(registrationsTable)
      .innerJoin(usersTable, eq(usersTable.id, registrationsTable.userId))
      .leftJoin(userProfilesTable, eq(userProfilesTable.userId, registrationsTable.userId))
      .where(eq(registrationsTable.eventId, eventId as any));
    const seenUserIds = new Set<string>();
    const users = (allUserRows as any[]).filter((u) => {
      if (seenUserIds.has(u.userId)) return false;
      seenUserIds.add(u.userId);
      return true;
    });

    const models = await tenantDb
      .select({
        userId: modelsTable.userId,
        modelName: modelsTable.name,
        modelCode: modelsTable.code,
        modelDescription: modelsTable.description,
        categoryName: categoriesTable.name,
        categorySeqId: categoriesTable.seqId,
        displayNumber: modelsTable.displayNumber
      })
      .from(modelsTable)
      .innerJoin(categoriesTable, eq(categoriesTable.id, modelsTable.categoryId))
      .where(eq(categoriesTable.eventId, eventId as any));

    const modelsByUser = new Map<string, string[]>();
    for (const model of models as any[]) {
      const list = modelsByUser.get(model.userId) ?? [];
      const parts = [model.modelName];
      const formattedCode = formatModelCodeForExport(exportSettings, model.modelCode, model.categorySeqId, model.displayNumber);
      if (exportSettings.includeModelCode && formattedCode) {
        parts.push(`(${formattedCode})`);
      }
      if (exportSettings.includeModelDescription && model.modelDescription) {
        parts.push(`- ${model.modelDescription}`);
      }
      parts.push(`- ${model.categoryName}`);
      list.push(parts.join(" ").replace(/\s+/g, " ").trim());
      modelsByUser.set(model.userId, list);
    }

    const excelRows = (users as any[]).map((u) => {
      const base: Record<string, string> = {
        utente: fullName(u.firstName, u.lastName, u.email),
        modelli: (modelsByUser.get(u.userId) ?? []).join(" | ")
      };
      if (exportSettings.includeParticipantEmail) {
        base.email = u.email;
      }
      base.instagram = u.instagram ?? "";
      base.facebook = u.facebook ?? "";
      base.website = u.website ?? "";
      return base;
    });

    setXlsxHeaders(set, buildFileName(exportSettings, "users-by-event", eventId));
    return toXlsx(buildSheetName(exportSettings, "Users"), excelRows);
  }, {
    query: t.Object({ eventId: t.String() }),
    detail: {
      summary: "Export utenti per evento Excel (XLSX)",
      tags: ["Exports"],
      security: [{ bearerAuth: [] }]
    }
  })
  .get("/users/by-event/pdf", async ({ tenantDb, query, set }) => {
    const eventId = query?.eventId ? String(query.eventId) : "";
    if (!eventId) {
      set.status = 400;
      return { error: "eventId is required" };
    }
    const exportSettings = await loadExportSettings(tenantDb);

    const [event] = await tenantDb
      .select({ id: eventsTable.id, name: eventsTable.name })
      .from(eventsTable)
      .where(eq(eventsTable.id, eventId as any))
      .limit(1);

    // Task 04: deduplicate users
    const allUserRowsPdf = await tenantDb
      .select({
        userId: registrationsTable.userId,
        email: usersTable.email,
        firstName: userProfilesTable.firstName,
        lastName: userProfilesTable.lastName,
        instagram: userProfilesTable.instagram,
        facebook: userProfilesTable.facebook,
        website: userProfilesTable.website
      })
      .from(registrationsTable)
      .innerJoin(usersTable, eq(usersTable.id, registrationsTable.userId))
      .leftJoin(userProfilesTable, eq(userProfilesTable.userId, registrationsTable.userId))
      .where(eq(registrationsTable.eventId, eventId as any));
    const seenUserIdsPdf = new Set<string>();
    const users = (allUserRowsPdf as any[]).filter((u) => {
      if (seenUserIdsPdf.has(u.userId)) return false;
      seenUserIdsPdf.add(u.userId);
      return true;
    });

    const models = await tenantDb
      .select({
        userId: modelsTable.userId,
        modelName: modelsTable.name,
        modelCode: modelsTable.code,
        categoryName: categoriesTable.name,
        categorySeqId: categoriesTable.seqId,
        displayNumber: modelsTable.displayNumber
      })
      .from(modelsTable)
      .innerJoin(categoriesTable, eq(categoriesTable.id, modelsTable.categoryId))
      .where(eq(categoriesTable.eventId, eventId as any));

    const modelsByUser = new Map<string, string[]>();
    for (const model of models as any[]) {
      const list = modelsByUser.get(model.userId) ?? [];
      const formattedCode = formatModelCodeForExport(exportSettings, model.modelCode, model.categorySeqId, model.displayNumber);
      list.push(`${model.modelName}${formattedCode ? ` (${formattedCode})` : ""} - ${model.categoryName}`);
      modelsByUser.set(model.userId, list);
    }

    const rows = (users as any[])
      .map((u) => {
        const participant = fullName(u.firstName, u.lastName, u.email);
        const modelList = modelsByUser.get(u.userId) ?? [];
        const modelsHtml = modelList.map((m) => escapeHtml(m)).join("<br/>") || "-";
        return `<tr><td>${escapeHtml(participant)}</td><td>${escapeHtml(u.email)}</td><td>${renderSocialHtml(u) || "-"}</td><td>${modelsHtml}</td></tr>`;
      })
      .join("");

    set.headers["content-type"] = "text/html; charset=utf-8";
    set.headers["content-disposition"] = `inline; filename=\"users-by-event-${normalizeFilePart(eventId, "event")}.html\"`;

    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset=\"utf-8\" />
    <title>Export utenti ${escapeHtml(event?.name ?? eventId)}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 24px; }
      h1 { margin-bottom: 8px; }
      p { color: #555; margin-top: 0; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #ccc; padding: 8px; text-align: left; vertical-align: top; }
      th { background: #f2f2f2; }
      @media print {
        @page { size: A4 portrait; margin: 12mm; }
      }
    </style>
  </head>
  <body>
    <h1>Utenti per evento</h1>
    <p><strong>Evento:</strong> ${escapeHtml(event?.name ?? eventId)}</p>
    <table>
      <thead>
        <tr>
          <th>Partecipante</th>
          <th>Email</th>
          <th>Social</th>
          <th>Modelli</th>
        </tr>
      </thead>
      <tbody>
        ${rows || "<tr><td colspan=\"4\">Nessun dato</td></tr>"}
      </tbody>
    </table>
    <script>window.onload = () => window.print();</script>
  </body>
</html>`;
  }, {
    query: t.Object({ eventId: t.String() }),
    detail: {
      summary: "Export utenti per evento (stampa PDF)",
      tags: ["Exports"],
      security: [{ bearerAuth: [] }]
    }
  })
  .get("/models/print", async ({ tenantDb, query, set }) => {
    const parsed = parseExportFilters(query as any);
    if (!parsed.ok) {
      set.status = parsed.status;
      return { error: parsed.error };
    }
    const exportSettings = await loadExportSettings(tenantDb);

    const filters = buildModelFilterConditions(parsed.filters);
    const baseQuery = tenantDb
      .select({
        id: modelsTable.id,
        name: modelsTable.name,
        description: modelsTable.description,
        notes: modelsTable.notes,
        code: modelsTable.code,
        displayNumber: modelsTable.displayNumber,
        categoryName: categoriesTable.name,
        categorySeqId: categoriesTable.seqId,
        userEmail: usersTable.email,
        firstName: userProfilesTable.firstName,
        lastName: userProfilesTable.lastName
      })
      .from(modelsTable)
      .innerJoin(categoriesTable, eq(categoriesTable.id, modelsTable.categoryId))
      .leftJoin(usersTable, eq(usersTable.id, modelsTable.userId))
      .leftJoin(userProfilesTable, eq(userProfilesTable.userId, modelsTable.userId));
    const rows = (filters.length ? await baseQuery.where(and(...filters)) : await baseQuery) as any[];

    const cards = await Promise.all(rows.map(async (row) => {
      const code = formatModelCodeForExport(exportSettings, row.code, row.categorySeqId, row.displayNumber);
      const qr = await modelQrDataUrl(row.id);
      return `<section class="card">
        <img class="qr" alt="${escapeHtml(modelQrPayload(row.id))}" src="${escapeHtml(qr)}" width="120" height="120"/>
        <div class="info">
          <h2>${escapeHtml(row.name)}</h2>
          <p><strong>Codice:</strong> ${escapeHtml(code)}</p>
          <p><strong>Categoria:</strong> ${escapeHtml(row.categoryName)}</p>
          <p><strong>Utente:</strong> ${escapeHtml(fullName(row.firstName, row.lastName, row.userEmail))}</p>
          ${row.description && exportSettings.includeModelDescription ? `<p><strong>Descrizione:</strong> ${escapeHtml(row.description)}</p>` : ""}
          ${row.notes ? `<p><strong>Note:</strong> ${escapeHtml(row.notes)}</p>` : ""}
        </div>
      </section>`;
    }));

    set.headers["content-type"] = "text/html; charset=utf-8";
    set.headers["content-disposition"] = `inline; filename="models-print.html"`;

    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Stampa modelli</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 24px; }
      .card { display: flex; gap: 16px; border: 1px solid #ccc; padding: 12px; margin-bottom: 12px; page-break-inside: avoid; break-inside: avoid; }
      .card h2 { margin: 0 0 6px; font-size: 14pt; }
      .card p { margin: 2px 0; font-size: 10pt; }
      @media print {
        @page { size: A4 portrait; margin: 12mm; }
        body { margin: 0; }
      }
    </style>
  </head>
  <body>
    <h1>Modelli</h1>
    ${cards.join("") || "<p>Nessun modello</p>"}
    <script>window.onload = () => window.print();</script>
  </body>
</html>`;
  }, {
    query: exportFilterQuerySchema,
    detail: {
      summary: "Stampa modelli (HTML stampabile con QR e note)",
      tags: ["Exports"],
      security: [{ bearerAuth: [] }]
    }
  })
  .get("/labels/data", async ({ tenantDb, query, set }) => {
    const parsed = parseExportFilters(query as any, { requireEventUnlessScoped: true });
    if (!parsed.ok) {
      set.status = parsed.status;
      return { error: parsed.error };
    }
    const exportSettings = await loadExportSettings(tenantDb);
    return await getLabelRows(tenantDb, parsed.filters, exportSettings);
  }, {
    query: exportFilterQuerySchema,
    detail: {
      summary: "Dati etichette JSON (DYMO/stampa diretta)",
      tags: ["Exports"],
      security: [{ bearerAuth: [] }]
    }
  })
  .get("/labels/excel", async ({ tenantDb, query, set }) => {
    const parsed = parseExportFilters(query as any, { requireEventUnlessScoped: true });
    if (!parsed.ok) {
      set.status = parsed.status;
      return { error: parsed.error };
    }

    const exportSettings = await loadExportSettings(tenantDb);
    const rows = await getLabelRows(tenantDb, parsed.filters, exportSettings);
    setXlsxHeaders(set, buildFileName(exportSettings, "labels", filtersFileSuffix(parsed.filters)));
    return toXlsx(buildSheetName(exportSettings, "Labels"), rows.map(({ qr: _qr, ...rest }) => rest));
  }, {
    query: exportFilterQuerySchema,
    detail: {
      summary: "Export etichette Excel (XLSX)",
      tags: ["Exports"],
      security: [{ bearerAuth: [] }]
    }
  })
  .get("/labels/pdf", async ({ tenantDb, query, set }) => {
    const parsed = parseExportFilters(query as any, { requireEventUnlessScoped: true });
    if (!parsed.ok) {
      set.status = parsed.status;
      return { error: parsed.error };
    }
    const eventId = parsed.filters.eventId;

    const [event] = eventId
      ? await tenantDb
        .select({ id: eventsTable.id, name: eventsTable.name })
        .from(eventsTable)
        .where(eq(eventsTable.id, eventId as any))
        .limit(1)
      : [];

    const exportSettings = await loadExportSettings(tenantDb);
    const rows = await getLabelRows(tenantDb, parsed.filters, exportSettings);
    const bodyRows = rows
      .map((row) => `<tr><td>${escapeHtml(row.utente)}</td><td>${escapeHtml(row.categoria)}</td><td>${escapeHtml(row.nomeModello)}</td><td>${escapeHtml(row.codice)}</td><td>${escapeHtml(row.note)}</td><td><img class="qr" alt="${escapeHtml(row.qrPayload)}" src="${escapeHtml(row.qr)}" width="80" height="80"/></td></tr>`)
      .join("");

    set.headers["content-type"] = "text/html; charset=utf-8";
    set.headers["content-disposition"] = `inline; filename=\"labels-${normalizeFilePart(filtersFileSuffix(parsed.filters), "labels")}.html\"`;

    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset=\"utf-8\" />
    <title>Etichette ${escapeHtml(event?.name ?? eventId ?? "")}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 24px; }
      h1 { margin-bottom: 8px; }
      p { color: #555; margin-top: 0; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #ccc; padding: 8px; text-align: left; vertical-align: top; }
      th { background: #f2f2f2; }
      @media print {
        @page { size: A4 portrait; margin: 12mm; }
      }
    </style>
  </head>
  <body>
    <h1>Stampa etichette</h1>
    ${eventId ? `<p><strong>Evento:</strong> ${escapeHtml(event?.name ?? eventId)}</p>` : ""}
    <table>
      <thead>
        <tr>
          <th>Utente</th>
          <th>Categoria</th>
          <th>Nome modello</th>
          <th>Codice</th>
          <th>Note</th>
          <th>QR</th>
        </tr>
      </thead>
      <tbody>
        ${bodyRows || "<tr><td colspan=\"6\">Nessun dato</td></tr>"}
      </tbody>
    </table>
    <script>window.onload = () => window.print();</script>
  </body>
</html>`;
  }, {
    query: exportFilterQuerySchema,
    detail: {
      summary: "Export etichette PDF",
      tags: ["Exports"],
      security: [{ bearerAuth: [] }]
    }
  });

const userExportRoutes = new Elysia()
  .use(requireRole("user"))
  .get("/my-enrollments", async ({ tenantDb, user, set }) => {
    const exportSettings = await loadExportSettings(tenantDb);

    const rows = await tenantDb
      .select({
        enrollmentId: registrationsTable.id,
        eventName: eventsTable.name,
        modelName: modelsTable.name,
        modelCode: modelsTable.code,
        modelDescription: modelsTable.description,
        categoryName: categoriesTable.name,
        categorySeqId: categoriesTable.seqId,
        displayNumber: modelsTable.displayNumber,
        checkedIn: registrationsTable.checkedIn
      })
      .from(registrationsTable)
      .leftJoin(eventsTable, eq(eventsTable.id, registrationsTable.eventId))
      .leftJoin(modelsTable, eq(modelsTable.id, registrationsTable.modelId))
      .leftJoin(categoriesTable, eq(categoriesTable.id, registrationsTable.categoryId))
      .where(eq(registrationsTable.userId, user!.id as any));

    const excelRows = (rows as any[]).map((row) => {
      const base: Record<string, string> = {
        enrollmentId: row.enrollmentId,
        eventName: row.eventName ?? "",
        modello: row.modelName ?? "",
        categoria: row.categoryName ?? "",
        checkIn: row.checkedIn ? "true" : "false"
      };
      if (exportSettings.includeModelCode) {
        base.codice = formatModelCodeForExport(exportSettings, row.modelCode, row.categorySeqId, row.displayNumber);
      }
      if (exportSettings.includeModelDescription) {
        base.descrizione = row.modelDescription ?? "";
      }
      return base;
    });

    setXlsxHeaders(set, buildFileName(exportSettings, "my-enrollments"));
    return toXlsx(buildSheetName(exportSettings, "MyEnrollments"), excelRows);
  }, {
    detail: {
      summary: "Export mie iscrizioni Excel (XLSX)",
      tags: ["Exports"],
      security: [{ bearerAuth: [] }]
    }
  })
  // Task 06+07: stampa scheda utente con modelli e info team
  .get("/model-card/pdf", async ({ tenantDb, user, query, set }) => {
    const eventId = query?.eventId ? String(query.eventId) : null;
    const exportSettings = await loadExportSettings(tenantDb);

    const [profile] = await tenantDb
      .select({
        seqId: usersTable.seqId,
        email: usersTable.email,
        firstName: userProfilesTable.firstName,
        lastName: userProfilesTable.lastName,
        city: userProfilesTable.city
      })
      .from(usersTable)
      .leftJoin(userProfilesTable, eq(userProfilesTable.userId, usersTable.id))
      .where(eq(usersTable.id, user!.id as any))
      .limit(1);

    if (!profile) {
      set.status = 404;
      return { error: "User not found" };
    }

    // Load models (optionally filtered by event)
    const modelsQuery = tenantDb
      .select({
        id: modelsTable.id,
        name: modelsTable.name,
        code: modelsTable.code,
        categoryId: modelsTable.categoryId,
        categoryName: categoriesTable.name,
        categorySeqId: categoriesTable.seqId,
        displayNumber: modelsTable.displayNumber,
        eventId: categoriesTable.eventId
      })
      .from(modelsTable)
      .innerJoin(categoriesTable, eq(categoriesTable.id, modelsTable.categoryId))
      .where(eq(modelsTable.userId, user!.id as any));
    const allModels = eventId
      ? (await modelsQuery).filter((m: any) => m.eventId === eventId)
      : await modelsQuery;

    const userSeqId = profile.seqId;
    const paddedUserId = String(userSeqId).padStart(4, "0");

    // Build model rows HTML
    const modelRowsHtml = (allModels as any[]).map((model) => {
      const code = formatModelCodeForExport(exportSettings, model.code, model.categorySeqId, model.displayNumber);
      return `<tr>
        <td>${escapeHtml(code || model.id.slice(0, 8))}</td>
        <td>${escapeHtml(model.name)}</td>
        <td>${escapeHtml(model.categoryName ?? "")}</td>
      </tr>`;
    });

    const title = "Monte San Savino";
    set.headers["content-type"] = "text/html; charset=utf-8";
    set.headers["content-disposition"] = `inline; filename="model-card-${paddedUserId}.html"`;

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${title}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; }
    h1 { text-align: center; margin-bottom: 16px; }
    .section { margin-bottom: 16px; }
    .section h2 { font-size: 14pt; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-bottom: 8px; }
    .section p { margin: 2px 0; font-size: 11pt; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; vertical-align: top; font-size: 10pt; }
    th { background: #f2f2f2; font-weight: bold; }
    @media print { @page { size: A4 portrait; margin: 12mm; } }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <div class="section">
    <h2>User Details</h2>
    <p><strong>User ID:</strong> ${paddedUserId}</p>
    <p><strong>First name:</strong> ${escapeHtml(profile.firstName)}</p>
    <p><strong>Last name:</strong> ${escapeHtml(profile.lastName)}</p>
    <p><strong>Country:</strong> ${escapeHtml(profile.city)}</p>
    <p><strong>E-mail address:</strong> ${escapeHtml(profile.email)}</p>
    <p><strong>Model Total:</strong> ${allModels.length}</p>
  </div>
  <div class="section">
    <table>
      <thead>
        <tr>
          <th>Model ID</th>
          <th>Model Title</th>
          <th>Class Title</th>
        </tr>
      </thead>
      <tbody>
        ${modelRowsHtml.join("") || "<tr><td colspan=\"3\">Nessun modello</td></tr>"}
      </tbody>
    </table>
  </div>
  <script>window.onload = () => window.print();</script>
</body>
</html>`;
  }, {
    detail: {
      summary: "Stampa scheda utente con modelli (PDF)",
      tags: ["Exports"],
      security: [{ bearerAuth: [] }]
    }
  });

export const exportRoutes = new Elysia({ prefix: "/exports" })
  .use(tenantMiddleware)
  .use(managerExportRoutes)
  .use(userExportRoutes);
