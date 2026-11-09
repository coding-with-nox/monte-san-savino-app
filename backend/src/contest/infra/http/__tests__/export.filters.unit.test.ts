import { describe, it, expect } from "bun:test";
import { parseExportFilters } from "../export.routes";

const U1 = "11111111-1111-4111-8111-111111111111";
const U2 = "22222222-2222-4222-8222-222222222222";

describe("parseExportFilters", () => {
  it("accepts all combined filters", () => {
    const r = parseExportFilters({ eventId: U1, categoryId: U2, userId: U1, modelId: U2 });
    expect(r).toEqual({ ok: true, filters: { eventId: U1, categoryId: U2, userId: U1, modelId: U2 } });
  });
  it("treats empty filters as absent when not required", () => {
    expect(parseExportFilters({ userId: "" })).toEqual({ ok: true, filters: {} });
    expect(parseExportFilters(undefined)).toEqual({ ok: true, filters: {} });
  });
  it("rejects invalid uuids with 422", () => {
    for (const key of ["eventId", "categoryId", "userId", "modelId"]) {
      const r = parseExportFilters({ [key]: "nope" });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.status).toBe(422);
    }
  });
  it("labels: eventId required unless userId or modelId present", () => {
    const opts = { requireEventUnlessScoped: true };
    const none = parseExportFilters({ categoryId: U1 }, opts);
    expect(none.ok).toBe(false);
    if (!none.ok) expect(none.status).toBe(422);
    expect(parseExportFilters({ eventId: U1 }, opts).ok).toBe(true);
    expect(parseExportFilters({ userId: U1 }, opts).ok).toBe(true);
    expect(parseExportFilters({ modelId: U1 }, opts).ok).toBe(true);
  });
});
