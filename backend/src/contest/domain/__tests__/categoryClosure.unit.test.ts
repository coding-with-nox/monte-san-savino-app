import { describe, it, expect } from "bun:test";
import {
  assessCategory, bracketInputError, categoryPhase, computeAwards, evaluateCompletion, judgeMissingVoteModelIds, latestVotePerJudgeModel,
  judgingSettingsError, MSS_AWARD_BRACKET_PRESET, parseAwardIssues, parseJudgingRules, readyToClose, selectBracket, serializeAwardIssues
} from "../categoryClosure";

const brackets = [
  { medalLabel: "Bronze", medalRank: 2, lowLimit: 5, highLimit: 9 },
  { medalLabel: "Silver", medalRank: 3, lowLimit: 8, highLimit: 12 }, // overlaps Bronze on 8..9
  { medalLabel: "Gold", medalRank: 4, lowLimit: 13, highLimit: 20 }
];

const RULES = { votesPerExhibit: 3, maxDelta: 2 };

/** Every model expects the same judges. */
const all = (modelIds: string[], judgeIds: string[]) => modelIds.map((modelId) => ({ modelId, expectedJudgeIds: judgeIds }));

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

describe("computeAwards (Emperor rules)", () => {
  it("sums latest votes of the given judges only (N=2 with 2 judges)", () => {
    const votes = [
      { judgeId: "j1", modelId: "a", rank: 4 },
      { judgeId: "j2", modelId: "a", rank: 4 },
      { judgeId: "outsider", modelId: "a", rank: 4 },
      { judgeId: "j1", modelId: "b", rank: 1 },
      { judgeId: "j2", modelId: "b", rank: 1 }
    ];
    const r = computeAwards(all(["a", "b"], ["j1", "j2"]), votes, brackets, { votesPerExhibit: 2, maxDelta: 2 });
    expect(r).toEqual([
      { modelId: "a", totalScore: 8, medalLabel: "Bronze", medalRank: 2, issues: [] },
      { modelId: "b", totalScore: 2, medalLabel: "None", medalRank: 0, issues: [] }
    ]);
  });

  it("3 judges, N=3: total is the plain sum, no issues when spread is acceptable", () => {
    const votes = [
      { judgeId: "j1", modelId: "a", rank: 4 },
      { judgeId: "j2", modelId: "a", rank: 4 },
      { judgeId: "j3", modelId: "a", rank: 3 }
    ];
    const [a] = computeAwards(all(["a"], ["j1", "j2", "j3"]), votes, brackets, RULES);
    expect(a).toEqual({ modelId: "a", totalScore: 11, medalLabel: "Silver", medalRank: 3, issues: [] });
  });

  it("2 of 3 judges voted: score is scaled to N and PARTIAL_VOTES is flagged", () => {
    const votes = [
      { judgeId: "j1", modelId: "a", rank: 4 },
      { judgeId: "j2", modelId: "a", rank: 4 }
    ];
    const [a] = computeAwards(all(["a"], ["j1", "j2", "j3"]), votes, brackets, RULES);
    expect(a.totalScore).toBe(12); // round(8 * 3 / 2)
    expect(a.issues).toEqual(["PARTIAL_VOTES"]);
  });

  it("discordant 4,4,1 with D=2 is flagged", () => {
    const votes = [
      { judgeId: "j1", modelId: "a", rank: 4 },
      { judgeId: "j2", modelId: "a", rank: 4 },
      { judgeId: "j3", modelId: "a", rank: 1 }
    ];
    const [a] = computeAwards(all(["a"], ["j1", "j2", "j3"]), votes, brackets, RULES);
    expect(a.totalScore).toBe(9);
    expect(a.issues).toEqual(["DISCORDANT_VOTES"]);
  });

  it("3,3,2 with D=2 is not flagged", () => {
    const votes = [
      { judgeId: "j1", modelId: "a", rank: 3 },
      { judgeId: "j2", modelId: "a", rank: 3 },
      { judgeId: "j3", modelId: "a", rank: 2 }
    ];
    const [a] = computeAwards(all(["a"], ["j1", "j2", "j3"]), votes, brackets, RULES);
    expect(a).toMatchObject({ totalScore: 8, issues: [] });
  });

  it("no votes at all: score 0, None, no issue", () => {
    const [a] = computeAwards(all(["a"], ["j1", "j2", "j3"]), [], brackets, RULES);
    expect(a).toEqual({ modelId: "a", totalScore: 0, medalLabel: "None", medalRank: 0, issues: [] });
  });

  it("rounds the scaled mean half up (1 and 2 with N=3 -> 4.5 -> 5)", () => {
    const votes = [
      { judgeId: "j1", modelId: "a", rank: 1 },
      { judgeId: "j2", modelId: "a", rank: 2 }
    ];
    const [a] = computeAwards(all(["a"], ["j1", "j2"]), votes, brackets, RULES);
    expect(a.totalScore).toBe(5);
    expect(a.medalLabel).toBe("Bronze");
  });

  it("one judge with N=3 scales the single vote by 3", () => {
    const [a] = computeAwards(all(["a"], ["j1", "j2", "j3"]), [{ judgeId: "j1", modelId: "a", rank: 2 }], brackets, RULES);
    expect(a).toMatchObject({ totalScore: 6, issues: ["PARTIAL_VOTES"] });
  });

  it("reports both issues in order", () => {
    const votes = [
      { judgeId: "j1", modelId: "a", rank: 4 },
      { judgeId: "j2", modelId: "a", rank: 0 }
    ];
    const [a] = computeAwards(all(["a"], ["j1", "j2", "j3"]), votes, brackets, RULES);
    expect(a.issues).toEqual(["PARTIAL_VOTES", "DISCORDANT_VOTES"]);
  });
});

