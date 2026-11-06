export type AwardRow = {
  modelId: string;
  modelName?: string | null;
  categoryId: string;
  medalLabel?: string | null;
  medalRank?: number | null;
  totalScore?: number | null;
  averageRank?: number | null;
};

export type ClassPodium = {
  categoryId: string;
  /** Winners ordered for the reveal: lowest medal first, best medal last. */
  winners: AwardRow[];
};

/**
 * Groups awarded rows (medalLabel present) by class. Within a class winners are ordered
 * by ascending medalRank (higher rank = better medal, revealed last).
 */
export function buildPodiums(rows: AwardRow[]): ClassPodium[] {
  const byClass = new Map<string, AwardRow[]>();
  for (const r of rows) {
    if (!r.medalLabel) continue;
    const list = byClass.get(r.categoryId) ?? [];
    list.push(r);
    byClass.set(r.categoryId, list);
  }
  return [...byClass.entries()].map(([categoryId, winners]) => ({
    categoryId,
    winners: winners.sort((a, b) => (a.medalRank ?? 0) - (b.medalRank ?? 0))
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
