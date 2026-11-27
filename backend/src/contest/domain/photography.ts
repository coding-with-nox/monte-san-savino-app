/** Photography list: awarded models at or above a medal rank, in ceremony order. Pure, no I/O. */
import { compareCeremonyClasses, type CeremonyClass } from "./ceremony";

export const MIN_PHOTO_MEDAL_RANK_KEY = "minPhotoMedalRank";
/** 4 = Gold (MSS bracket preset). */
export const DEFAULT_MIN_PHOTO_MEDAL_RANK = 4;
export const MAX_MEDAL_RANK = 10;

export function parseMinPhotoMedalRank(raw: string | null | undefined): number {
  if (raw === undefined || raw === null || !/^\d+$/.test(raw.trim())) return DEFAULT_MIN_PHOTO_MEDAL_RANK;
  const n = Number(raw.trim());
  return n <= MAX_MEDAL_RANK ? n : DEFAULT_MIN_PHOTO_MEDAL_RANK;
}

/** PUT /admin/settings validation: error message for an invalid value, else null. */
export function photographySettingError(entries: [string, string][]): string | null {
  for (const [key, value] of entries) {
    if (key !== MIN_PHOTO_MEDAL_RANK_KEY) continue;
    if (!/^\d+$/.test(value) || Number(value) > MAX_MEDAL_RANK) {
      return `${MIN_PHOTO_MEDAL_RANK_KEY} must be an integer between 0 and ${MAX_MEDAL_RANK}`;
    }
  }
  return null;
}

export type PhotographyRow = {
  className: string;
  classNumber: string | null;
  displayNumber: number | null;
  participantNumber: number | null;
  exhibitor: string;
  modelName: string | null;
  modelCode: string | null;
  wholeDisplay: boolean;
  medalLabel: string;
  medalRank: number;
};

/**
 * Prizes with medalRank >= minRank (and above None), class by class in ceremony order, then display number.
 * Classes are sorted by presentation order (compareCeremonyClasses) whatever the input order.
 * `participantByDisplay`: display number -> participant number (seq_id) of the display's owner.
 */
export function buildPhotographyRows(
  classes: CeremonyClass[],
  participantByDisplay: ReadonlyMap<number, number>,
  minRank: number
): PhotographyRow[] {
  const rows: PhotographyRow[] = [];
  for (const c of [...classes].sort(compareCeremonyClasses)) {
    const prizes = c.prizes
      .filter((p) => p.medalRank > 0 && p.medalRank >= minRank)
      .sort((a, b) => (a.displayNumber ?? Number.MAX_SAFE_INTEGER) - (b.displayNumber ?? Number.MAX_SAFE_INTEGER)
        || (a.modelName ?? "").localeCompare(b.modelName ?? ""));
    for (const p of prizes) {
      rows.push({
        className: c.name,
        classNumber: c.classNumber,
        displayNumber: p.displayNumber,
        participantNumber: p.displayNumber === null ? null : (participantByDisplay.get(p.displayNumber) ?? null),
        exhibitor: p.exhibitor,
        modelName: p.wholeDisplay ? null : p.modelName,
        modelCode: p.wholeDisplay ? null : p.modelCode,
        wholeDisplay: p.wholeDisplay,
        medalLabel: p.medalLabel,
        medalRank: p.medalRank
      });
    }
  }
  return rows;
}