describe("judging settings", () => {
  it("parseJudgingRules falls back to defaults (N=3, D=2) when missing", () => {
    expect(parseJudgingRules({})).toEqual({ votesPerExhibit: 3, maxDelta: 2 });
  });
  it("parseJudgingRules reads valid values", () => {
    expect(parseJudgingRules({ maxVotesPerExhibitor: "5", maxVoteDifferent: "0" })).toEqual({ votesPerExhibit: 5, maxDelta: 0 });
    expect(parseJudgingRules({ maxVotesPerExhibitor: "10", maxVoteDifferent: "40" })).toEqual({ votesPerExhibit: 10, maxDelta: 40 });
  });
  it("parseJudgingRules replaces invalid values with defaults", () => {
    for (const bad of ["0", "11", "-1", "2.5", "abc", ""]) {
      expect(parseJudgingRules({ maxVotesPerExhibitor: bad }).votesPerExhibit).toBe(3);
    }
    for (const bad of ["41", "-1", "1e1", "x"]) {
      expect(parseJudgingRules({ maxVoteDifferent: bad }).maxDelta).toBe(2);
    }
  });

  it("judgingSettingsError accepts valid judging keys and ignores other keys", () => {
    expect(judgingSettingsError([["maxVotesPerExhibitor", "1"], ["maxVoteDifferent", "40"], ["app_name", "x"]])).toBeNull();
    expect(judgingSettingsError([["appTheme", "dark"]])).toBeNull();
  });
  it("judgingSettingsError rejects out-of-range or non-integer values", () => {
    expect(judgingSettingsError([["maxVotesPerExhibitor", "0"]])).toMatch(/maxVotesPerExhibitor/);
    expect(judgingSettingsError([["maxVotesPerExhibitor", "11"]])).toMatch(/maxVotesPerExhibitor/);
    expect(judgingSettingsError([["maxVotesPerExhibitor", "2.5"]])).toMatch(/maxVotesPerExhibitor/);
    expect(judgingSettingsError([["maxVoteDifferent", "41"]])).toMatch(/maxVoteDifferent/);
    expect(judgingSettingsError([["maxVoteDifferent", "-1"]])).toMatch(/maxVoteDifferent/);
  });
});

