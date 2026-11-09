import { describe, it, expect } from "bun:test";
import { closeCategory, reopenCategory, type ClosureStore } from "../categoryClosure";

type State = {
  category: { id: string; eventId: string; status: string } | null;
  assigned: string[]; models: string[];
  votes: { judgeId: string; modelId: string; rank: number }[]; // newest first
  completions: string[]; awards: any[];
  brackets: any[];
};

/** Fake DB whose transaction() snapshots state and rolls back when the callback throws. */
function fakeDb(initial: Partial<State> = {}) {
  let state: State = {
    category: { id: "c1", eventId: "e1", status: "open" },
    assigned: ["j1", "j2"], models: ["m1", "m2"], votes: [], completions: [], awards: [],
    brackets: [{ medalLabel: "Gold", medalRank: 4, lowLimit: 6, highLimit: 8 }],
    ...initial
  };
  const calls: string[] = [];
  const store: ClosureStore = {
    lockCategory: async () => { calls.push("lock"); return state.category ? { ...state.category } : null; },
    listAssignedJudgeIds: async () => state.assigned,
    listCategoryModelIds: async () => state.models,
    listVotedModelIds: async (j) => [...new Set(state.votes.filter((v) => v.judgeId === j).map((v) => v.modelId))],
    listVotePairs: async () => state.votes.map(({ judgeId, modelId }) => ({ judgeId, modelId })),
    listVotesNewestFirst: async () => state.votes,
    listBrackets: async () => state.brackets,
    upsertCompletion: async (j) => { if (!state.completions.includes(j)) state.completions.push(j); },
    listCompletedJudgeIds: async () => state.completions,
    upsertAwards: async (_c, rows) => { if ((state as any).failAwards) throw new Error("boom"); state.awards = rows; },
    deleteAwards: async () => { state.awards = []; },
    deleteCompletions: async () => { state.completions = []; },
    setStatus: async (_c, s) => { state.category!.status = s; }
  };
  const db = {
    transaction: async (fn: any) => {
      const snap = structuredClone(state);
      try { return await fn({}); } catch (e) { state = snap; throw e; }
    }
  };
  return { db, store, get state() { return state; }, set(over: any) { Object.assign(state, over); }, calls };
}
const makeStore = (f: ReturnType<typeof fakeDb>) => () => f.store;
const allVotes = (judges: string[], models: string[], rank = 4) =>
  judges.flatMap((judgeId) => models.map((modelId) => ({ judgeId, modelId, rank })));

describe("closeCategory - judge path", () => {
  it("locks the category row first", async () => {
    const f = fakeDb({ votes: allVotes(["j1"], ["m1", "m2"]) });
    await closeCategory(f.db, "c1", { judgeId: "j1" }, makeStore(f));
    expect(f.calls[0]).toBe("lock");
  });
  it("409 INCOMPLETE_VOTES with missing counts, no implicit 0 and no completion stored", async () => {
    const f = fakeDb({ votes: allVotes(["j1"], ["m1"]) });
    const err: any = await closeCategory(f.db, "c1", { judgeId: "j1" }, makeStore(f)).catch((e) => e);
    expect(err.status).toBe(409);
    expect(err.code).toBe("INCOMPLETE_VOTES");
    expect(err.details).toMatchObject({ missing: 1, totalModels: 2, missingModelIds: ["m2"] });
    expect(f.state.completions).toEqual([]);
  });
  it("403 when judge not assigned", async () => {
    const f = fakeDb({ votes: allVotes(["stranger"], ["m1", "m2"]) });
    const err: any = await closeCategory(f.db, "c1", { judgeId: "stranger" }, makeStore(f)).catch((e) => e);
    expect(err.status).toBe(403);
  });
  it("pending until all assigned judges completed; stray completions do not count", async () => {
    const f = fakeDb({ votes: allVotes(["j1", "j2"], ["m1", "m2"]), completions: ["ghost"] });
    const r = await closeCategory(f.db, "c1", { judgeId: "j1" }, makeStore(f));
    expect(r).toEqual({ outcome: "pending", allDone: false, totalJudges: 2, completedJudges: 1 });
    expect(f.state.category!.status).toBe("open");
    expect(f.state.awards).toEqual([]);
  });
  it("closes and freezes awards when the last judge completes", async () => {
    const f = fakeDb({ votes: allVotes(["j1", "j2"], ["m1", "m2"], 4) });
    await closeCategory(f.db, "c1", { judgeId: "j1" }, makeStore(f));
    const r = await closeCategory(f.db, "c1", { judgeId: "j2" }, makeStore(f));
    expect(r.outcome).toBe("closed");
    expect(f.state.category!.status).toBe("closed");
    expect(f.state.awards).toEqual([
      { modelId: "m1", totalScore: 8, medalLabel: "Gold", medalRank: 4 },
      { modelId: "m2", totalScore: 8, medalLabel: "Gold", medalRank: 4 }
    ]);
  });
  it("uses the latest vote (newest first) per judge+model", async () => {
    const votes = [{ judgeId: "j1", modelId: "m1", rank: 1 }, { judgeId: "j1", modelId: "m1", rank: 4 }, { judgeId: "j1", modelId: "m2", rank: 0 }];
    const f = fakeDb({ assigned: ["j1"], votes });
    await closeCategory(f.db, "c1", { judgeId: "j1" }, makeStore(f));
    expect(f.state.awards.find((a) => a.modelId === "m1").totalScore).toBe(1);
  });
  it("never closes with zero assigned judges (judge not assigned -> 403)", async () => {
    const f = fakeDb({ assigned: [] });
    await expect(closeCategory(f.db, "c1", { judgeId: "j1" }, makeStore(f))).rejects.toThrow();
    expect(f.state.category!.status).toBe("open");
  });
  it("all-or-nothing: failure while writing awards rolls back completion and status", async () => {
    const f = fakeDb({ assigned: ["j1"], votes: allVotes(["j1"], ["m1", "m2"]) });
    (f.state as any).failAwards = true;
    await expect(closeCategory(f.db, "c1", { judgeId: "j1" }, makeStore(f))).rejects.toThrow("boom");
    expect(f.state.category!.status).toBe("open");
    expect(f.state.completions).toEqual([]);
  });
  it("409 CATEGORY_CLOSED when already closed; 404 when missing", async () => {
    const closed = fakeDb({ category: { id: "c1", eventId: "e1", status: "closed" } });
    expect(((await closeCategory(closed.db, "c1", { judgeId: "j1" }, makeStore(closed)).catch((e) => e)) as any).code).toBe("CATEGORY_CLOSED");
    const none = fakeDb({ category: null });
    expect(((await closeCategory(none.db, "c1", { judgeId: "j1" }, makeStore(none)).catch((e) => e)) as any).status).toBe(404);
  });
});

