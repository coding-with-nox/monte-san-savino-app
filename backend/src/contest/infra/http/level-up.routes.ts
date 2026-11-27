import { Elysia, t } from "elysia";
import { and, eq, inArray, sql } from "drizzle-orm";
import { requireRole } from "../../../identity/infra/http/role.middleware";
import { tenantMiddleware } from "../../../tenancy/infra/http/tenant.middleware";
import { usersTable, userProfilesTable } from "../../../identity/infra/persistence/schema";
import { categoriesTable, eventsTable, levelsTable, modelsTable, previousResultsTable } from "../persistence/schema";
import { loadSettingValue } from "../persistence/registrationSettings";
import { loadModelCodeFormatSettings, formatModelCode } from "./model-code";
import { formatParticipantNumber } from "./desk-print";
import { parsePrintLang, pt } from "../../../shared/domain/printI18n";
import { isUuid } from "../../../shared/domain/imageUpload";
import {
  LEVEL_UP_WARNING_KEY, matchesStandardGold, parseBooleanSetting, type PreviousResult
} from "../../domain/levelUp";
import { setXlsxHeaders, toXlsx } from "./export.routes";

/** Level-up report and warning: previous Standard golds vs. the participants' Standard models. */

export type LevelUpModel = { name: string; code: string; categoryName: string };
export type LevelUpParticipant = {
  participantNumber: number;
  name: string;
  email: string | null;
  models: LevelUpModel[];
};

function fullName(firstName?: string | null, lastName?: string | null, fallback?: string | null) {
  return [firstName, lastName].filter(Boolean).join(" ").trim() || fallback || "";
}

async function loadPreviousResults(tenantDb: any): Promise<PreviousResult[]> {
  return await tenantDb
    .select({
      email: previousResultsTable.email,
      firstName: previousResultsTable.firstName,
      lastName: previousResultsTable.lastName,
      levelName: previousResultsTable.levelName,
      medalRank: previousResultsTable.medalRank
    })
    .from(previousResultsTable);
}

/** Participants with at least one Standard model in the event who match a previous Standard gold. */
export async function loadLevelUpParticipants(tenantDb: any, eventId: string): Promise<LevelUpParticipant[]> {
  const standardModels = await tenantDb
    .select({
      userId: modelsTable.userId,
      name: modelsTable.name,
      code: modelsTable.code,
      displayNumber: modelsTable.displayNumber,
      teamCode: modelsTable.teamCode,
      categorySeqId: categoriesTable.seqId,
      categoryName: categoriesTable.name
    })
    .from(modelsTable)
    .innerJoin(categoriesTable, eq(categoriesTable.id, modelsTable.categoryId))
    .innerJoin(levelsTable, eq(levelsTable.id, modelsTable.levelId))
    .where(and(eq(categoriesTable.eventId, eventId as any), sql`lower(btrim(${levelsTable.name})) = 'standard'`));
  if (!standardModels.length) return [];

  const userIds = [...new Set((standardModels as any[]).map((m) => m.userId as string))];
  const users = await tenantDb
    .select({
      id: usersTable.id,
      email: usersTable.email,
      seqId: usersTable.seqId,
      firstName: userProfilesTable.firstName,
      lastName: userProfilesTable.lastName
    })
    .from(usersTable)
    .leftJoin(userProfilesTable, eq(userProfilesTable.userId, usersTable.id))
    .where(inArray(usersTable.id, userIds as any[]));

  const golds = await loadPreviousResults(tenantDb);
  const codeFormat = await loadModelCodeFormatSettings(tenantDb);
  const participants: LevelUpParticipant[] = [];
  for (const user of users as any[]) {
    if (!matchesStandardGold(user, golds)) continue;
    const models = (standardModels as any[])
      .filter((m) => m.userId === user.id)
      .map((m) => ({
        name: m.name as string,
        code: formatModelCode(m.code, m.categorySeqId, m.displayNumber, codeFormat, m.teamCode),
        categoryName: m.categoryName as string
      }));
    participants.push({
      participantNumber: Number(user.seqId),
      name: fullName(user.firstName, user.lastName, user.email),
      email: user.email ?? null,
      models
    });
  }
  return participants.sort((a, b) => a.participantNumber - b.participantNumber);
}

