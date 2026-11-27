import { describe, it, expect } from "bun:test";
import { excludeMissingModels, isOverrideMedalAllowed, MSS_AWARD_BRACKET_PRESET } from "../categoryClosure";

describe("isOverrideMedalAllowed (head judge override)", () => {
  const brackets = MSS_AWARD_BRACKET_PRESET;

  it("accepts a bracket of the event with the same label AND rank", () => {
    expect(isOverrideMedalAllowed(brackets, { medalLabel: "Gold", medalRank: 4 })).toBe(true);
    expect(isOverrideMedalAllowed(brackets, { medalLabel: "Silver", medalRank: 3 })).toBe(true);
    expect(isOverrideMedalAllowed(brackets, { medalLabel: "Highly Commended", medalRank: 1 })).toBe(true);
  });

  it("accepts None with rank 0, even when the event has no None bracket", () => {
    expect(isOverrideMedalAllowed(brackets, { medalLabel: "None", medalRank: 0 })).toBe(true);
    expect(isOverrideMedalAllowed([], { medalLabel: "None", medalRank: 0 })).toBe(true);
  });

  it("rejects a label with the wrong rank, a rank with the wrong label and unknown medals", () => {
    expect(isOverrideMedalAllowed(brackets, { medalLabel: "Gold", medalRank: 3 })).toBe(false);
    expect(isOverrideMedalAllowed(brackets, { medalLabel: "Gold", medalRank: 0 })).toBe(false);
    expect(isOverrideMedalAllowed(brackets, { medalLabel: "Platinum", medalRank: 4 })).toBe(false);
    expect(isOverrideMedalAllowed(brackets, { medalLabel: "None", medalRank: 4 })).toBe(false);
  });

  it("with no brackets only None/0 is allowed", () => {
    expect(isOverrideMedalAllowed([], { medalLabel: "Gold", medalRank: 4 })).toBe(false);
  });
});

describe("excludeMissingModels", () => {
  it("drops the models flagged missing and keeps the others in order", () => {
    const models = [
      { modelId: "m1", missing: false },
      { modelId: "m2", missing: true },
      { modelId: "m3", missing: false }
    ];
    expect(excludeMissingModels(models).map((m) => m.modelId)).toEqual(["m1", "m3"]);
  });
});
