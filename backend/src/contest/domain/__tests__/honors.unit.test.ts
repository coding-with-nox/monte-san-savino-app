import { describe, it, expect } from "bun:test";
import { MSS_HONOR_PRESET, honorInputError, nextHonorSortOrder, planHonorPreset, sameHonorCode } from "../honors";

describe("MSS honors preset", () => {
  it("has the 28 catalogue entries in catalogue order with unique codes", () => {
    expect(MSS_HONOR_PRESET).toHaveLength(28);
    expect(MSS_HONOR_PRESET[0]).toEqual({ code: "bop", name: "Best Of Painter" });
    expect(MSS_HONOR_PRESET[MSS_HONOR_PRESET.length - 1]).toEqual({ code: "ap", name: "Andrea Pivato" });
    const codes = MSS_HONOR_PRESET.map((p) => p.code.toLowerCase());
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("plans every entry on an empty event, numbered from 1", () => {
    const plan = planHonorPreset([]);
    expect(plan).toHaveLength(28);
    expect(plan[0]).toEqual({ code: "bop", name: "Best Of Painter", sortOrder: 1 });
    expect(plan[27].sortOrder).toBe(28);
  });

  it("skips codes already present (case-insensitive) and numbers after the existing sort orders", () => {
    const plan = planHonorPreset([{ code: "BOP", sortOrder: 4 }, { code: "bos", sortOrder: 9 }]);
    expect(plan).toHaveLength(26);
    expect(plan.map((p) => p.code)).not.toContain("bop");
    expect(plan.map((p) => p.code)).not.toContain("bos");
    expect(plan[0]).toEqual({ code: "bs", name: "Best Of Sculpture", sortOrder: 10 });
  });

  it("inserts nothing when the catalogue is complete (idempotent)", () => {
    const existing = MSS_HONOR_PRESET.map((p, i) => ({ code: p.code, sortOrder: i + 1 }));
    expect(planHonorPreset(existing)).toEqual([]);
  });
});

describe("honor input", () => {
  it("validates trimmed code 1-20 and name 1-120 characters", () => {
    expect(honorInputError({ code: "bop", name: "Best Of Painter" })).toBeNull();
    expect(honorInputError({ code: "", name: "x" })).toContain("code");
    expect(honorInputError({ code: "a".repeat(21), name: "x" })).toContain("code");
    expect(honorInputError({ code: "a", name: "" })).toContain("name");
    expect(honorInputError({ code: "a", name: "n".repeat(121) })).toContain("name");
  });

  it("compares codes case-insensitively", () => {
    expect(sameHonorCode(" BOP ", "bop")).toBe(true);
    expect(sameHonorCode("bop", "bos")).toBe(false);
  });

  it("appends new honors after the last sort order", () => {
    expect(nextHonorSortOrder([])).toBe(1);
    expect(nextHonorSortOrder([{ sortOrder: 3 }, { sortOrder: 7 }])).toBe(8);
  });
});
