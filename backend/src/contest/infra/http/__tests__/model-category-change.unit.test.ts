import { describe, expect, it } from "bun:test";
import { applyCategoryChange, type CategoryChangeStore } from "../model-category-change";

function fake(statuses: Record<string, string>) {
  const calls: string[] = [];
  const store: CategoryChangeStore = {
    async categoryStatuses(ids) { return ids.map((id) => ({ id, status: statuses[id] ?? "open" })); },
    async deleteModelVotes(m) { calls.push(`votes:${m}`); },
    async deleteCompletions(c) { calls.push(`completions:${c}`); }
  };
  return { store, calls };
}

describe("applyCategoryChange", () => {
  it("deletes model votes and old-category completions when open", async () => {
    const f = fake({});
    await applyCategoryChange({}, "m1", "old", "new", f.store);
    expect(f.calls).toEqual(["votes:m1", "completions:old"]);
  });
  it("rejects with 409 and changes nothing when old category is closed", async () => {
    const f = fake({ old: "closed" });
    const e: any = await applyCategoryChange({}, "m1", "old", "new", f.store).catch((x) => x);
    expect(e.status).toBe(409);
    expect(f.calls).toEqual([]);
  });
  it("rejects with 409 when target category is closed", async () => {
    const f = fake({ new: "closed" });
    const e: any = await applyCategoryChange({}, "m1", "old", "new", f.store).catch((x) => x);
    expect(e.status).toBe(409);
    expect(f.calls).toEqual([]);
  });
});
