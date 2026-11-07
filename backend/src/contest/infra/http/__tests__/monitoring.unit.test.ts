import { describe, it, expect } from "bun:test";
import { buildMonitoringRows } from "../award.routes";

describe("buildMonitoringRows", () => {
  const cats = [{ id: "c1", name: "A", status: "open" }, { id: "c2", name: "B", status: "closed" }];
  it("assembles counts, defaulting missing categories to 0", () => {
    const r = buildMonitoringRows(cats, {
      models: [{ categoryId: "c1", count: 4 }],
      judges: [{ categoryId: "c1", count: 2 }],
      scored: [{ categoryId: "c1", count: 1 }],
      completions: [{ categoryId: "c1", count: 1 }]
    });
    expect(r[0]).toEqual({ categoryId: "c1", categoryName: "A", status: "open", totalModels: 4, scoredModels: 1, percentComplete: 25, totalJudges: 2, completedJudges: 1 });
    expect(r[1]).toEqual({ categoryId: "c2", categoryName: "B", status: "closed", totalModels: 0, scoredModels: 0, percentComplete: 0, totalJudges: 0, completedJudges: 0 });
  });
  it("rounds percent and coerces string counts", () => {
    const r = buildMonitoringRows([cats[0]], {
      models: [{ categoryId: "c1", count: "3" as any }], judges: [], scored: [{ categoryId: "c1", count: 2 }], completions: []
    });
    expect(r[0].percentComplete).toBe(67);
  });
});
