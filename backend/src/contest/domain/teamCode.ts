/** Team model code: participant number + "T" + per-participant progressive (e.g. 173T1). */
export function nextTeamCode(participantNumber: number, existingCodes: (string | null | undefined)[]): string {
  const prefix = `${participantNumber}T`;
  const used = existingCodes
    .filter((c): c is string => typeof c === "string" && c.startsWith(prefix))
    .map((c) => Number(c.slice(prefix.length)))
    .filter((n) => Number.isInteger(n));
  return `${prefix}${Math.max(0, ...used) + 1}`;
}
