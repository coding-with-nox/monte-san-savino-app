import { describe, it, expect } from "bun:test";
import {
  buildCeremonyClasses, buildClassPrizes, compareCeremonyClasses, toCeremonyHonors, type CeremonyClass
} from "../ceremony";
import { buildHonorViews } from "../honors";

const ORDER = ["Highly Commended", "Bronze", "Silver", "Gold"];

const award = (modelId: string, displayNumber: number | null, medalLabel: string, medalRank: number, exhibitor = "Mario Rossi") => ({
  modelId,
  medalLabel,
  medalRank,
  displayNumber,
  modelName: `Modello ${modelId}`,
  modelCode: `M1-${displayNumber ?? 0}-${modelId}`,
  exhibitor
});

describe("buildClassPrizes", () => {
  it("returns one whole-display prize when all models of a display share the same medal", () => {
    const prizes = buildClassPrizes([
      award("a", 7, "Gold", 4),
      award("b", 7, "Gold", 4)
    ], ORDER);
    expect(prizes).toEqual([{
      medalLabel: "Gold", medalRank: 4, displayNumber: 7, exhibitor: "Mario Rossi",
      modelName: null, modelCode: null, wholeDisplay: true
    }]);
  });

  it("returns one prize per model when the medals of a display differ, leaving out None", () => {
    const prizes = buildClassPrizes([
      award("a", 7, "Gold", 4),
      award("b", 7, "None", 0)
    ], ORDER);
    expect(prizes.map((p) => [p.modelName, p.wholeDisplay])).toEqual([["Modello a", false]]);
  });

  it("never collapses a single-model display into a whole display", () => {
    const prizes = buildClassPrizes([award("a", 3, "Silver", 3)], ORDER);
    expect(prizes).toHaveLength(1);
    expect(prizes[0].wholeDisplay).toBe(false);
    expect(prizes[0].modelName).toBe("Modello a");
  });

  it("orders by the prize-order setting first, then medal rank, then display number", () => {
    const prizes = buildClassPrizes([
      award("g", 1, "Gold", 4),
      award("s", 2, "Silver", 3),
      award("h", 9, "Highly Commended", 1),
      award("b2", 5, "Bronze", 2),
      award("b1", 4, "Bronze", 2)
    ], ORDER);
    expect(prizes.map((p) => p.modelName)).toEqual([
      "Modello h", "Modello b1", "Modello b2", "Modello s", "Modello g"
    ]);
  });

  it("puts medal labels missing from the prize order last, by rank", () => {
    const prizes = buildClassPrizes([
      award("x", 1, "Platinum", 5),
      award("g", 2, "Gold", 4)
    ], ORDER);
    expect(prizes.map((p) => p.medalLabel)).toEqual(["Gold", "Platinum"]);
  });

  it("returns nothing when every model is None", () => {
    expect(buildClassPrizes([award("a", 1, "None", 0), award("b", 2, "None", 0)], ORDER)).toEqual([]);
  });
});

