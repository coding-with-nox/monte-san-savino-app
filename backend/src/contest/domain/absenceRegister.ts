/**
 * Absence register (desk check-in by participant number). Pure rules, no I/O.
 *
 * Presence of a participant in an event = at least one registration of the event with checked_in = true.
 * When the register is enabled (setting `absenceRegisterEnabled` = "true"):
 *  - judges see and vote only models whose owner is present in that event;
 *  - expected voters and completion ignore models whose owner is absent (as for missing models).
 * Disabled: no effect at all.
 */

export const ABSENCE_REGISTER_KEY = "absenceRegisterEnabled";

export function parseAbsenceRegisterEnabled(raw: string | null | undefined): boolean {
  return raw === "true";
}

/** PUT /admin/settings validation: error message for an invalid value, else null. */
export function absenceRegisterSettingError(entries: [string, string][]): string | null {
  for (const [key, value] of entries) {
    if (key === ABSENCE_REGISTER_KEY && value !== "true" && value !== "false") {
      return `${ABSENCE_REGISTER_KEY} must be "true" or "false"`;
    }
  }
  return null;
}

/** Presence by event: eventId -> ids of the present participants. null = the register is disabled (no filtering). */
export type PresenceByEvent = ReadonlyMap<string, ReadonlySet<string>> | null;

export function isOwnerPresent(presence: PresenceByEvent, eventId: string, ownerId: string): boolean {
  if (presence === null) return true;
  return presence.get(eventId)?.has(ownerId) ?? false;
}

/** Drops the models whose owner is absent. `presentOwnerIds` null = register disabled: models kept as they are. */
export function excludeAbsentOwners<T extends { ownerId: string }>(models: T[], presentOwnerIds: ReadonlySet<string> | null): T[] {
  if (presentOwnerIds === null) return models;
  return models.filter((m) => presentOwnerIds.has(m.ownerId));
}
