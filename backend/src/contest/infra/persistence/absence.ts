import { and, eq, inArray } from "drizzle-orm";
import { registrationsTable, settingsTable } from "./schema";
import { ABSENCE_REGISTER_KEY, parseAbsenceRegisterEnabled, type PresenceByEvent } from "../../domain/absenceRegister";

export async function loadAbsenceRegisterEnabled(db: any): Promise<boolean> {
  const [row] = await db
    .select({ value: settingsTable.value })
    .from(settingsTable)
    .where(eq(settingsTable.key, ABSENCE_REGISTER_KEY as any))
    .limit(1);
  return parseAbsenceRegisterEnabled(row?.value);
}

/** Participants present (at least one checked-in registration) in each of the given events. */
export async function loadPresenceByEvent(db: any, eventIds: string[]): Promise<Map<string, Set<string>>> {
  const presence = new Map<string, Set<string>>();
  if (!eventIds.length) return presence;
  const rows = await db
    .selectDistinct({ eventId: registrationsTable.eventId, userId: registrationsTable.userId })
    .from(registrationsTable)
    .where(and(inArray(registrationsTable.eventId, eventIds as any), eq(registrationsTable.checkedIn, true)));
  for (const r of rows as { eventId: string; userId: string }[]) {
    const set = presence.get(r.eventId) ?? new Set<string>();
    set.add(r.userId);
    presence.set(r.eventId, set);
  }
  return presence;
}

/** Presence for the absence rules: null when the register is disabled (nothing is filtered). */
export async function loadPresenceFilter(db: any, eventIds: string[]): Promise<PresenceByEvent> {
  if (!(await loadAbsenceRegisterEnabled(db))) return null;
  return await loadPresenceByEvent(db, eventIds);
}
