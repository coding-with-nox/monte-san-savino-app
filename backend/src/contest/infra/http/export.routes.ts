import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";
import { requireRole } from "../../../identity/infra/http/role.middleware";
import { tenantMiddleware } from "../../../tenancy/infra/http/tenant.middleware";
import { categoriesTable, eventsTable, modelsTable, registrationsTable } from "../persistence/schema";
import { userProfilesTable, usersTable } from "../../../identity/infra/persistence/schema";

function toCsv(rows: Record<string, any>[]) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((key) => JSON.stringify(row[key] ?? "")).join(","));
  }
  return lines.join("\n");
}

function fullName(firstName?: string | null, lastName?: string | null, fallback?: string | null) {
  const name = [firstName, lastName].filter(Boolean).join(" ").trim();
  return name || fallback || "";
}

const managerExportRoutes = new Elysia()
  .use(requireRole("manager"))
  .get("/enrollments", async ({ tenantDb, query, set }) => {
    const eventId = query?.eventId ? String(query.eventId) : null;
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

    const csv = rows.map((row: any) => ({
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
    }));

    set.headers["content-type"] = "text/csv; charset=utf-8";
    set.headers["content-disposition"] = `attachment; filename=\"enrollments${eventId ? `-${eventId}` : ""}.csv\"`;
    return toCsv(csv);
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

    set.headers["content-type"] = "text/csv; charset=utf-8";
    set.headers["content-disposition"] = "attachment; filename=\"models.csv\"";
    return toCsv(rows);
  }, {
    detail: {
      summary: "Export modelli CSV",
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

    const rows = (users as any[]).map((u) => ({
      userId: u.userId,
      email: u.email,
      participant: fullName(u.firstName, u.lastName, u.email),
      models: (modelsByUser.get(u.userId) ?? []).join(" | ")
    }));

    set.headers["content-type"] = "text/csv; charset=utf-8";
    set.headers["content-disposition"] = `attachment; filename=\"users-by-event-${eventId}.csv\"`;
    return toCsv(rows);
  }, {
    query: t.Object({ eventId: t.String() }),
    detail: {
      summary: "Export utenti per evento (Excel-friendly CSV)",
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
  });

const userExportRoutes = new Elysia()
  .use(requireRole("user"))
  .get("/my-enrollments", async ({ tenantDb, user, set }) => {
    const rows = await tenantDb
      .select({
        enrollmentId: registrationsTable.id,
        eventName: eventsTable.name,
        modelName: modelsTable.name,
        modelCode: modelsTable.code,
        categoryName: categoriesTable.name,
        checkedIn: registrationsTable.checkedIn
      })
      .from(registrationsTable)
      .leftJoin(eventsTable, eq(eventsTable.id, registrationsTable.eventId))
      .leftJoin(modelsTable, eq(modelsTable.id, registrationsTable.modelId))
      .leftJoin(categoriesTable, eq(categoriesTable.id, registrationsTable.categoryId))
      .where(eq(registrationsTable.userId, user!.id as any));

    const csv = (rows as any[]).map((row) => ({
      enrollmentId: row.enrollmentId,
      eventName: row.eventName ?? "",
      modelName: row.modelName ?? "",
      modelCode: row.modelCode ?? "",
      categoryName: row.categoryName ?? "",
      checkedIn: row.checkedIn ? "true" : "false"
    }));

    set.headers["content-type"] = "text/csv; charset=utf-8";
    set.headers["content-disposition"] = "attachment; filename=\"my-enrollments.csv\"";
    return toCsv(csv);
  }, {
    detail: {
      summary: "Export mie iscrizioni CSV",
      tags: ["Exports"],
      security: [{ bearerAuth: [] }]
    }
  });

export const exportRoutes = new Elysia({ prefix: "/exports" })
  .use(tenantMiddleware)
  .use(managerExportRoutes)
  .use(userExportRoutes);
