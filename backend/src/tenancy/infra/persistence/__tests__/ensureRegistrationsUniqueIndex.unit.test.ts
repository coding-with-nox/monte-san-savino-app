import { describe, it, expect } from "bun:test";
import { ensureRegistrationsUniqueIndex } from "../ensureTenantSchema";

function fakePool(opts: { table?: boolean; index?: boolean; dups?: number }) {
  const queries: string[] = [];
  return {
    queries,
    query: async (sql: string) => {
      queries.push(sql);
      if (sql.includes("to_regclass")) return { rows: [{ t: opts.table === false ? null : "registrations", i: opts.index ? "ix" : null }] };
      if (sql.includes("duplicate_rows")) return { rows: [{ duplicate_rows: opts.dups ?? 0 }] };
      return { rows: [] };
    }
  };
}
const log = () => { const w: any[] = []; return { w, warn: (o: any, m?: string) => w.push([o, m]), info: () => {} }; };

describe("ensureRegistrationsUniqueIndex", () => {
  it("creates the index when no duplicates", async () => {
    const p = fakePool({}); const l = log();
    expect(await ensureRegistrationsUniqueIndex(p, l)).toBe("created");
    expect(p.queries.some((q) => q.includes("CREATE UNIQUE INDEX") && q.includes("COALESCE(model_id"))).toBe(true);
  });
  it("does NOT create it and warns with the duplicate count when duplicates exist", async () => {
    const p = fakePool({ dups: 3 }); const l = log();
    expect(await ensureRegistrationsUniqueIndex(p, l)).toBe("duplicates");
    expect(p.queries.some((q) => q.includes("CREATE UNIQUE INDEX"))).toBe(false);
    expect(l.w[0][0].duplicateRows).toBe(3);
    expect(l.w[0][1]).toContain("3 duplicate");
  });
  it("skips when table missing or index exists", async () => {
    expect(await ensureRegistrationsUniqueIndex(fakePool({ table: false }), log())).toBe("skipped-no-table");
    expect(await ensureRegistrationsUniqueIndex(fakePool({ index: true }), log())).toBe("exists");
  });
});
