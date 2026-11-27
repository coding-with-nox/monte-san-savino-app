/**
 * Level lock and level-up rules. Pure rules, no I/O.
 *
 * Level lock (setting `lockLevelToFirstSelection` = "true"): within one event, a participant's models
 * must all sit at the same level, except "All" which is always allowed. The first non-"All" level
 * selected in the event locks the others.
 *
 * Level-up (previous results, Standard level): a participant is a candidate when a previous result
 * at the Standard level has medal_rank >= LEVEL_UP_MIN_MEDAL_RANK (Gold). Matching is by email when both
 * sides have one, else by first + last name (case-insensitive).
 */

export const LEVEL_LOCK_KEY = "lockLevelToFirstSelection";
export const LEVEL_UP_WARNING_KEY = "levelUpWarning";
export const LEVEL_UP_MIN_MEDAL_RANK = 4;

const ALL_LEVEL = "all";
const STANDARD_LEVEL = "standard";

const clean = (value: string | null | undefined) => (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();

export const isAllLevelName = (name: string | null | undefined) => clean(name) === ALL_LEVEL;
export const isStandardLevelName = (name: string | null | undefined) => clean(name) === STANDARD_LEVEL;

export function parseBooleanSetting(raw: string | null | undefined): boolean {
  return raw === "true";
}

/** PUT /admin/settings validation: error message for an invalid value, else null. */
export function levelUpSettingError(entries: [string, string][]): string | null {
  for (const [key, value] of entries) {
    if ((key === LEVEL_LOCK_KEY || key === LEVEL_UP_WARNING_KEY) && value !== "true" && value !== "false") {
      return `${key} must be "true" or "false"`;
    }
  }
  return null;
}

export type LevelLock = { lockedLevelId: string; lockedLevelName: string };

/**
 * The level the participant is locked to, or null when the request is allowed.
 * `ownModels`: the owner's other models in the same event (the edited model excluded).
 * Requesting "All" is never blocked; a model whose level is "All" never locks anything.
 */
export function findLevelLock(input: {
  requestedLevelId: string;
  requestedLevelName: string | null;
  ownModels: { levelId: string | null; levelName: string | null }[];
}): LevelLock | null {
  if (isAllLevelName(input.requestedLevelName)) return null;
  for (const model of input.ownModels) {
    if (!model.levelId || !model.levelName) continue;
    if (model.levelId === input.requestedLevelId || isAllLevelName(model.levelName)) continue;
    return { lockedLevelId: model.levelId, lockedLevelName: model.levelName };
  }
  return null;
}

export type PersonIdentity = { email?: string | null; firstName?: string | null; lastName?: string | null };

/** Email decides when both sides have one; otherwise first + last name must both match. */
export function isSamePerson(person: PersonIdentity, previous: PersonIdentity): boolean {
  const personEmail = clean(person.email);
  const previousEmail = clean(previous.email);
  if (personEmail && previousEmail) return personEmail === previousEmail;
  const pFirst = clean(person.firstName);
  const pLast = clean(person.lastName);
  const rFirst = clean(previous.firstName);
  const rLast = clean(previous.lastName);
  return Boolean(pFirst && pLast && rFirst && rLast) && pFirst === rFirst && pLast === rLast;
}

export type PreviousResult = PersonIdentity & { levelName: string; medalRank: number };

/** A previous result that qualifies for level-up: Standard level, Gold or better. */
export function isStandardGold(result: { levelName: string; medalRank: number }): boolean {
  return isStandardLevelName(result.levelName) && result.medalRank >= LEVEL_UP_MIN_MEDAL_RANK;
}

/** True when the person matches at least one previous Standard gold. */
export function matchesStandardGold(person: PersonIdentity, previousResults: PreviousResult[]): boolean {
  return previousResults.some((result) => isStandardGold(result) && isSamePerson(person, result));
}
