/**
 * Participant-number range of the desk prints (participant number = users.seq_id). Pure, no I/O.
 * from/to are inclusive; a missing bound means no bound.
 */
export type ParticipantRange = { from?: number; to?: number };
export type ParticipantRangeResult = { ok: true; range: ParticipantRange } | { ok: false; error: string };

const INTEGER_RE = /^\d+$/;

/** Query `from`/`to`: optional non-negative integers. Empty strings count as missing. 422 when invalid or from > to. */
export function parseParticipantRange(query: { from?: unknown; to?: unknown } | undefined): ParticipantRangeResult {
  const range: ParticipantRange = {};
  for (const key of ["from", "to"] as const) {
    const raw = query?.[key];
    if (raw === undefined || raw === null || String(raw).trim() === "") continue;
    const value = String(raw).trim();
    if (!INTEGER_RE.test(value)) return { ok: false, error: `${key} must be a non-negative integer` };
    range[key] = Number(value);
  }
  if (range.from !== undefined && range.to !== undefined && range.from > range.to) {
    return { ok: false, error: "from must be less than or equal to to" };
  }
  return { ok: true, range };
}

export function inParticipantRange(participantNumber: number, range: ParticipantRange): boolean {
  return (range.from === undefined || participantNumber >= range.from)
    && (range.to === undefined || participantNumber <= range.to);
}
