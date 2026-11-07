import { describe, it, expect } from "bun:test";
import { exportMaxRows, exportLimitError, mapInChunks, DEFAULT_EXPORT_MAX_ROWS } from "../exportLimits";

describe("exportMaxRows", () => {
  it("defaults, overrides, ignores invalid", () => {
    expect(exportMaxRows({})).toBe(DEFAULT_EXPORT_MAX_ROWS);
    expect(exportMaxRows({ EXPORT_MAX_ROWS: "100" })).toBe(100);
    expect(exportMaxRows({ EXPORT_MAX_ROWS: "0" })).toBe(DEFAULT_EXPORT_MAX_ROWS);
    expect(exportMaxRows({ EXPORT_MAX_ROWS: "abc" })).toBe(DEFAULT_EXPORT_MAX_ROWS);
  });
});
describe("exportLimitError", () => {
  it("is null at or below the limit, message above", () => {
    expect(exportLimitError(10, 10)).toBeNull();
    expect(exportLimitError(11, 10)?.error).toContain("more than 10 rows");
  });
});
describe("mapInChunks", () => {
  it("preserves order and bounds concurrency", async () => {
    let active = 0, peak = 0;
    const r = await mapInChunks(Array.from({ length: 10 }, (_, i) => i), 3, async (i) => {
      active++; peak = Math.max(peak, active);
      await new Promise((res) => setTimeout(res, 2));
      active--;
      return i * 2;
    });
    expect(r).toEqual([0, 2, 4, 6, 8, 10, 12, 14, 16, 18]);
    expect(peak).toBeLessThanOrEqual(3);
  });
  it("handles empty input", async () => {
    expect(await mapInChunks([], 25, async (x) => x)).toEqual([]);
  });
});
