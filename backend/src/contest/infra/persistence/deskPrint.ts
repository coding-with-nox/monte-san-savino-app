import { and, asc, eq, gte, lte } from "drizzle-orm";
import { categoriesTable, modelsTable, registrationsTable } from "./schema";
import { userProfilesTable, usersTable } from "../../../identity/infra/persistence/schema";
import type { ParticipantRange } from "../../domain/participantRange";
import { exportMaxRows } from "../http/exportLimits";

/** Participant-number bounds (users.seq_id, inclusive). An open bound adds no condition. */
export function participantRangeConditions(range: ParticipantRange): any[] {
  const conds: any[] = [];
  if (range.from !== undefined) conds.push(gte(usersTable.seqId, range.from));
  if (range.to !== undefined) conds.push(lte(usersTable.seqId, range.to));
  return conds;
}

export type DeskParticipant = {
  userId: string;
  participantNumber: number;
  email: string | null;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  country: string | null;
};

/** Participants of the event (users with a registration in it), by participant number. */
export async function loadDeskParticipants(tenantDb: any, eventId: string, range: ParticipantRange): Promise<DeskParticipant[]> {
  return await tenantDb
    .selectDistinct({
      userId: registrationsTable.userId,
      participantNumber: usersTable.seqId,
      email: usersTable.email,
      username: usersTable.username,
      firstName: userProfilesTable.firstName,
      lastName: userProfilesTable.lastName,
      country: userProfilesTable.country
    })
    .from(registrationsTable)
    .innerJoin(usersTable, eq(usersTable.id, registrationsTable.userId))
    .leftJoin(userProfilesTable, eq(userProfilesTable.userId, registrationsTable.userId))
    .where(and(eq(registrationsTable.eventId, eventId as any), ...participantRangeConditions(range)))
    .orderBy(asc(usersTable.seqId));
}

export type DeskModelRow = {
  userId: string;
  participantNumber: number;
  modelId: string;
  name: string;
  code: number | null;
  teamCode: string | null;
  displayNumber: number | null;
  categoryName: string;
  categorySeqId: number;
};

/** Models of the event owned by participants in the range, by participant number (limit: EXPORT_MAX_ROWS + 1). */
export async function loadDeskModels(tenantDb: any, eventId: string, range: ParticipantRange): Promise<DeskModelRow[]> {
  return await tenantDb
    .select({
      userId: modelsTable.userId,
      participantNumber: usersTable.seqId,
      modelId: modelsTable.id,
      name: modelsTable.name,
      code: modelsTable.code,
      teamCode: modelsTable.teamCode,
      displayNumber: modelsTable.displayNumber,
      categoryName: categoriesTable.name,
      categorySeqId: categoriesTable.seqId
    })
    .from(modelsTable)
    .innerJoin(categoriesTable, eq(categoriesTable.id, modelsTable.categoryId))
    .innerJoin(usersTable, eq(usersTable.id, modelsTable.userId))
    .where(and(eq(categoriesTable.eventId, eventId as any), ...participantRangeConditions(range)))
    .orderBy(asc(usersTable.seqId), asc(modelsTable.displayNumber), asc(modelsTable.code))
    .limit(exportMaxRows() + 1);
}

/** Participant number (seq_id) of the owner of each display of the event. */
export async function loadParticipantNumberByDisplay(tenantDb: any, eventId: string): Promise<Map<number, number>> {
  const rows = await tenantDb
    .selectDistinct({ displayNumber: modelsTable.displayNumber, participantNumber: usersTable.seqId })
    .from(modelsTable)
    .innerJoin(categoriesTable, eq(categoriesTable.id, modelsTable.categoryId))
    .innerJoin(usersTable, eq(usersTable.id, modelsTable.userId))
    .where(eq(categoriesTable.eventId, eventId as any));
  const map = new Map<number, number>();
  for (const r of rows as { displayNumber: number | null; participantNumber: number | null }[]) {
    if (r.displayNumber !== null && r.participantNumber !== null) map.set(r.displayNumber, r.participantNumber);
  }
  return map;
}
