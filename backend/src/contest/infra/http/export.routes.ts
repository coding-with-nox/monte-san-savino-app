import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";
import { requireRole } from "../../../identity/infra/http/role.middleware";
import { tenantMiddleware } from "../../../tenancy/infra/http/tenant.middleware";
import { categoriesTable, eventsTable, modelsTable, registrationsTable, settingsTable } from "../persistence/schema";
import { userProfilesTable, usersTable } from "../../../identity/infra/persistence/schema";

type ExportSettings = {
  includeModelCode: boolean;
  includeModelDescription: boolean;
};

function boolFromSetting(value: string | undefined, fallback: boolean) {
  if (value === undefined) return fallback;
  return value.toLowerCase() === "true";
}

async function loadExportSettings(tenantDb: any): Promise<ExportSettings> {
  const rows = await tenantDb.select().from(settingsTable);
  const map = new Map<string, string>();
  for (const row of rows as Array<{ key: string; value: string }>) {
    map.set(row.key, row.value);
  }
  return {
    includeModelCode: boolFromSetting(map.get("exportIncludeModelCode"), true),
    includeModelDescription: boolFromSetting(map.get("exportIncludeModelDescription"), true)
  };
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

function toExcelXml(sheetName: string, rows: Record<string, any>[]) {
  const safeSheetName = sanitizeSheetName(sheetName);
  const headers = rows.length > 0 ? Object.keys(rows[0]) : ["info"];
  const normalizedRows = rows.length > 0 ? rows : [{ info: "Nessun dato" }];

  const headerRow = `<Row>${headers
    .map((header) => `<Cell ss:StyleID=\"Header\"><Data ss:Type=\"String\">${xmlEscape(header)}</Data></Cell>`)
    .join("")}</Row>`;

  const dataRows = normalizedRows
    .map((row) => `<Row>${headers
      .map((header) => `<Cell><Data ss:Type=\"String\">${xmlEscape(String(row[header] ?? ""))}</Data></Cell>`)
      .join("")}</Row>`)
    .join("");

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
  <Styles>
    <Style ss:ID="Header">
      <Font ss:Bold="1" />
      <Interior ss:Color="#EDEDED" ss:Pattern="Solid" />
    </Style>
  </Styles>
  <Worksheet ss:Name="${xmlEscape(safeSheetName)}">
    <Table>
      ${headerRow}
      ${dataRows}
    </Table>
  </Worksheet>
</Workbook>`;
}

function setExcelHeaders(set: any, filename: string) {
  set.headers["content-type"] = "application/vnd.ms-excel; charset=utf-8";
  set.headers["content-disposition"] = `attachment; filename=\"${filename}.xls\"`;
}

function fullName(firstName?: string | null, lastName?: string | null, fallback?: string | null) {
  const name = [firstName, lastName].filter(Boolean).join(" ").trim();
  return name || fallback || "";
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
        eventId: registrationsTable.eventId,
        eventName: eventsTable.name,
        userId: registrationsTable.userId,
        email: usersTable.email,
        participant: userProfilesTable.firstName,
        participantLastName: userProfilesTable.lastName,
        modelId: registrationsTable.modelId,
        modelName: modelsTable.name,
        modelCode: modelsTable.code,
        modelDescription: modelsTable.description,
        categoryId: registrationsTable.categoryId,
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
        eventId: row.eventId,
        eventName: row.eventName ?? "",
        userId: row.userId,
        email: row.email ?? "",
        participant: fullName(row.participant, row.participantLastName, row.email ?? row.userId),
        modelId: row.modelId ?? "",
        modelName: row.modelName ?? "",
        categoryId: row.categoryId ?? "",
        categoryName: row.categoryName ?? "",
        checkedIn: row.checkedIn ? "true" : "false"
      };

      if (exportSettings.includeModelCode) {
        base.modelCode = row.modelCode ?? "";
      }
      if (exportSettings.includeModelDescription) {
        base.modelDescription = row.modelDescription ?? "";
      }
      return base;
    });

    setExcelHeaders(set, `enrollments${eventId ? `-${eventId}` : ""}`);
    return toExcelXml("Enrollments", excelRows);
  }, {
    detail: {
      summary: "Export iscrizioni Excel",
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
        teamId: row.teamId ?? "",
        categoryId: row.categoryId,
        name: row.name,
        imageUrl: row.imageUrl ?? ""
      };

      if (exportSettings.includeModelCode) {
        base.code = row.code ?? "";
      }
      if (exportSettings.includeModelDescription) {
        base.description = row.description ?? "";
      }
      return base;
    });

    setExcelHeaders(set, "models");
    return toExcelXml("Models", excelRows);
  }, {
    detail: {
      summary: "Export modelli Excel",
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

    const rows = (users as any[]).map((u) => ({
      userId: u.userId,
      email: u.email,
      participant: fullName(u.firstName, u.lastName, u.email),
      models: (modelsByUser.get(u.userId) ?? []).join(" | ")
    }));

    setExcelHeaders(set, `users-by-event-${eventId}`);
    return toExcelXml("Users", rows);
  }, {
    query: t.Object({ eventId: t.String() }),
    detail: {
      summary: "Export utenti per evento Excel",
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

    const rows = await getLabelRows(tenantDb, eventId);
    setExcelHeaders(set, `labels-${eventId}`);
    return toExcelXml("Labels", rows);
  }, {
    query: t.Object({ eventId: t.String() }),
    detail: {
      summary: "Export etichette Excel",
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
    <meta charset="utf-8" />
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
        modelName: row.modelName ?? "",
        categoryName: row.categoryName ?? "",
        checkedIn: row.checkedIn ? "true" : "false"
      };

      if (exportSettings.includeModelCode) {
        base.modelCode = row.modelCode ?? "";
      }
      if (exportSettings.includeModelDescription) {
        base.modelDescription = row.modelDescription ?? "";
      }

      return base;
    });

    setExcelHeaders(set, "my-enrollments");
    return toExcelXml("MyEnrollments", excelRows);
  }, {
    detail: {
      summary: "Export mie iscrizioni Excel",
      tags: ["Exports"],
      security: [{ bearerAuth: [] }]
    }
  });

export const exportRoutes = new Elysia({ prefix: "/exports" })
  .use(tenantMiddleware)
  .use(managerExportRoutes)
  .use(userExportRoutes);
