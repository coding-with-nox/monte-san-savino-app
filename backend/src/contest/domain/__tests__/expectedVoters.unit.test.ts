import { describe, it, expect } from "bun:test";
import { assignedJudgeIds, expectedVoterIds, mayVoteModel, regularJudgeIds, standInJudgeIds, type JudgeAssignmentRow } from "../expectedVoters";

const E = "e1";
const C = { id: "c1", eventId: E };
const C2 = { id: "c2", eventId: E };
const reg = (judgeId: string, categoryId: string | null = C.id, eventId = E): JudgeAssignmentRow => ({ judgeId, eventId, categoryId, standingIn: false });
const standIn = (judgeId: string, categoryId = C.id, eventId = E): JudgeAssignmentRow => ({ judgeId, eventId, categoryId, standingIn: true });

describe("regular and stand-in judges of a category", () => {
  const assignments = [
    reg("r1"),                    // category C
    reg("r2", null),              // whole event
    reg("r3", C2.id),             // only C2
    reg("rOther", C.id, "e2"),    // other event
    standIn("s1")                 // stand-in of C
  ];
  it("regular = category or event-wide, same event, not stand-in", () => {
    expect(regularJudgeIds(assignments, C).sort()).toEqual(["r1", "r2"]);
  });
  it("stand-in = category-specific stand-in assignments only", () => {
    expect(standInJudgeIds(assignments, C)).toEqual(["s1"]);
    expect(standInJudgeIds([standIn("s2", C2.id)], C)).toEqual([]);
  });
  it("assigned = every judge covering the category, stand-ins included", () => {
    expect(assignedJudgeIds(assignments, C).sort()).toEqual(["r1", "r2", "s1"]);
  });
});

describe("expectedVoterIds", () => {
  it("model owned by a plain user: regular judges only (no stand-ins)", () => {
    const assignments = [reg("r1"), reg("r2"), standIn("s1")];
    expect(expectedVoterIds(assignments, C, "plainUser").sort()).toEqual(["r1", "r2"]);
  });
  it("model owned by a regular judge: other regular judges plus the stand-ins, never the owner", () => {
    const assignments = [reg("r1"), reg("r2"), standIn("s1"), standIn("s2")];
    expect(expectedVoterIds(assignments, C, "r1").sort()).toEqual(["r2", "s1", "s2"]);
  });
  it("model owned by a stand-in: stand-in is not added and the owner is excluded from regular judges", () => {
    const assignments = [reg("r1"), reg("r2"), standIn("s1")];
    expect(expectedVoterIds(assignments, C, "s1").sort()).toEqual(["r1", "r2"]);
  });
  it("a judge assigned to another category or event is never expected", () => {
    const assignments = [reg("r1"), reg("r3", C2.id), reg("rOther", C.id, "e2")];
    expect(expectedVoterIds(assignments, C, "plainUser")).toEqual(["r1"]);
  });
  it("a judge who is regular and owns the model is not expected on it", () => {
    expect(expectedVoterIds([reg("r1")], C, "r1")).toEqual([]);
  });
});

describe("mayVoteModel (own-model exclusion and stand-in visibility)", () => {
  const assignments = [reg("r1"), reg("r2"), standIn("s1")];
  it("a judge never votes a model he owns", () => {
    expect(mayVoteModel(assignments, "r1", C, "r1")).toBe(false);
    expect(mayVoteModel(assignments, "s1", C, "s1")).toBe(false);
  });
  it("regular judge sees models of other owners in his category", () => {
    expect(mayVoteModel(assignments, "r2", C, "plainUser")).toBe(true);
    expect(mayVoteModel(assignments, "r2", C, "r1")).toBe(true);
  });
  it("stand-in sees ONLY models of the category owned by regular judges", () => {
    expect(mayVoteModel(assignments, "s1", C, "r1")).toBe(true);
    expect(mayVoteModel(assignments, "s1", C, "r2")).toBe(true);
    expect(mayVoteModel(assignments, "s1", C, "plainUser")).toBe(false);
    expect(mayVoteModel(assignments, "s1", C, "s2")).toBe(false);
  });
  it("stand-in sees nothing outside his category", () => {
    expect(mayVoteModel(assignments, "s1", C2, "r1")).toBe(false);
  });
  it("a judge with no assignment on the category cannot vote", () => {
    expect(mayVoteModel(assignments, "stranger", C, "r1")).toBe(false);
  });
  it("multi-class: a judge assigned to two categories votes in both", () => {
    const multi = [reg("m1", C.id), reg("m1", C2.id)];
    expect(mayVoteModel(multi, "m1", C, "plainUser")).toBe(true);
    expect(mayVoteModel(multi, "m1", C2, "plainUser")).toBe(true);
  });
});
