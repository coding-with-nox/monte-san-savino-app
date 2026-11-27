/**
 * Judge sessions last a fixed number of hours from login (no sliding window): a refresh token
 * of a judge expires at the earliest of its normal expiry and `sst + JUDGE_SESSION_HOURS`.
 * `sst` (session start) is epoch seconds, set at login and carried unchanged by every refresh.
 */
export const JUDGE_ROLE = "judge";
const DEFAULT_JUDGE_SESSION_HOURS = 24;
const MIN_JUDGE_SESSION_HOURS = 1;
const MAX_JUDGE_SESSION_HOURS = 72;

/** JUDGE_SESSION_HOURS: whole hours in 1..72, default 24. A malformed value throws (checked at startup). */
export function judgeSessionHoursFromEnv(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.JUDGE_SESSION_HOURS;
  if (raw === undefined || raw.trim() === "") return DEFAULT_JUDGE_SESSION_HOURS;
  const trimmed = raw.trim();
  const hours = Number(trimmed);
  if (!/^\d+$/.test(trimmed) || hours < MIN_JUDGE_SESSION_HOURS || hours > MAX_JUDGE_SESSION_HOURS) {
    throw new Error(`JUDGE_SESSION_HOURS must be an integer between ${MIN_JUDGE_SESSION_HOURS} and ${MAX_JUDGE_SESSION_HOURS}`);
  }
  return hours;
}

/** Epoch seconds, the unit of `sst`, `iat` and `exp`. */
export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/** Session start of a refresh token: its `sst` claim, or its `iat` for tokens issued before `sst` existed. */
export function sessionStartOf(payload: { sst?: unknown; iat?: unknown }): number | undefined {
  if (typeof payload.sst === "number") return payload.sst;
  if (typeof payload.iat === "number") return payload.iat;
  return undefined;
}

/** Last instant (epoch seconds) of a judge session that started at `sessionStart`. */
export function judgeSessionEndsAt(sessionStart: number, hours: number): number {
  return sessionStart + hours * 3600;
}

export function isJudgeSessionOver(sessionStart: number, hours: number, now: number): boolean {
  return now > judgeSessionEndsAt(sessionStart, hours);
}

/** Refresh-token expiry options for a session: only judges are capped, other roles keep the normal expiry. */
export function refreshCapFor(role: string, sessionStart: number, hours: number): { expiresAt: number } | undefined {
  return role === JUDGE_ROLE ? { expiresAt: judgeSessionEndsAt(sessionStart, hours) } : undefined;
}
