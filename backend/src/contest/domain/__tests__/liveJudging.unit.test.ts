import { describe, it, expect } from "bun:test";
import { buildLiveJudging, type LiveCategory, type LiveJudgingInput } from "../liveJudging";
import { MSS_AWARD_BRACKET_PRESET } from "../categoryClosure";

const RULES = { votesPerExhibit: 3, maxDelta: 2 };
const cat = (id: string, extra: Partial<LiveCategory> = {}): LiveCategory => ({
  id, name: id.toUpperCase(), status: "open", classNumber: null, presentationOrder: null, ...extra
});

/**
 * Fixture (N=3, D=2, MSS brackets):
 *  - c2 open (presentationOrder 1, classNumber "10"): m1 votes 4 (j1) + 1 (j2) => total 8 Silver, DISCORDANT;
 *    m2 vote 3 (j1) only => total 9 Silver, PARTIAL. Expected 4, cast 3 (j3 is not an expected voter: ignored).
 *  - c3 closed (presentationOrder 1, classNumber "1"): m3 vote 2 (j1) => projected Bronze, but frozen as Gold + None.
 *  - c4 open, no models (presentationOrder 2).
 *  - c1 open, both judges completed, m4 discordant (4 and 1): reconciliation (presentationOrder null, last).
 */
function fixture(): LiveJudgingInput {
  return {
    updatedAt: "2026-11-27T10:00:00.000Z",
    categories: [
      cat("c1", { classNumber: "2" }),
      cat("c2", { classNumber: "10", presentationOrder: 1 }),
      cat("c3", { status: "closed", classNumber: "1", presentationOrder: 1 }),
      cat("c4", { presentationOrder: 2 })
    ],
    models: [
      { modelId: "m1", categoryId: "c2", expectedJudgeIds: ["j1", "j2"] },
      { modelId: "m2", categoryId: "c2", expectedJudgeIds: ["j1", "j2"] },
      { modelId: "m3", categoryId: "c3", expectedJudgeIds: ["j1"] },
      { modelId: "m4", categoryId: "c1", expectedJudgeIds: ["j1", "j2"] }
    ],
    votes: [
      { judgeId: "j1", modelId: "m1", rank: 4 },
      { judgeId: "j2", modelId: "m1", rank: 1 },
      { judgeId: "j1", modelId: "m2", rank: 3 },
      { judgeId: "j3", modelId: "m1", rank: 5 },
      { judgeId: "j1", modelId: "m3", rank: 2 },
      { judgeId: "j1", modelId: "m4", rank: 4 },
      { judgeId: "j2", modelId: "m4", rank: 1 }
    ],
    completions: [
      { categoryId: "c3", judgeId: "j1" },
      { categoryId: "c1", judgeId: "j1" },
      { categoryId: "c1", judgeId: "j2" }
    ],
    frozenAwards: [
      { categoryId: "c3", medalLabel: "Gold" },
      { categoryId: "c3", medalLabel: "None" }
    ],
    brackets: MSS_AWARD_BRACKET_PRESET,
    rules: RULES
  };
}

const byId = <T extends { categoryId: string }>(rows: T[], id: string) => rows.find((r) => r.categoryId === id)!;

describe("buildLiveJudging", () => {
  it("orders classes by presentationOrder, classNumber (numeric), then name; missing order last", () => {
    const r = buildLiveJudging(fixture());
    expect(r.classes.map((c) => c.categoryId)).toEqual(["c3", "c2", "c4", "c1"]);
    expect(r.updatedAt).toBe("2026-11-27T10:00:00.000Z");
  });

  it("open class: percent from expected votes, only expected voters count", () => {
    const c2 = byId(buildLiveJudging(fixture()).classes, "c2");
    expect(c2).toMatchObject({ models: 2, votesExpected: 4, votesCast: 3, percent: 75 });
  });

  it("phase: judging while judges are missing, reconciliation when all completed with discordance, closed when closed", () => {
    const { classes } = buildLiveJudging(fixture());
    expect(byId(classes, "c2").phase).toBe("judging");
    expect(byId(classes, "c1").phase).toBe("reconciliation");
    expect(byId(classes, "c3").phase).toBe("closed");
  });

  it("discordant counts the models with DISCORDANT_VOTES on the current votes (judge outside the expected set is ignored)", () => {
    const { classes } = buildLiveJudging(fixture());
    expect(byId(classes, "c2").discordant).toBe(1);
    expect(byId(classes, "c1").discordant).toBe(1);
    expect(byId(classes, "c3").discordant).toBe(0);
    expect(byId(classes, "c4").discordant).toBe(0);
  });

  it("open class: medals are projected from the current votes with the closing scoring (voters scaled to N)", () => {
    const { classes } = buildLiveJudging(fixture());
    // m1 = round(5*3/2) = 8 Silver; m2 = round(3*3/1) = 9 Silver
    expect(byId(classes, "c2").medals).toEqual({ Silver: 2 });
    expect(byId(classes, "c1").medals).toEqual({ Silver: 1 });
    expect(byId(classes, "c4").medals).toEqual({});
  });

  it("closed class: medals are the frozen awards, not a projection of the votes", () => {
    const c3 = byId(buildLiveJudging(fixture()).classes, "c3");
    // the vote 2 would project Bronze; the frozen awards say Gold and None
    expect(c3.medals).toEqual({ Gold: 1, None: 1 });
    expect(c3).toMatchObject({ models: 1, votesExpected: 1, votesCast: 1, percent: 100, judgesTotal: 1, judgesCompleted: 1 });
  });

  it("a class with no models: zero progress and no percent error", () => {
    expect(byId(buildLiveJudging(fixture()).classes, "c4")).toMatchObject({ models: 0, votesExpected: 0, votesCast: 0, percent: 0, judgesTotal: 0, phase: "judging" });
  });

  it("percent is an integer rounded from the cast/expected ratio", () => {
    const input = fixture();
    input.votes = input.votes.filter((v) => v.modelId !== "m2");
    // c2: 2 of 4 expected => 50; c1 untouched
    expect(byId(buildLiveJudging(input).classes, "c2").percent).toBe(50);
    input.votes.push({ judgeId: "j2", modelId: "m2", rank: 3 });
    // c2: 3 of 4 => 75 (no fraction)
    expect(byId(buildLiveJudging(input).classes, "c2").percent).toBe(75);
  });

  it("totals sum the classes: closed count, models, votes, percent and medals", () => {
    const { totals } = buildLiveJudging(fixture());
    expect(totals).toEqual({
      classes: 4,
      closed: 1,
      models: 4,
      votesCast: 6,
      votesExpected: 7,
      percent: 86,
      medals: { Gold: 1, None: 1, Silver: 3 }
    });
  });

  it("empty event: no classes, zero totals", () => {
    const r = buildLiveJudging({ ...fixture(), categories: [], models: [], votes: [], completions: [], frozenAwards: [] });
    expect(r.classes).toEqual([]);
    expect(r.totals).toEqual({ classes: 0, closed: 0, models: 0, votesCast: 0, votesExpected: 0, percent: 0, medals: {} });
  });
});