describe("award brackets", () => {
  it("bracketInputError accepts a valid bracket and rejects invalid ones", () => {
    expect(bracketInputError({ medalLabel: "Bronze", medalRank: 2, lowLimit: 5, highLimit: 7 })).toBeNull();
    expect(bracketInputError({ medalLabel: "  ", medalRank: 2, lowLimit: 5, highLimit: 7 })).not.toBeNull();
    expect(bracketInputError({ medalLabel: "x".repeat(41), medalRank: 2, lowLimit: 5, highLimit: 7 })).not.toBeNull();
    expect(bracketInputError({ medalLabel: "Bronze", medalRank: 11, lowLimit: 5, highLimit: 7 })).not.toBeNull();
    expect(bracketInputError({ medalLabel: "Bronze", medalRank: -1, lowLimit: 5, highLimit: 7 })).not.toBeNull();
    expect(bracketInputError({ medalLabel: "Bronze", medalRank: 2, lowLimit: -1, highLimit: 7 })).not.toBeNull();
    expect(bracketInputError({ medalLabel: "Bronze", medalRank: 2, lowLimit: 8, highLimit: 7 })).toMatch(/lowLimit/);
    expect(bracketInputError({ medalLabel: "Bronze", medalRank: 2, lowLimit: 5, highLimit: 2.5 })).not.toBeNull();
  });

  it("MSS preset: exact medals, one bracket per rank 0..4, every bracket valid", () => {
    expect(MSS_AWARD_BRACKET_PRESET.map((b) => [b.medalRank, b.medalLabel, b.lowLimit, b.highLimit])).toEqual([
      [0, "None", 0, 0],
      [1, "Highly Commended", 1, 4],
      [2, "Bronze", 5, 7],
      [3, "Silver", 8, 10],
      [4, "Gold", 11, 12]
    ]);
    for (const b of MSS_AWARD_BRACKET_PRESET) expect(bracketInputError(b)).toBeNull();
  });

  it("MSS preset maps scores to medals (N=3, 3 judges: 0..12)", () => {
    const medal = (score: number) => selectBracket(MSS_AWARD_BRACKET_PRESET, score).medalLabel;
    expect([0, 1, 4, 5, 7, 8, 10, 11, 12].map(medal)).toEqual([
      "None", "Highly Commended", "Highly Commended", "Bronze", "Bronze", "Silver", "Silver", "Gold", "Gold"
    ]);
  });
});

