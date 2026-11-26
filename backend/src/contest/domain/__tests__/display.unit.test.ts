import { describe, it, expect } from "bun:test";
import { groupDisplays } from "../display";

const m = (id: string, displayNumber: number | null, over: Record<string, any> = {}) =>
  ({ id, eventId: "e1", displayNumber, categoryStatus: "open", currentRank: null as number | null, ...over });

describe("groupDisplays", () => {
  it("groups by event and display number, skipping models without a display", () => {
    const out = groupDisplays([m("a", 2), m("b", 1), m("c", 2), m("d", null), m("e", 1, { eventId: "e2" })]);
    expect(out.map((d) => [d.eventId, d.displayNumber, d.models.length])).toEqual([["e1", 1, 1], ["e1", 2, 2], ["e2", 1, 1]]);
  });

  it("exposes the rank only when shared by all models", () => {
    expect(groupDisplays([m("a", 1, { currentRank: 3 }), m("b", 1, { currentRank: 3 })])[0].currentRank).toBe(3);
    expect(groupDisplays([m("a", 1, { currentRank: 3 }), m("b", 1)])[0].currentRank).toBeNull();
  });

  it("is votable while at least one model is in an open category", () => {
    expect(groupDisplays([m("a", 1, { categoryStatus: "closed" })])[0].votable).toBe(false);
    expect(groupDisplays([m("a", 1, { categoryStatus: "closed" }), m("b", 1)])[0].votable).toBe(true);
  });
});
