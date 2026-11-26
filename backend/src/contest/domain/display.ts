/** A display is the showcase holding the models with the same displayNumber within an event. */
export type DisplayModel = { eventId: string; displayNumber: number | null; categoryStatus: string; currentRank: number | null };

export type Display<T extends DisplayModel> = {
  eventId: string;
  displayNumber: number;
  /** False when every model of the display is in a closed category. */
  votable: boolean;
  /** Rank shared by all models of the display, otherwise null. */
  currentRank: number | null;
  models: T[];
};

/** Models without a display number are not part of any display. */
export function groupDisplays<T extends DisplayModel>(models: T[]): Display<T>[] {
  const byKey = new Map<string, T[]>();
  for (const m of models) {
    if (m.displayNumber === null) continue;
    const key = `${m.eventId}:${m.displayNumber}`;
    byKey.set(key, [...(byKey.get(key) ?? []), m]);
  }
  return [...byKey.values()]
    .map((list) => ({
      eventId: list[0].eventId,
      displayNumber: list[0].displayNumber!,
      votable: list.some((m) => m.categoryStatus !== "closed"),
      currentRank: list.every((m) => m.currentRank === list[0].currentRank) ? list[0].currentRank : null,
      models: list
    }))
    .sort((a, b) => a.eventId.localeCompare(b.eventId) || a.displayNumber - b.displayNumber);
}
