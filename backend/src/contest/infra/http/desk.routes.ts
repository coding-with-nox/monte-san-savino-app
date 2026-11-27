import { Elysia, t } from "elysia";
import { and, eq, sql } from "drizzle-orm";
import { requireRole } from "../../../identity/infra/http/role.middleware";
import { tenantMiddleware } from "../../../tenancy/infra/http/tenant.middleware";
import { categoriesTable, modelsTable, registrationsTable } from "../persistence/schema";
import { userProfilesTable, usersTable } from "../../../identity/infra/persistence/schema";
import { formatModelCode, loadModelCodeFormatSettings } from "./model-code";
import { displayName, isUuid } from "./class-print.routes";

/** Desk attendance (staff): lookup and presence by participant number (users.seq_id). */

const PARTICIPANT_NUMBER_RE = /^\d+$/;

/** A participant is present in an event when at least one of his registrations is checked in. */
export const staffDeskRoutes = new Elysia({ prefix: "/staff" })
  .use(tenantMiddleware)
  .use(requireRole("staff"))
  .get("/events/:eventId/participants/:number", async ({ tenantDb, params, set }) => {
    if (!isUuid(params.eventId) || !PARTICIPANT_NUMBER_RE.test(params.number)) {
      set.status = 422;
      return { error: "eventId must be a valid uuid and number a participant number" };
    }
    const participantNumber = Number(params.number);
    const [person] = await tenantDb
      .select({
        userId: usersTable.id,
        email: usersTable.email,
        firstName: userProfilesTable.firstName,
        lastName: userProfilesTable.lastName,
        country: userProfilesTable.country
      })
      .from(usersTable)
      .leftJoin(userProfilesTable, eq(userProfilesTable.userId, usersTable.id))
      .where(eq(usersTable.seqId, participantNumber))
      .limit(1);
    if (!person) {
      set.status = 404;
      return { error: "Participant not found" };
    }

    const rows = await tenantDb
      .select({
        checkedIn: registrationsTable.checkedIn,
        modelId: modelsTable.id,
        modelName: modelsTable.name,
        code: modelsTable.code,
        teamCode: modelsTable.teamCode,
        displayNumber: modelsTable.displayNumber,
        categorySeqId: categoriesTable.seqId,
        categoryName: categoriesTable.name
      })
      .from(registrationsTable)
      .leftJoin(modelsTable, eq(modelsTable.id, registrationsTable.modelId))
      .leftJoin(categoriesTable, eq(categoriesTable.id, modelsTable.categoryId))
      .where(and(eq(registrationsTable.userId, person.userId as any), eq(registrationsTable.eventId, params.eventId as any)));
    if (!rows.length) {
      set.status = 404;
      return { error: "Participant not registered in this event" };
    }

    const codeFormat = await loadModelCodeFormatSettings(tenantDb);
    const models = [...new Map(
      rows.filter((r: any) => r.modelId).map((r: any) => [r.modelId as string, {
        id: r.modelId as string,
        name: r.modelName ?? "",
        code: formatModelCode(r.code, r.categorySeqId, r.displayNumber, codeFormat, r.teamCode),
        categoryName: r.categoryName ?? "",
        displayNumber: (r.displayNumber ?? null) as number | null
      }])
    ).values()];

    return {
      userId: person.userId,
      participantNumber,
      name: displayName(person.firstName, person.lastName, person.email),
      country: person.country ?? "",
      present: rows.some((r: any) => r.checkedIn === true),
      models
    };
  }, {
    params: t.Object({ eventId: t.String(), number: t.String() }),
    detail: {
      summary: "Partecipante per numero: iscrizioni e presenza (desk)",
      tags: ["Staff"],
      security: [{ bearerAuth: [] }]
    }
  })
  .post("/events/:eventId/participants/:number/presence", async ({ tenantDb, params, body, set }) => {
    if (!isUuid(params.eventId) || !PARTICIPANT_NUMBER_RE.test(params.number)) {
      set.status = 422;
      return { error: "eventId must be a valid uuid and number a participant number" };
    }
    const participantNumber = Number(params.number);
    const [person] = await tenantDb
      .select({ userId: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.seqId, participantNumber))
      .limit(1);
    if (!person) {
      set.status = 404;
      return { error: "Participant not found" };
    }
    // Presence sets check-in on every registration of the participant in the event; absent is its complement.
    const updated = await tenantDb
      .update(registrationsTable)
      .set({ checkedIn: body.present, absent: !body.present })
      .where(and(eq(registrationsTable.userId, person.userId as any), eq(registrationsTable.eventId, params.eventId as any)))
      .returning({ id: registrationsTable.id });
    if (!updated.length) {
      set.status = 404;
      return { error: "Participant not registered in this event" };
    }
    return { userId: person.userId, participantNumber, present: body.present, updated: updated.length };
  }, {
    params: t.Object({ eventId: t.String(), number: t.String() }),
    body: t.Object({ present: t.Boolean() }),
    detail: {
      summary: "Imposta presenza del partecipante nell'evento (desk)",
      tags: ["Staff"],
      security: [{ bearerAuth: [] }]
    }
  })
  .get("/events/:eventId/attendance", async ({ tenantDb, params, set }) => {
    if (!isUuid(params.eventId)) {
      set.status = 422;
      return { error: "eventId must be a valid uuid" };
    }
    const [row] = await tenantDb
      .select({
        registeredParticipants: sql<number>`count(distinct ${registrationsTable.userId})::int`,
        presentParticipants: sql<number>`count(distinct ${registrationsTable.userId}) filter (where ${registrationsTable.checkedIn})::int`
      })
      .from(registrationsTable)
      .where(eq(registrationsTable.eventId, params.eventId as any));
    return {
      registeredParticipants: Number(row?.registeredParticipants ?? 0),
      presentParticipants: Number(row?.presentParticipants ?? 0)
    };
  }, {
    params: t.Object({ eventId: t.String() }),
    detail: {
      summary: "Presenze dell'evento: partecipanti iscritti e presenti (desk)",
      tags: ["Staff"],
      security: [{ bearerAuth: [] }]
    }
  });
