import { describe, it, expect } from "bun:test";
import { parsePagination, withPagination, applyPage, MAX_PAGE_LIMIT } from "../pagination";

describe("parsePagination", () => {
  it("returns null page without params (no truncation)", () => {
    expect(parsePagination({})).toEqual({ ok: true, page: null });
    expect(parsePagination(undefined)).toEqual({ ok: true, page: null });
    expect(parsePagination({ eventId: "x" })).toEqual({ ok: true, page: null });
  });
  it("parses limit and offset", () => {
    expect(parsePagination({ limit: "20", offset: "40" })).toEqual({ ok: true, page: { limit: 20, offset: 40 } });
    expect(parsePagination({ limit: "5" })).toEqual({ ok: true, page: { limit: 5, offset: 0 } });
    expect(parsePagination({ offset: "3" })).toEqual({ ok: true, page: { offset: 3 } });
  });
  it("accepts the max and rejects above it", () => {
    expect(parsePagination({ limit: String(MAX_PAGE_LIMIT) }).ok).toBe(true);
    expect(parsePagination({ limit: String(MAX_PAGE_LIMIT + 1) }).ok).toBe(false);
  });
  it("rejects invalid values", () => {
    for (const q of [{ limit: "0" }, { limit: "-1" }, { limit: "abc" }, { limit: "1.5" }, { limit: "" }, { offset: "-1" }, { offset: "x" }, { limit: ["1", "2"] }]) {
      expect(parsePagination(q as any).ok).toBe(false);
    }
  });
});

describe("withPagination", () => {
  const mk = () => ({ set: { status: 200 as any, headers: {} as Record<string, string> } });
  it("returns everything and no header without params", async () => {
    const ctx = { ...mk(), query: {} };
    let counted = false;
    const r = await withPagination(ctx, async () => { counted = true; return 9; }, async (p) => (p === null ? [1, 2, 3] : []));
    expect(r).toEqual([1, 2, 3]);
    expect(counted).toBe(false);
    expect(ctx.set.headers["X-Total-Count"]).toBeUndefined();
  });
  it("sets X-Total-Count when paginating", async () => {
    const ctx = { ...mk(), query: { limit: "2", offset: "1" } };
    const r = await withPagination(ctx, async () => 7, async (p) => [p]);
    expect(r).toEqual([{ limit: 2, offset: 1 }]);
    expect(ctx.set.headers["X-Total-Count"]).toBe("7");
  });
  it("answers 422 on invalid params", async () => {
    const ctx = { ...mk(), query: { limit: "9999" } };
    const r: any = await withPagination(ctx, async () => 0, async () => []);
    expect(ctx.set.status).toBe(422);
    expect(r.error).toContain("limit");
  });
});

describe("applyPage", () => {
  it("orders by id then limit/offset; untouched when no page", () => {
    const calls: string[] = [];
    const qb: any = {
      orderBy: (c: unknown) => { calls.push(`order:${String(c)}`); return qb; },
      limit: (n: number) => { calls.push(`limit:${n}`); return qb; },
      offset: (n: number) => { calls.push(`offset:${n}`); return qb; }
    };
    expect(applyPage(qb, "id", null)).toBe(qb);
    expect(calls).toEqual([]);
    applyPage(qb, "id", { limit: 10, offset: 5 });
    expect(calls).toEqual(["order:id", "limit:10", "offset:5"]);
    calls.length = 0;
    applyPage(qb, "id", { offset: 5 });
    expect(calls).toEqual(["order:id", "offset:5"]);
  });
});
