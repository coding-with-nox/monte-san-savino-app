import { describe, it, expect } from "bun:test";
import { computeAwards, evaluateCompletion, judgesWithMissingVotes, latestVotePerJudgeModel, missingVoteModelIds, selectBracket } from "../categoryClosure";

const brackets = [
  { medalLabel: "Bronze", medalRank: 2, lowLimit: 5, highLimit: 9 },
  { medalLabel: "Silver", medalRank: 3, lowLimit: 8, highLimit: 12 }, // overlaps Bronze on 8..9
  { medalLabel: "Gold", medalRank: 4, lowLimit: 13, highLimit: 20 }
];

describe("selectBracket (overlapping brackets: lowest medalRank wins)", () => {
  it("picks the only match", () => {
    expect(selectBracket(brackets, 14)).toEqual({ medalLabel: "Gold", medalRank: 4 });
  });
  it("on overlap picks the lowest medalRank", () => {
    expect(selectBracket(brackets, 9)).toEqual({ medalLabel: "Bronze", medalRank: 2 });
    expect(selectBracket(brackets, 8)).toEqual({ medalLabel: "Bronze", medalRank: 2 });
  });
  it("limits are inclusive", () => {
    expect(selectBracket(brackets, 5).medalLabel).toBe("Bronze");
    expect(selectBracket(brackets, 12).medalLabel).toBe("Silver");
  });
  it("falls back to None/0", () => {
    expect(selectBracket(brackets, 1)).toEqual({ medalLabel: "None", medalRank: 0 });
    expect(selectBracket([], 5)).toEqual({ medalLabel: "None", medalRank: 0 });
  });
});

describe("latestVotePerJudgeModel", () => {
  it("keeps the first (newest) vote per judge+model", () => {
    const out = latestVotePerJudgeModel([
      { judgeId: "j", modelId: "m", rank: 4 },
      { judgeId: "j", modelId: "m", rank: 1 },
      { judgeId: "k", modelId: "m", rank: 2 }
    ]);
    expect(out).toEqual([{ judgeId: "j", modelId: "m", rank: 4 }, { judgeId: "k", modelId: "m", rank: 2 }]);
  });
});

describe("computeAwards", () => {
  it("sums latest votes of the given judges only", () => {
    const votes = [
      { judgeId: "j1", modelId: "a", rank: 4 },
      { judgeId: "j2", modelId: "a", rank: 4 },
      { judgeId: "outsider", modelId: "a", rank: 4 },
      { judgeId: "j1", modelId: "b", rank: 1 },
      { judgeId: "j2", modelId: "b", rank: 1 }
    ];
    const r = computeAwards(["a", "b"], ["j1", "j2"], votes, brackets);
    expect(r).toEqual([
      { modelId: "a", totalScore: 8, medalLabel: "Bronze", medalRank: 2 },
      { modelId: "b", totalScore: 2, medalLabel: "None", medalRank: 0 }
    ]);
  });
});

describe("evaluateCompletion", () => {
  it("counts only assigned judges, distinct", () => {
    expect(evaluateCompletion(["a", "b"], ["a", "a", "stranger"])).toEqual({ totalJudges: 2, completedJudges: 1, allDone: false });
    expect(evaluateCompletion(["a", "b", "b"], ["a", "b"])).toEqual({ totalJudges: 2, completedJudges: 2, allDone: true });
  });
  it("never done with zero assigned judges", () => {
    expect(evaluateCompletion([], [])).toEqual({ totalJudges: 0, completedJudges: 0, allDone: false });
    expect(evaluateCompletion([], ["x"]).allDone).toBe(false);
  });
});

describe("vote coverage helpers", () => {
  it("missingVoteModelIds", () => {
    expect(missingVoteModelIds(["a", "b", "c"], ["b"])).toEqual(["a", "c"]);
  });
  it("judgesWithMissingVotes", () => {
    const pairs = [{ judgeId: "j1", modelId: "a" }, { judgeId: "j1", modelId: "b" }, { judgeId: "j2", modelId: "a" }];
    expect(judgesWithMissingVotes(["j1", "j2"], ["a", "b"], pairs)).toEqual(["j2"]);
    expect(judgesWithMissingVotes(["j1"], ["a", "b"], pairs)).toEqual([]);
  });
});
