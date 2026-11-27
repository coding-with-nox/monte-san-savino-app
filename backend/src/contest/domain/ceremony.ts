/** Award ceremony data: medals per closed class and special awards. Pure, no I/O. */
import type { HonorView } from "./honors";

export type CeremonyCategory = { id: string; name: string; status: string; classNumber: string | null; presentationOrder: number | null };
export type CeremonyModel = { id: string; categoryId: string; name: string; displayNumber: number | null; modelCode: string | null; exhibitor: string };
export type CeremonyAwardRow = { categoryId: string; modelId: string; medalLabel: string; medalRank: number };

export type CeremonyPrize = {
  medalLabel: string;
  medalRank: number;
  displayNumber: number | null;
  exhibitor: string;
  modelName: string | null;
  modelCode: string | null;
  wholeDisplay: boolean;
};

export type CeremonyClass = {
  categoryId: string;
  name: string;
  classNumber: string | null;
  presentationOrder: number | null;
  prizes: CeremonyPrize[];
};

export type CeremonyHonor = {
  code: string;
  name: string;
  sortOrder: number;
  categoryName: string | null;
  displayNumber: number;
  exhibitor: string;
  modelName: string | null;
  wholeDisplay: boolean;
};

type AwardInput = {
  modelId: string;
  medalLabel: string;
  medalRank: number;
  displayNumber: number | null;
  modelName: string;
  modelCode: string | null;
  exhibitor: string;
};

/**
 * Prizes of one class: a display whose (several) models all got the same medal is returned once, as a whole
 * display; otherwise one prize per model above None. Sorted by the prize-order setting, then medalRank, then display.
 */
export function buildClassPrizes(awards: AwardInput[], prizeOrder: readonly string[]): CeremonyPrize[] {
  const groups = new Map<string, AwardInput[]>();
  for (const a of awards) {
    const key = a.displayNumber === null ? `model:${a.modelId}` : `display:${a.displayNumber}`;
    groups.set(key, [...(groups.get(key) ?? []), a]);
  }

  const prizes: CeremonyPrize[] = [];
  for (const members of groups.values()) {
    const [first] = [...members].sort((a, b) => a.modelId.localeCompare(b.modelId));
    const sameMedal = members.every((m) => m.medalLabel === first.medalLabel && m.medalRank === first.medalRank);
    if (members.length > 1 && sameMedal && first.medalRank > 0) {
      prizes.push({
        medalLabel: first.medalLabel,
        medalRank: first.medalRank,
        displayNumber: first.displayNumber,
        exhibitor: first.exhibitor,
        modelName: null,
        modelCode: null,
        wholeDisplay: true
      });
      continue;
    }
    for (const m of members) {
      if (m.medalRank <= 0) continue;
      prizes.push({
        medalLabel: m.medalLabel,
        medalRank: m.medalRank,
        displayNumber: m.displayNumber,
        exhibitor: m.exhibitor,
        modelName: m.modelName,
        modelCode: m.modelCode,
        wholeDisplay: false
      });
    }
  }

  const orderIndex = (label: string) => {
    const i = prizeOrder.indexOf(label);
    return i === -1 ? prizeOrder.length : i;
  };
  return prizes.sort((a, b) =>
    orderIndex(a.medalLabel) - orderIndex(b.medalLabel)
    || a.medalRank - b.medalRank
    || (a.displayNumber ?? Number.MAX_SAFE_INTEGER) - (b.displayNumber ?? Number.MAX_SAFE_INTEGER)
    || (a.modelName ?? "").localeCompare(b.modelName ?? ""));
}

/** presentationOrder, then classNumber (numeric), then name. Missing values go last. */
export function compareCeremonyClasses(
  a: Pick<CeremonyClass, "name" | "classNumber" | "presentationOrder">,
  b: Pick<CeremonyClass, "name" | "classNumber" | "presentationOrder">
): number {
  const pa = a.presentationOrder ?? Number.MAX_SAFE_INTEGER;
  const pb = b.presentationOrder ?? Number.MAX_SAFE_INTEGER;
  if (pa !== pb) return pa - pb;
  if ((a.classNumber === null) !== (b.classNumber === null)) return a.classNumber === null ? 1 : -1;
  const byNumber = (a.classNumber ?? "").localeCompare(b.classNumber ?? "", undefined, { numeric: true });
  return byNumber || a.name.localeCompare(b.name);
}

/** Only closed classes with at least one medal above None. */
export function buildCeremonyClasses(input: {
  categories: CeremonyCategory[];
  models: CeremonyModel[];
  awards: CeremonyAwardRow[];
  prizeOrder: readonly string[];
}): CeremonyClass[] {
  const modelById = new Map(input.models.map((m) => [m.id, m]));
  const classes: CeremonyClass[] = [];
  for (const cat of input.categories) {
    if (cat.status !== "closed") continue;
    const awards: AwardInput[] = [];
    for (const row of input.awards) {
      if (row.categoryId !== cat.id) continue;
      const model = modelById.get(row.modelId);
      if (!model) continue;
      awards.push({
        modelId: model.id,
        medalLabel: row.medalLabel,
        medalRank: row.medalRank,
        displayNumber: model.displayNumber,
        modelName: model.name,
        modelCode: model.modelCode,
        exhibitor: model.exhibitor
      });
    }
    const prizes = buildClassPrizes(awards, input.prizeOrder);
    if (!prizes.some((p) => p.medalRank > 0)) continue;
    classes.push({ categoryId: cat.id, name: cat.name, classNumber: cat.classNumber, presentationOrder: cat.presentationOrder, prizes });
  }
  return classes.sort(compareCeremonyClasses);
}

/** Assigned honors only, in catalogue order. */
export function toCeremonyHonors(honors: HonorView[]): CeremonyHonor[] {
  return honors
    .filter((h) => h.assignment !== null)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code))
    .map((h) => ({
      code: h.code,
      name: h.name,
      sortOrder: h.sortOrder,
      categoryName: h.assignment!.categoryName,
      displayNumber: h.assignment!.displayNumber,
      exhibitor: h.assignment!.exhibitor,
      modelName: h.assignment!.modelName,
      wholeDisplay: h.assignment!.wholeDisplay
    }));
}