describe("buildCeremonyClasses", () => {
  const cat = (id: string, extra: Partial<{ status: string; classNumber: string | null; presentationOrder: number | null; name: string }> = {}) => ({
    id,
    name: extra.name ?? `Classe ${id}`,
    status: extra.status ?? "closed",
    classNumber: extra.classNumber === undefined ? id : extra.classNumber,
    presentationOrder: extra.presentationOrder === undefined ? null : extra.presentationOrder
  });
  const model = (id: string, categoryId: string, displayNumber: number | null = 1) => ({
    id, categoryId, name: `Modello ${id}`, displayNumber, modelCode: `M-${id}`, exhibitor: "Espositore"
  });

  it("keeps only closed classes with at least one medal above None", () => {
    const classes = buildCeremonyClasses({
      categories: [
        cat("open", { status: "open" }),
        cat("noMedals"),
        cat("withMedal")
      ],
      models: [model("m1", "open"), model("m2", "noMedals", 2), model("m3", "withMedal", 3)],
      awards: [
        { categoryId: "open", modelId: "m1", medalLabel: "Gold", medalRank: 4 },
        { categoryId: "noMedals", modelId: "m2", medalLabel: "None", medalRank: 0 },
        { categoryId: "withMedal", modelId: "m3", medalLabel: "Gold", medalRank: 4 }
      ],
      prizeOrder: ORDER
    });
    expect(classes.map((c) => c.categoryId)).toEqual(["withMedal"]);
  });

  it("orders classes by presentationOrder, then classNumber numerically, then name, nulls last", () => {
    const classes = buildCeremonyClasses({
      categories: [
        cat("a", { classNumber: "10", presentationOrder: null }),
        cat("b", { classNumber: "2", presentationOrder: 5 }),
        cat("c", { classNumber: "1", presentationOrder: 5 }),
        cat("d", { classNumber: "3", presentationOrder: 1 }),
        cat("e", { classNumber: null, presentationOrder: null, name: "Senza numero" })
      ],
      models: [model("m-a", "a"), model("m-b", "b"), model("m-c", "c"), model("m-d", "d"), model("m-e", "e")],
      awards: ["a", "b", "c", "d", "e"].map((id) => ({ categoryId: id, modelId: `m-${id}`, medalLabel: "Gold", medalRank: 4 })),
      prizeOrder: ORDER
    });
    expect(classes.map((c) => c.categoryId)).toEqual(["d", "c", "b", "a", "e"]);
  });

  it("sorts classes with the shared comparator", () => {
    const base = { categoryId: "x", name: "N", presentationOrder: null, prizes: [] } satisfies Omit<CeremonyClass, "classNumber">;
    const list: CeremonyClass[] = [
      { ...base, categoryId: "2", classNumber: "2" },
      { ...base, categoryId: "10", classNumber: "10" }
    ];
    expect([...list].sort(compareCeremonyClasses).map((c) => c.categoryId)).toEqual(["2", "10"]);
  });
});

describe("honors", () => {
  const honors = [
    { id: "h2", code: "bos", name: "Best Of Show", sortOrder: 2 },
    { id: "h1", code: "bop", name: "Best Of Painter", sortOrder: 1 },
    { id: "h3", code: "ap", name: "Andrea Pivato", sortOrder: 3 }
  ];
  const models = [
    { id: "m1", categoryId: "c1", displayNumber: 4, name: "Cavaliere", modelCode: "M1-4-1", exhibitor: "Luca" },
    { id: "m2", categoryId: "c1", displayNumber: 4, name: "Fante", modelCode: "M1-4-2", exhibitor: "Luca" }
  ];

  it("resolves model, whole display and unassigned honors, in catalogue order", () => {
    const views = buildHonorViews({
      honors,
      assignments: [
        { honorId: "h2", categoryId: "c1", displayNumber: 4, modelId: null },
        { honorId: "h1", categoryId: "c1", displayNumber: 4, modelId: "m1" }
      ],
      categories: [{ id: "c1", name: "Pittura" }],
      models
    });
    expect(views.map((v) => v.code)).toEqual(["bop", "bos", "ap"]);
    expect(views[0].assignment).toEqual({
      categoryId: "c1", categoryName: "Pittura", displayNumber: 4, modelId: "m1", modelName: "Cavaliere",
      modelCode: "M1-4-1", wholeDisplay: false, exhibitor: "Luca"
    });
    expect(views[1].assignment).toMatchObject({ modelId: null, modelName: null, wholeDisplay: true, exhibitor: "Luca" });
    expect(views[2].assignment).toBeNull();
  });

  it("ceremony honors list only assigned ones, in catalogue order", () => {
    const views = buildHonorViews({
      honors,
      assignments: [
        { honorId: "h2", categoryId: "c1", displayNumber: 4, modelId: null },
        { honorId: "h1", categoryId: "c1", displayNumber: 4, modelId: "m2" }
      ],
      categories: [{ id: "c1", name: "Pittura" }],
      models
    });
    const out = toCeremonyHonors(views);
    expect(out.map((h) => h.code)).toEqual(["bop", "bos"]);
    expect(out[0]).toEqual({
      code: "bop", name: "Best Of Painter", sortOrder: 1, categoryName: "Pittura", displayNumber: 4,
      exhibitor: "Luca", modelName: "Fante", wholeDisplay: false
    });
    expect(out[1].wholeDisplay).toBe(true);
  });
});
