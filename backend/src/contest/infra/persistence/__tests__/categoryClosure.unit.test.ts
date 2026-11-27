import { describe, it, expect } from "bun:test";
import { closeCategory, reconcileCategory, reopenCategory, type ClosureStore } from "../categoryClosure";

type State = {
  category: { id: string; eventId: string; status: string } | null;
  /** Regular judges (event-wide assignments). */
  assigned: string[];
  /** Stand-in judges of category c1. */
  standIns: string[];
  models: string[];
  /** Model owner (default "owner", a user who is not a judge). */
  owners: Record<string, string>;
  votes: { judgeId: string; modelId: string; rank: number }[]; // newest first
  completions: string[]; awards: any[];
  brackets: any[];
  settings: Record<string, string>;
};

/** Fake DB whose transaction() snapshots state and rolls back when the callback throws. */
function fakeDb(initial: Partial<State> = {}) {
  let state: State = {
    category: { id: "c1", eventId: "e1", status: "open" },
    assigned: ["j1", "j2"], standIns: [], models: ["m1", "m2"], owners: {}, votes: [], completions: [], awards: [],
    brackets: [{ medalLabel: "Gold", medalRank: 4, lowLimit: 11, highLimit: 12 }],
    settings: {},
    ...initial
  };
  const calls: string[] = [];
  const store: ClosureStore = {
    lockCategory: async () => { calls.push("lock"); return state.category ? { ...state.category } : null; },
    listEventAssignments: async () => [
      ...state.assigned.map((judgeId) => ({ judgeId, eventId: "e1", categoryId: null, standingIn: false })),
      ...state.standIns.map((judgeId) => ({ judgeId, eventId: "e1", categoryId: "c1", standingIn: true }))
    ],
    listCategoryModels: async () => state.models.map((modelId) => ({ modelId, ownerId: state.owners[modelId] ?? "owner" })),
    listVotedModelIds: async (j) => [...new Set(state.votes.filter((v) => v.judgeId === j).map((v) => v.modelId))],
    listVotesNewestFirst: async () => state.votes,
    listBrackets: async () => state.brackets,
    listSettingValues: async (keys) => Object.fromEntries(Object.entries(state.settings).filter(([k]) => keys.includes(k))),
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
  it("closes and freezes awards when the last judge completes (2 judges, N=3 scaled to 12)", async () => {
    const f = fakeDb({ votes: allVotes(["j1", "j2"], ["m1", "m2"], 4) });
    await closeCategory(f.db, "c1", { judgeId: "j1" }, makeStore(f));
    const r = await closeCategory(f.db, "c1", { judgeId: "j2" }, makeStore(f));
    expect(r.outcome).toBe("closed");
    expect(f.state.category!.status).toBe("closed");
    expect(f.state.awards).toEqual([
      { modelId: "m1", totalScore: 12, medalLabel: "Gold", medalRank: 4, issues: [] },
      { modelId: "m2", totalScore: 12, medalLabel: "Gold", medalRank: 4, issues: [] }
    ]);
  });
  it("uses the latest vote (newest first) per judge+model", async () => {
    const votes = [{ judgeId: "j1", modelId: "m1", rank: 1 }, { judgeId: "j1", modelId: "m1", rank: 4 }, { judgeId: "j1", modelId: "m2", rank: 0 }];
    const f = fakeDb({ assigned: ["j1"], votes });
    await closeCategory(f.db, "c1", { judgeId: "j1" }, makeStore(f));
    expect(f.state.awards.find((a) => a.modelId === "m1").totalScore).toBe(3); // latest rank 1, N=3, one voter
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

describe("closeCategory - judging rules from settings", () => {
  it("uses maxVotesPerExhibitor from settings as N", async () => {
    const f = fakeDb({ assigned: ["j1"], votes: [{ judgeId: "j1", modelId: "m1", rank: 4 }], settings: { maxVotesPerExhibitor: "2" } });
    await closeCategory(f.db, "c1", {}, makeStore(f));
    expect(f.state.awards.find((a) => a.modelId === "m1").totalScore).toBe(8);
  });
  it("invalid settings fall back to the defaults (N=3)", async () => {
    const f = fakeDb({ assigned: ["j1"], votes: [{ judgeId: "j1", modelId: "m1", rank: 4 }], settings: { maxVotesPerExhibitor: "99" } });
    await closeCategory(f.db, "c1", {}, makeStore(f));
    expect(f.state.awards.find((a) => a.modelId === "m1").totalScore).toBe(12);
  });
});

describe("closeCategory - manager manual path", () => {
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
  it("closes with missing votes: unvoted models score 0 and partial votes are flagged", async () => {
    const f = fakeDb({ votes: [{ judgeId: "j1", modelId: "m1", rank: 4 }] });
    const r = await closeCategory(f.db, "c1", {}, makeStore(f));
    expect(r.outcome).toBe("closed");
    expect(f.state.category!.status).toBe("closed");
    expect(f.state.awards).toEqual([
      { modelId: "m1", totalScore: 12, medalLabel: "Gold", medalRank: 4, issues: ["PARTIAL_VOTES"] }, // 1 voter of 2 assigned: round(4*3/1)
      { modelId: "m2", totalScore: 0, medalLabel: "None", medalRank: 0, issues: [] }
    ]);
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

describe("closeCategory - reconciliation (phase 2)", () => {
  it("discordant votes after all counted judges completed: stays open, then a fixing vote closes it", async () => {
    const f = fakeDb({
      assigned: ["j1", "j2", "j3"], models: ["m1"],
      votes: [{ judgeId: "j1", modelId: "m1", rank: 4 }, { judgeId: "j2", modelId: "m1", rank: 4 }, { judgeId: "j3", modelId: "m1", rank: 1 }],
      completions: ["j1", "j2"]
    });
    const r = await closeCategory(f.db, "c1", { judgeId: "j3" }, makeStore(f));
    expect(r).toEqual({ outcome: "reconciliation", allDone: true, totalJudges: 3, completedJudges: 3, discordantModelIds: ["m1"] });
    expect(f.state.category!.status).toBe("open");
    expect(f.state.awards).toEqual([]);

    // j3 changes his vote (newest first): the discordance is gone, so the category closes.
    f.state.votes.unshift({ judgeId: "j3", modelId: "m1", rank: 4 });
    expect(await reconcileCategory(f.db, "c1", makeStore(f))).toEqual({ closed: true });
    expect(f.state.category!.status).toBe("closed");
    expect(f.state.awards).toEqual([{ modelId: "m1", totalScore: 12, medalLabel: "Gold", medalRank: 4, issues: [] }]);
  });

  it("reconcileCategory keeps the category open while discordance remains, and ignores closed categories", async () => {
    const f = fakeDb({
      assigned: ["j1", "j2", "j3"], models: ["m1"],
      votes: [{ judgeId: "j1", modelId: "m1", rank: 4 }, { judgeId: "j2", modelId: "m1", rank: 4 }, { judgeId: "j3", modelId: "m1", rank: 1 }],
      completions: ["j1", "j2", "j3"]
    });
    expect(await reconcileCategory(f.db, "c1", makeStore(f))).toEqual({ closed: false });
    expect(f.state.category!.status).toBe("open");
    const closed = fakeDb({ category: { id: "c1", eventId: "e1", status: "closed" } });
    expect(await reconcileCategory(closed.db, "c1", makeStore(closed))).toEqual({ closed: false });
  });

  it("a stand-in covers the model of a regular judge: the owner judge is not expected on it", async () => {
    const f = fakeDb({
      assigned: ["j1"], standIns: ["s1"], models: ["m1"], owners: { m1: "j1" },
      votes: [{ judgeId: "s1", modelId: "m1", rank: 4 }]
    });
    // j1 owns m1: he has no expected model, his completion is recorded but the stand-in is the only counted judge.
    const first = await closeCategory(f.db, "c1", { judgeId: "j1" }, makeStore(f));
    expect(first).toEqual({ outcome: "pending", allDone: false, totalJudges: 1, completedJudges: 0 });
    const second = await closeCategory(f.db, "c1", { judgeId: "s1" }, makeStore(f));
    expect(second.outcome).toBe("closed");
    expect(f.state.awards).toEqual([{ modelId: "m1", totalScore: 12, medalLabel: "Gold", medalRank: 4, issues: [] }]);
  });

  it("the owner judge's completion is recorded but the category waits for the counted stand-in", async () => {
    const f = fakeDb({
      assigned: ["j1"], standIns: ["s1"], models: ["m1"], owners: { m1: "j1" },
      votes: [{ judgeId: "j1", modelId: "m1", rank: 4 }]
    });
    // j1 has no vote to give (he owns m1), so no 409; the completion is stored and the category stays open.
    const r = await closeCategory(f.db, "c1", { judgeId: "j1" }, makeStore(f));
    expect(r.outcome).toBe("pending");
    expect(f.state.completions).toEqual(["j1"]);
  });
});
