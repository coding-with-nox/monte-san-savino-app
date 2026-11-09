import { describe, it, expect } from "bun:test";
import { formatModelCode, normalizeDisplayNumberPadding } from "../model-code";

describe("normalizeDisplayNumberPadding", () => {
  it("defaults to 4 for missing/invalid", () => {
    for (const v of [undefined, null, "", "abc"]) expect(normalizeDisplayNumberPadding(v as any)).toBe(4);
  });
  it("clamps to 1..10", () => {
    expect(normalizeDisplayNumberPadding("0")).toBe(1);
    expect(normalizeDisplayNumberPadding("-5")).toBe(1);
    expect(normalizeDisplayNumberPadding("99")).toBe(10);
    expect(normalizeDisplayNumberPadding("6")).toBe(6);
  });
});

describe("formatModelCode", () => {
  const f = { displayNumberPadding: 4 };
  it("formats M<cat>-<padded>-<code>", () => {
    expect(formatModelCode(12, 3, 7, f)).toBe("M3-0007-12");
  });
  it("returns empty string when any part is null/undefined", () => {
    expect(formatModelCode(null, 1, 1, f)).toBe("");
    expect(formatModelCode(1, undefined, 1, f)).toBe("");
    expect(formatModelCode(1, 1, null, f)).toBe("");
  });
  it("does not truncate numbers longer than padding", () => {
    expect(formatModelCode(1, 1, 123456, { displayNumberPadding: 2 })).toBe("M1-123456-1");
  });
  it("clamps negatives to 0 and truncates decimals", () => {
    expect(formatModelCode(-3, -1, 2.9, f)).toBe("M0-0002-0");
  });
  it("accepts zero values", () => {
    expect(formatModelCode(0, 0, 0, { displayNumberPadding: 1 })).toBe("M0-0-0");
  });
});
