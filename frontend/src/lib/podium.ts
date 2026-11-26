export type AwardRow = {
  modelId: string;
  modelName?: string | null;
  categoryId: string;
  medalLabel?: string | null;
  medalRank?: number | null;
  totalScore?: number | null;
  averageRank?: number | null;
};

/** Presentation order of medalLabel values (first = presented first). */
export const DEFAULT_PRIZE_ORDER = ["Highly Commended", "Bronze", "Silver", "Gold"];

export type ClassPodium = {
  categoryId: string;
  /** Winners in reveal order. */
  winners: AwardRow[];
};

/**
 * Groups awarded rows (medalLabel present) by class. Within a class winners follow `order`;
 * labels not listed come first, by ascending medalRank.
 */
export function buildPodiums(rows: AwardRow[], order: readonly string[] = DEFAULT_PRIZE_ORDER): ClassPodium[] {
  const position = (r: AwardRow) => order.indexOf(r.medalLabel ?? "");
  const byClass = new Map<string, AwardRow[]>();
  for (const r of rows) {
    if (!r.medalLabel) continue;
    const list = byClass.get(r.categoryId) ?? [];
    list.push(r);
    byClass.set(r.categoryId, list);
  }
  return [...byClass.entries()].map(([categoryId, winners]) => ({
    categoryId,
    winners: winners.sort((a, b) => position(a) - position(b) || (a.medalRank ?? 0) - (b.medalRank ?? 0))
  }));
}

/** Total reveal steps: one per winner across all classes. */
export function totalSteps(podiums: ClassPodium[]): number {
  return podiums.reduce((s, p) => s + p.winners.length, 0);
}

/** Maps a global step (0 = nothing shown, N = N winners revealed) to the current class and revealed count. */
export function locateStep(podiums: ClassPodium[], step: number): { classIndex: number; revealed: number } {
  let remaining = step;
  for (let i = 0; i < podiums.length; i++) {
    const n = podiums[i].winners.length;
    if (remaining <= n) return { classIndex: i, revealed: remaining };
    remaining -= n;
  }
  const last = Math.max(podiums.length - 1, 0);
  return { classIndex: last, revealed: podiums[last]?.winners.length ?? 0 };
}
