/** Special awards ("honors") of an event: catalogue, validation and views. Pure, no I/O. */

export const HONOR_CODE_MAX = 20;
export const HONOR_NAME_MAX = 120;

export type HonorPreset = { code: string; name: string };

/** Monte San Savino catalogue of special awards, in catalogue order. */
export const MSS_HONOR_PRESET: readonly HonorPreset[] = [
  { code: "bop", name: "Best Of Painter" },
  { code: "bos", name: "Best Of Show" },
  { code: "bs", name: "Best Of Sculpture" },
  { code: "boss", name: "Best Of Standard" },
  { code: "bomm", name: "Best Of Military Modelling" },
  { code: "bosf", name: "Best Of Sci-Fi" },
  { code: "bot", name: "Best Of Time Chronicles" },
  { code: "boc", name: "Best Of Creativity" },
  { code: "bof", name: "Best Of Fantasy" },
  { code: "boh", name: "Best Of Historical" },
  { code: "ph", name: "Platinum Historical" },
  { code: "pf", name: "Platinum Fantasy" },
  { code: "pt", name: "Platinum Time Chronicles" },
  { code: "hst", name: "Handmade Sculpture Trophy" },
  { code: "mm72", name: "Military Modelling 1/72 Trophy" },
  { code: "mm35", name: "Military Modelling 1/35 Trophy" },
  { code: "act", name: "Ancient Trophy" },
  { code: "mt", name: "Medieval Trophy" },
  { code: "cup35", name: "1:35 Cup Trophy" },
  { code: "rcm", name: "Roma Caput Mundi Trophy" },
  { code: "jmt", name: "Joachim Murat Trophy" },
  { code: "acw", name: "American Civil War Trophy" },
  { code: "aag", name: "Aldo & Giorgio Taucer Trophy" },
  { code: "lp", name: "Legio Pictorum Trophy" },
  { code: "vvw", name: "Verkos Vault Wargame Trophy" },
  { code: "vvc", name: "Verkos Vault Cinema Trophy" },
  { code: "vvfs", name: "Verkos Vault Fantasy Scene" },
  { code: "ap", name: "Andrea Pivato" }
];

/** Validation of an honor (create/update, on trimmed values). Error message or null. */
export function honorInputError(h: { code: string; name: string }): string | null {
  if (h.code.length === 0 || h.code.length > HONOR_CODE_MAX) return `code must be 1-${HONOR_CODE_MAX} characters`;
  if (h.name.length === 0 || h.name.length > HONOR_NAME_MAX) return `name must be 1-${HONOR_NAME_MAX} characters`;
  return null;
}

/** Codes are unique per event, case-insensitively (mirrors the unique index on lower(code)). */
export function sameHonorCode(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Next sort order for a new honor: after the last one of the event. */
export function nextHonorSortOrder(existing: { sortOrder: number }[]): number {
  return existing.reduce((max, h) => Math.max(max, h.sortOrder), 0) + 1;
}

/**
 * Preset rows to insert: catalogue entries whose code is not already in the event, in catalogue order,
 * numbered after the existing sort orders. Running it again on a complete event inserts nothing.
 */
export function planHonorPreset(existing: { code: string; sortOrder: number }[]): { code: string; name: string; sortOrder: number }[] {
  const taken = new Set(existing.map((h) => h.code.trim().toLowerCase()));
  const base = existing.reduce((max, h) => Math.max(max, h.sortOrder), 0);
  return MSS_HONOR_PRESET
    .filter((p) => !taken.has(p.code.toLowerCase()))
    .map((p, i) => ({ code: p.code, name: p.name, sortOrder: base + i + 1 }));
}

export type HonorAssignmentView = {
  categoryId: string;
  categoryName: string | null;
  displayNumber: number;
  modelId: string | null;
  modelName: string | null;
  modelCode: string | null;
  /** True when the award goes to the whole display (modelId null). */
  wholeDisplay: boolean;
  exhibitor: string;
};

export type HonorView = {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  assignment: HonorAssignmentView | null;
};

export type HonorViewInput = {
  honors: { id: string; code: string; name: string; sortOrder: number }[];
  assignments: { honorId: string; categoryId: string; displayNumber: number; modelId: string | null }[];
  categories: { id: string; name: string }[];
  /** All models of the event (display lookup for whole-display awards and exhibitor names). */
  models: { id: string; categoryId: string; displayNumber: number | null; name: string; modelCode: string | null; exhibitor: string }[];
};

/** Catalogue order (sortOrder, then code) with the assignment of each honor resolved to its class, model and exhibitor. */
export function buildHonorViews(input: HonorViewInput): HonorView[] {
  const categoryName = new Map(input.categories.map((c) => [c.id, c.name]));
  const modelById = new Map(input.models.map((m) => [m.id, m]));
  const assignmentByHonor = new Map(input.assignments.map((a) => [a.honorId, a]));
  return [...input.honors]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code))
    .map((h) => {
      const a = assignmentByHonor.get(h.id);
      let assignment: HonorAssignmentView | null = null;
      if (a) {
        const model = a.modelId ? modelById.get(a.modelId) : undefined;
        // Whole display: the exhibitor is the one of any model of that display.
        const displayModel = model ?? input.models.find((m) => m.categoryId === a.categoryId && m.displayNumber === a.displayNumber);
        assignment = {
          categoryId: a.categoryId,
          categoryName: categoryName.get(a.categoryId) ?? null,
          displayNumber: a.displayNumber,
          modelId: a.modelId,
          modelName: a.modelId ? (model?.name ?? null) : null,
          modelCode: a.modelId ? (model?.modelCode ?? null) : null,
          wholeDisplay: a.modelId === null,
          exhibitor: displayModel?.exhibitor ?? ""
        };
      }
      return { id: h.id, code: h.code, name: h.name, sortOrder: h.sortOrder, assignment };
    });
}
