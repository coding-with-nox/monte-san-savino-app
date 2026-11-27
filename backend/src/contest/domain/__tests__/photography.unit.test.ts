import { describe, it, expect } from "bun:test";
import {
  buildPhotographyRows, DEFAULT_MIN_PHOTO_MEDAL_RANK, parseMinPhotoMedalRank, photographySettingError
} from "../photography";
import type { CeremonyClass, CeremonyPrize } from "../ceremony";

const prize = (over: Partial<CeremonyPrize>): CeremonyPrize => ({
  medalLabel: "Gold", medalRank: 4, displayNumber: 1, exhibitor: "Anna", modelName: "Orc", modelCode: "M1-0001-1",
  wholeDisplay: false, ...over
});
const cls = (name: string, presentationOrder: number, prizes: CeremonyPrize[]): CeremonyClass => ({
  categoryId: name, name, classNumber: String(presentationOrder), presentationOrder, prizes
});

describe("minPhotoMedalRank setting", () => {
  it("defaults to 4 (Gold) and falls back on invalid stored values", () => {
    expect(DEFAULT_MIN_PHOTO_MEDAL_RANK).toBe(4);
    expect(parseMinPhotoMedalRank(undefined)).toBe(4);
    expect(parseMinPhotoMedalRank("abc")).toBe(4);
    expect(parseMinPhotoMedalRank("11")).toBe(4);
    expect(parseMinPhotoMedalRank("0")).toBe(0);
    expect(parseMinPhotoMedalRank("10")).toBe(10);
  });

  it("validates an integer 0..10 on PUT /admin/settings", () => {
    expect(photographySettingError([["minPhotoMedalRank", "0"]])).toBeNull();
    expect(photographySettingError([["minPhotoMedalRank", "10"]])).toBeNull();
    expect(photographySettingError([["minPhotoMedalRank", "11"]])).not.toBeNull();
    expect(photographySettingError([["minPhotoMedalRank", "-1"]])).not.toBeNull();
    expect(photographySettingError([["minPhotoMedalRank", "2.5"]])).not.toBeNull();
    expect(photographySettingError([["minPhotoMedalRank", "gold"]])).not.toBeNull();
  });
});

describe("buildPhotographyRows", () => {
  const participants = new Map<number, number>([[1, 7], [2, 3], [5, 12]]);

  it("keeps medals at or above the minimum, in class order then display order", () => {
    const classes = [
      cls("Late", 2, [prize({ displayNumber: 5, modelName: "B", medalRank: 4 })]),
      cls("Early", 1, [
        prize({ displayNumber: 2, modelName: "Z", medalRank: 4 }),
        prize({ displayNumber: 1, modelName: "Y", medalRank: 3, medalLabel: "Silver" }),
        prize({ displayNumber: 1, modelName: "X", medalRank: 4 })
      ])
    ];
    const rows = buildPhotographyRows(classes, participants, 4);
    expect(rows.map((r) => [r.className, r.displayNumber, r.modelName])).toEqual([
      ["Early", 1, "X"], ["Early", 2, "Z"], ["Late", 5, "B"]
    ]);
    expect(rows[0]).toMatchObject({ participantNumber: 7, exhibitor: "Anna", medalLabel: "Gold", modelCode: "M1-0001-1", wholeDisplay: false });
  });

  it("includes silver when the minimum is 3 and never returns None", () => {
    const classes = [cls("C", 1, [
      prize({ medalRank: 3, medalLabel: "Silver", modelName: "S" }),
      prize({ medalRank: 0, medalLabel: "None", modelName: "N" })
    ])];
    expect(buildPhotographyRows(classes, participants, 3).map((r) => r.modelName)).toEqual(["S"]);
    expect(buildPhotographyRows(classes, participants, 0).map((r) => r.modelName)).toEqual(["S"]);
  });

  it("whole displays have no model name or code", () => {
    const classes = [cls("C", 1, [prize({ wholeDisplay: true, modelName: null, modelCode: null, displayNumber: 2 })])];
    const [row] = buildPhotographyRows(classes, participants, 4);
    expect(row).toMatchObject({ wholeDisplay: true, modelName: null, modelCode: null, participantNumber: 3 });
  });

  it("returns no rows when nothing reaches the minimum", () => {
    expect(buildPhotographyRows([cls("C", 1, [prize({ medalRank: 2, medalLabel: "Bronze" })])], participants, 4)).toEqual([]);
  });
});