describe("closeCategory - manager manual path (same award logic)", () => {
  it("closes AND computes awards", async () => {
    const f = fakeDb({ votes: allVotes(["j1", "j2"], ["m1", "m2"], 4) });
    const r = await closeCategory(f.db, "c1", {}, makeStore(f));
    expect(r.outcome).toBe("closed");
    expect(f.state.awards).toHaveLength(2);
    expect(f.state.category!.status).toBe("closed");
  });
  it("refuses with zero assigned judges", async () => {
    const f = fakeDb({ assigned: [] });
    const err: any = await closeCategory(f.db, "c1", {}, makeStore(f)).catch((e) => e);
    expect(err.status).toBe(409);
    expect(err.code).toBe("NO_JUDGES");
    expect(f.state.category!.status).toBe("open");
  });
  it("refuses when not all judges voted all models, reports expected/actual", async () => {
    const f = fakeDb({ votes: allVotes(["j1"], ["m1", "m2"]) });
    const err: any = await closeCategory(f.db, "c1", {}, makeStore(f)).catch((e) => e);
    expect(err.status).toBe(409);
    expect(err.details).toMatchObject({ expected: 4, actual: 2 });
    expect(f.state.awards).toEqual([]);
  });
  it("is idempotent on an already closed category", async () => {
    const f = fakeDb({ category: { id: "c1", eventId: "e1", status: "closed" } });
    expect(await closeCategory(f.db, "c1", {}, makeStore(f))).toEqual({ outcome: "already_closed" });
  });
});

describe("reopenCategory", () => {
  it("deletes awards and completions and reopens", async () => {
    const f = fakeDb({ category: { id: "c1", eventId: "e1", status: "closed" }, awards: [{ modelId: "m1" }], completions: ["j1"] });
    expect(await reopenCategory(f.db, "c1", makeStore(f))).toEqual({ reopened: true });
    expect(f.state).toMatchObject({ awards: [], completions: [] });
    expect(f.state.category!.status).toBe("open");
  });
  it("keeps judge progress when the category was already open", async () => {
    const f = fakeDb({ completions: ["j1"] });
    expect(await reopenCategory(f.db, "c1", makeStore(f))).toEqual({ reopened: false });
    expect(f.state.completions).toEqual(["j1"]);
  });
  it("404 on missing category", async () => {
    const f = fakeDb({ category: null });
    expect(((await reopenCategory(f.db, "c1", makeStore(f)).catch((e) => e)) as any).status).toBe(404);
  });
});