async function eventExists(tenantDb: any, eventId: string): Promise<boolean> {
  const [event] = await tenantDb.select({ id: eventsTable.id }).from(eventsTable).where(eq(eventsTable.id, eventId as any)).limit(1);
  return Boolean(event);
}

const eventQuerySchema = t.Object({ eventId: t.String() });
const langQuerySchema = t.Object({ eventId: t.String(), lang: t.Optional(t.String()) });

export const adminLevelUpRoutes = new Elysia({ prefix: "/admin/reports" })
  .use(tenantMiddleware)
  .use(requireRole("manager"))
  .get("/level-up", async ({ tenantDb, query, set }) => {
    const eventId = String(query.eventId);
    if (!isUuid(eventId)) {
      set.status = 422;
      return { error: "eventId must be a valid uuid" };
    }
    if (!(await eventExists(tenantDb, eventId))) {
      set.status = 404;
      return { error: "Event not found" };
    }
    return await loadLevelUpParticipants(tenantDb, eventId);
  }, {
    query: eventQuerySchema,
    detail: {
      summary: "Report level-up: partecipanti Standard con precedente Standard Gold (query eventId)",
      tags: ["Admin"],
      security: [{ bearerAuth: [] }]
    }
  })
  .get("/level-up/excel", async ({ tenantDb, query, set }) => {
    const eventId = String(query.eventId);
    const lang = parsePrintLang(query.lang);
    if (!isUuid(eventId)) {
      set.status = 422;
      return { error: "eventId must be a valid uuid" };
    }
    if (!(await eventExists(tenantDb, eventId))) {
      set.status = 404;
      return { error: "Event not found" };
    }
    const participants = await loadLevelUpParticipants(tenantDb, eventId);
    const rows = participants.flatMap((p) => p.models.map((m) => ({
      [pt(lang, "col.participantNumber")]: formatParticipantNumber(p.participantNumber),
      [pt(lang, "col.exhibitor")]: p.name,
      [pt(lang, "col.email")]: p.email ?? "",
      [pt(lang, "label.class")]: m.categoryName,
      [pt(lang, "col.model")]: m.name,
      [pt(lang, "col.code")]: m.code
    })));
    setXlsxHeaders(set, `level-up-${eventId}`);
    return toXlsx("Level-up", rows, lang);
  }, {
    query: langQuerySchema,
    detail: {
      summary: "Report level-up Excel (XLSX)",
      tags: ["Admin"],
      security: [{ bearerAuth: [] }]
    }
  });

export const userLevelUpRoutes = new Elysia({ prefix: "/users" })
  .use(tenantMiddleware)
  .use(requireRole("user"))
  .get("/me/level-up", async ({ tenantDb, user, query, set }) => {
    const eventId = String(query.eventId);
    if (!isUuid(eventId)) {
      set.status = 422;
      return { error: "eventId must be a valid uuid" };
    }
    if (!(await eventExists(tenantDb, eventId))) {
      set.status = 404;
      return { error: "Event not found" };
    }
    if (!parseBooleanSetting(await loadSettingValue(tenantDb, LEVEL_UP_WARNING_KEY))) return { warn: false };
    const [me] = await tenantDb
      .select({
        email: usersTable.email,
        firstName: userProfilesTable.firstName,
        lastName: userProfilesTable.lastName
      })
      .from(usersTable)
      .leftJoin(userProfilesTable, eq(userProfilesTable.userId, usersTable.id))
      .where(eq(usersTable.id, user!.id as any))
      .limit(1);
    if (!me) return { warn: false };
    return { warn: matchesStandardGold(me, await loadPreviousResults(tenantDb)) };
  }, {
    query: eventQuerySchema,
    detail: {
      summary: "Avviso level-up per l'utente corrente (query eventId)",
      tags: ["Users"],
      security: [{ bearerAuth: [] }]
    }
  });
