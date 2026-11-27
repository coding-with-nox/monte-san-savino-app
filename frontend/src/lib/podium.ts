/** Presentation order of medalLabel values (first = presented first). Edited in the admin Rules tab. */
export const DEFAULT_PRIZE_ORDER = ["Highly Commended", "Bronze", "Silver", "Gold"];

/** Standard MSS medal labels (lowercase) and their rank: shown in the UI language, custom labels as typed. */
export const STANDARD_MEDALS: Record<string, number> = { none: 0, "highly commended": 1, commended: 1, bronze: 2, silver: 3, gold: 4 };

/** Code of the Best of Show special award: always presented last. */
export const BEST_OF_SHOW_CODE = "bos";

/** GET /awards/events/:eventId/ceremony. Classes and prizes already come in presentation order. */
export type CeremonyPrize = {
  medalLabel: string;
  medalRank?: number | null;
  displayNumber?: number | null;
  exhibitor?: string | null;
  modelName?: string | null;
  modelCode?: string | null;
  wholeDisplay?: boolean;
};

export type CeremonyClass = {
  categoryId: string;
  name: string;
  classNumber?: number | null;
  presentationOrder?: number | null;
  prizes: CeremonyPrize[];
};

export type CeremonyHonor = {
  code: string;
  name: string;
  sortOrder?: number | null;
  categoryName?: string | null;
  displayNumber?: number | null;
  exhibitor?: string | null;
  modelName?: string | null;
  wholeDisplay?: boolean;
};

export type CeremonyData = { classes: CeremonyClass[]; honors: CeremonyHonor[] };

/**
 * One full-screen step. A class screen shows the class title and its first `revealed` prizes
 * (revealed 0 = title only); a honor screen shows one special award.
 */
export type CeremonyScreen =
  | { kind: "class"; classIndex: number; revealed: number }
  | { kind: "honor"; honor: CeremonyHonor };

export type Ceremony = { classes: CeremonyClass[]; screens: CeremonyScreen[] };

/** Special awards in presentation order: the server order, Best of Show moved last. */
export function orderHonors(honors: CeremonyHonor[]): CeremonyHonor[] {
  return [
    ...honors.filter((h) => h.code !== BEST_OF_SHOW_CODE),
    ...honors.filter((h) => h.code === BEST_OF_SHOW_CODE)
  ];
}

/**
 * Flattens the ceremony into screens: for each class a title screen followed by one screen per prize
 * (in the given order), then one screen per special award. Classes without prizes are skipped.
 */
export function buildCeremony(data: CeremonyData): Ceremony {
  const classes = data.classes.filter((c) => c.prizes.length > 0);
  const screens: CeremonyScreen[] = [];
  classes.forEach((c, classIndex) => {
    for (let revealed = 0; revealed <= c.prizes.length; revealed++) {
      screens.push({ kind: "class", classIndex, revealed });
    }
  });
  for (const honor of orderHonors(data.honors)) screens.push({ kind: "honor", honor });
  return { classes, screens };
}