describe("award issues persistence helpers", () => {
  it("serialize: empty => null, otherwise JSON array", () => {
    expect(serializeAwardIssues([])).toBeNull();
    expect(serializeAwardIssues(["PARTIAL_VOTES"])).toBe('["PARTIAL_VOTES"]');
  });
  it("parse: null, malformed or non-array => []", () => {
    expect(parseAwardIssues(null)).toEqual([]);
    expect(parseAwardIssues(undefined)).toEqual([]);
    expect(parseAwardIssues("not json")).toEqual([]);
    expect(parseAwardIssues('{"a":1}')).toEqual([]);
    expect(parseAwardIssues('["DISCORDANT_VOTES"]')).toEqual(["DISCORDANT_VOTES"]);
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
  it("judgeMissingVoteModelIds: only models where the judge is expected and has no vote yet", () => {
    const models = [
      { modelId: "a", expectedJudgeIds: ["j1", "j2"] },
      { modelId: "b", expectedJudgeIds: ["j2"] },
      { modelId: "c", expectedJudgeIds: ["j1"] }
    ];
    expect(judgeMissingVoteModelIds(models, "j1", ["c"])).toEqual(["a"]);
    expect(judgeMissingVoteModelIds(models, "j2", [])).toEqual(["a", "b"]);
    expect(judgeMissingVoteModelIds(models, "stranger", [])).toEqual([]);
  });
});

describe("computeAwards with expected voters", () => {
  it("ranks only from the expected voters of each model (a stand-in is not counted on other models)", () => {
    const models = [
      { modelId: "a", expectedJudgeIds: ["j1", "s"] },
      { modelId: "b", expectedJudgeIds: ["j1"] }
    ];
    const votes = [
      { judgeId: "j1", modelId: "a", rank: 4 },
      { judgeId: "s", modelId: "a", rank: 4 },
      { judgeId: "j1", modelId: "b", rank: 4 },
      { judgeId: "s", modelId: "b", rank: 0 } // stand-in is not expected on b: ignored
    ];
    const [a, b] = computeAwards(models, votes, brackets, RULES);
    expect(a).toMatchObject({ totalScore: 12, issues: [] }); // 2 of 2 expected: round(8*3/2)
    expect(b).toMatchObject({ totalScore: 12, issues: [] }); // 1 of 1 expected
  });
  it("PARTIAL_VOTES is relative to the expected voters, not to all judges of the category", () => {
    const models = [{ modelId: "a", expectedJudgeIds: ["j1"] }];
    const [a] = computeAwards(models, [{ judgeId: "j1", modelId: "a", rank: 4 }], brackets, RULES);
    expect(a.issues).toEqual([]);
  });
});

describe("assessCategory and the reconciliation decision", () => {
  const models = all(["m1", "m2"], ["j1", "j2", "j3"]);
  const v = (judgeId: string, modelId: string, rank: number) => ({ judgeId, modelId, rank });
  const base = { models, brackets, rules: RULES, completedJudgeIds: ["j1", "j2", "j3"] };

  it("all completed and no discordance: ready to close", () => {
    const votes = ["j1", "j2", "j3"].flatMap((j) => [v(j, "m1", 3), v(j, "m2", 4)]);
    const a = assessCategory({ ...base, votes });
    expect(a.completion).toEqual({ totalJudges: 3, completedJudges: 3, allDone: true });
    expect(a.discordantModelIds).toEqual([]);
    expect(categoryPhase("open", a)).toBe("judging");
    expect(readyToClose("open", a)).toBe(true);
  });

  it("all completed but 4,4,1 on m1: reconciliation, stays open, not ready to close", () => {
    const votes = [v("j1", "m1", 4), v("j2", "m1", 4), v("j3", "m1", 1), v("j1", "m2", 3), v("j2", "m2", 3), v("j3", "m2", 3)];
    const a = assessCategory({ ...base, votes });
    expect(a.discordantModelIds).toEqual(["m1"]);
    expect(categoryPhase("open", a)).toBe("reconciliation");
    expect(readyToClose("open", a)).toBe(false);
  });

  it("fixing the discordant vote lifts the reconciliation", () => {
    const votes = [v("j1", "m1", 4), v("j2", "m1", 4), v("j3", "m1", 3), v("j1", "m2", 3), v("j2", "m2", 3), v("j3", "m2", 3)];
    const a = assessCategory({ ...base, votes });
    expect(a.discordantModelIds).toEqual([]);
    expect(readyToClose("open", a)).toBe(true);
  });

  it("discordance without all counted judges completed is still 'judging'", () => {
    const votes = [v("j1", "m1", 4), v("j2", "m1", 4), v("j3", "m1", 1)];
    const a = assessCategory({ ...base, completedJudgeIds: ["j1", "j2"], votes });
    expect(a.completion.allDone).toBe(false);
    expect(categoryPhase("open", a)).toBe("judging");
    expect(readyToClose("open", a)).toBe(false);
  });

  it("a closed category is always phase 'closed' and never ready to close again", () => {
    const a = assessCategory({ ...base, votes: [] });
    expect(categoryPhase("closed", a)).toBe("closed");
    expect(readyToClose("closed", a)).toBe(false);
  });

  it("only counted judges complete the category: a stand-in with no expected model does not block it", () => {
    const expectations = [{ modelId: "m1", expectedJudgeIds: ["j1"] }];
    const votes = [v("j1", "m1", 4)];
    const a = assessCategory({ models: expectations, votes, completedJudgeIds: ["j1", "standin-idle"], brackets, rules: RULES });
    expect(a.completion).toEqual({ totalJudges: 1, completedJudges: 1, allDone: true });
    expect(readyToClose("open", a)).toBe(true);
  });
});
