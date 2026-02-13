import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";
import { requireRole } from "../../../identity/infra/http/role.middleware";
import { tenantMiddleware } from "../../../tenancy/infra/http/tenant.middleware";
import { categoriesTable, eventsTable, modelsTable, registrationsTable, settingsTable } from "../persistence/schema";
import { userProfilesTable, usersTable } from "../../../identity/infra/persistence/schema";

type ExportSettings = {
  includeModelCode: boolean;
  includeModelDescription: boolean;
  includeParticipantEmail: boolean;
  excelSheetName: string;
  excelFilePrefix: string;
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
  return {
    includeModelCode: boolFromSetting(map.get("exportIncludeModelCode"), true),
    includeModelDescription: boolFromSetting(map.get("exportIncludeModelDescription"), true),
    includeParticipantEmail: boolFromSetting(map.get("exportIncludeParticipantEmail"), true),
    excelSheetName: normalizePlainText(map.get("excelSheetName"), "Export", 31),
    excelFilePrefix: normalizeFilePart(map.get("excelFilePrefix"), "contest-export")
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

async function getLabelRows(tenantDb: any, eventId: string) {
  const rows = await tenantDb
    .select({
      userEmail: usersTable.email,
      firstName: userProfilesTable.firstName,
      lastName: userProfilesTable.lastName,
      categoryName: categoriesTable.name,
      modelName: modelsTable.name,
      modelCode: modelsTable.code
    })
    .from(modelsTable)
    .innerJoin(categoriesTable, eq(categoriesTable.id, modelsTable.categoryId))
    .leftJoin(usersTable, eq(usersTable.id, modelsTable.userId))
    .leftJoin(userProfilesTable, eq(userProfilesTable.userId, modelsTable.userId))
    .where(eq(categoriesTable.eventId, eventId as any));

  return (rows as any[]).map((row) => ({
    utente: fullName(row.firstName, row.lastName, row.userEmail) || row.userEmail || "",
    categoria: row.categoryName ?? "",
    nomeModello: row.modelName ?? "",
    codice: row.modelCode ?? ""
  }));
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
        base.codice = row.modelCode ?? "";
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

    const rows = categoryId
      ? await tenantDb.select().from(modelsTable).where(eq(modelsTable.categoryId, categoryId as any))
      : await tenantDb.select().from(modelsTable);

    const excelRows = rows.map((row: any) => {
      const base: Record<string, string> = {
        id: row.id,
        userId: row.userId,
        categoryId: row.categoryId,
        nome: row.name
      };
      if (exportSettings.includeModelCode) {
        base.codice = row.code ?? "";
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

    const users = await tenantDb
      .select({
        userId: registrationsTable.userId,
        email: usersTable.email,
        firstName: userProfilesTable.firstName,
        lastName: userProfilesTable.lastName
      })
      .from(registrationsTable)
      .innerJoin(usersTable, eq(usersTable.id, registrationsTable.userId))
      .leftJoin(userProfilesTable, eq(userProfilesTable.userId, registrationsTable.userId))
      .where(eq(registrationsTable.eventId, eventId as any));

    const models = await tenantDb
      .select({
        userId: modelsTable.userId,
        modelName: modelsTable.name,
        modelCode: modelsTable.code,
        modelDescription: modelsTable.description,
        categoryName: categoriesTable.name
      })
      .from(modelsTable)
      .innerJoin(categoriesTable, eq(categoriesTable.id, modelsTable.categoryId))
      .where(eq(categoriesTable.eventId, eventId as any));

    const modelsByUser = new Map<string, string[]>();
    for (const model of models as any[]) {
      const list = modelsByUser.get(model.userId) ?? [];
      const parts = [model.modelName];
      if (exportSettings.includeModelCode && model.modelCode) {
        parts.push(`(${model.modelCode})`);
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

    const [event] = await tenantDb
      .select({ id: eventsTable.id, name: eventsTable.name })
      .from(eventsTable)
      .where(eq(eventsTable.id, eventId as any))
      .limit(1);

    const users = await tenantDb
      .select({
        userId: registrationsTable.userId,
        email: usersTable.email,
        firstName: userProfilesTable.firstName,
        lastName: userProfilesTable.lastName
      })
      .from(registrationsTable)
      .innerJoin(usersTable, eq(usersTable.id, registrationsTable.userId))
      .leftJoin(userProfilesTable, eq(userProfilesTable.userId, registrationsTable.userId))
      .where(eq(registrationsTable.eventId, eventId as any));

    const models = await tenantDb
      .select({
        userId: modelsTable.userId,
        modelName: modelsTable.name,
        modelCode: modelsTable.code,
        categoryName: categoriesTable.name
      })
      .from(modelsTable)
      .innerJoin(categoriesTable, eq(categoriesTable.id, modelsTable.categoryId))
      .where(eq(categoriesTable.eventId, eventId as any));

    const modelsByUser = new Map<string, string[]>();
    for (const model of models as any[]) {
      const list = modelsByUser.get(model.userId) ?? [];
      list.push(`${model.modelName}${model.modelCode ? ` (${model.modelCode})` : ""} - ${model.categoryName}`);
      modelsByUser.set(model.userId, list);
    }

    const rows = (users as any[])
      .map((u) => {
        const participant = fullName(u.firstName, u.lastName, u.email);
        const modelList = modelsByUser.get(u.userId) ?? [];
        return `<tr><td>${participant}</td><td>${u.email}</td><td>${modelList.join("<br/>") || "-"}</td></tr>`;
      })
      .join("");

    set.headers["content-type"] = "text/html; charset=utf-8";
    set.headers["content-disposition"] = `inline; filename=\"users-by-event-${eventId}.html\"`;

    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset=\"utf-8\" />
    <title>Export utenti ${event?.name ?? eventId}</title>
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
    <p><strong>Evento:</strong> ${event?.name ?? eventId}</p>
    <table>
      <thead>
        <tr>
          <th>Partecipante</th>
          <th>Email</th>
          <th>Modelli</th>
        </tr>
      </thead>
      <tbody>
        ${rows || "<tr><td colspan=\"3\">Nessun dato</td></tr>"}
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
  .get("/labels/excel", async ({ tenantDb, query, set }) => {
    const eventId = query?.eventId ? String(query.eventId) : "";
    if (!eventId) {
      set.status = 400;
      return { error: "eventId is required" };
    }

    const exportSettings = await loadExportSettings(tenantDb);
    const rows = await getLabelRows(tenantDb, eventId);
    setXlsxHeaders(set, buildFileName(exportSettings, "labels", eventId));
    return toXlsx(buildSheetName(exportSettings, "Labels"), rows);
  }, {
    query: t.Object({ eventId: t.String() }),
    detail: {
      summary: "Export etichette Excel (XLSX)",
      tags: ["Exports"],
      security: [{ bearerAuth: [] }]
    }
  })
  .get("/labels/pdf", async ({ tenantDb, query, set }) => {
    const eventId = query?.eventId ? String(query.eventId) : "";
    if (!eventId) {
      set.status = 400;
      return { error: "eventId is required" };
    }

    const [event] = await tenantDb
      .select({ id: eventsTable.id, name: eventsTable.name })
      .from(eventsTable)
      .where(eq(eventsTable.id, eventId as any))
      .limit(1);

    const rows = await getLabelRows(tenantDb, eventId);
    const bodyRows = rows
      .map((row) => `<tr><td>${row.utente}</td><td>${row.categoria}</td><td>${row.nomeModello}</td><td>${row.codice}</td></tr>`)
      .join("");

    set.headers["content-type"] = "text/html; charset=utf-8";
    set.headers["content-disposition"] = `inline; filename=\"labels-${eventId}.html\"`;

    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset=\"utf-8\" />
    <title>Etichette ${event?.name ?? eventId}</title>
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
    <p><strong>Evento:</strong> ${event?.name ?? eventId}</p>
    <table>
      <thead>
        <tr>
          <th>Utente</th>
          <th>Categoria</th>
          <th>Nome modello</th>
          <th>Codice</th>
        </tr>
      </thead>
      <tbody>
        ${bodyRows || "<tr><td colspan=\"4\">Nessun dato</td></tr>"}
      </tbody>
    </table>
    <script>window.onload = () => window.print();</script>
  </body>
</html>`;
  }, {
    query: t.Object({ eventId: t.String() }),
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
        base.codice = row.modelCode ?? "";
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
  });

export const exportRoutes = new Elysia({ prefix: "/exports" })
  .use(tenantMiddleware)
  .use(managerExportRoutes)
  .use(userExportRoutes);
