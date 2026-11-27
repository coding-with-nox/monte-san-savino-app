/** Settings key of the prize order (JSON array of medal labels). */
export const PRIZE_ORDER_KEY = "prizeOrder";

/** Order in which medals are presented at the award ceremony (first = presented first). */
export const DEFAULT_PRIZE_ORDER: readonly string[] = ["Highly Commended", "Bronze", "Silver", "Gold"];

export function parsePrizeOrder(value: string | null | undefined): string[] {
  try {
    const parsed = JSON.parse(value ?? "");
    if (Array.isArray(parsed) && parsed.length && parsed.every((x) => typeof x === "string" && x.trim())) {
      return [...new Set(parsed as string[])];
    }
  } catch {
    // missing or malformed setting: default below
  }
  return [...DEFAULT_PRIZE_ORDER];
}
