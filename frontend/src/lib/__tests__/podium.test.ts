import { describe, it, expect } from "vitest";
import { buildPodiums, locateStep, totalSteps } from "../podium";
import { countryName, countryOptions } from "../countries";

const rows = [
  { modelId: "a", categoryId: "c1", medalLabel: "Gold", medalRank: 4 },
  { modelId: "b", categoryId: "c1", medalLabel: "Bronze", medalRank: 2 },
  { modelId: "c", categoryId: "c1", medalLabel: null, medalRank: null },
  { modelId: "d", categoryId: "c2", medalLabel: "Silver", medalRank: 3 }
];

describe("podium helpers", () => {
  it("groups winners per class, lowest medal first, ignoring unawarded rows", () => {
    const p = buildPodiums(rows);
    expect(p).toHaveLength(2);
    expect(p[0].winners.map((w) => w.modelId)).toEqual(["b", "a"]);
    expect(totalSteps(p)).toBe(3);
  });

  it("maps global steps to class and revealed count", () => {
    const p = buildPodiums(rows);
    expect(locateStep(p, 0)).toEqual({ classIndex: 0, revealed: 0 });
    expect(locateStep(p, 2)).toEqual({ classIndex: 0, revealed: 2 });
    expect(locateStep(p, 3)).toEqual({ classIndex: 1, revealed: 1 });
  });
});

describe("countries", () => {
  it("provides localized, sorted options", () => {
    expect(countryName("IT", "en")).toBe("Italy");
    expect(countryName("IT", "it")).toBe("Italia");
    const opts = countryOptions("en");
    expect(opts.find((o) => o.code === "DE")?.name).toBe("Germany");
    expect(opts.map((o) => o.name)).toEqual([...opts.map((o) => o.name)].sort((a, b) => a.localeCompare(b, "en")));
  });
});
