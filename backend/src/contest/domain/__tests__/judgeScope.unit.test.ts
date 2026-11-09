import { describe, it, expect } from "bun:test";
import { buildJudgeScope, canAccessCategory, participantView } from "../judgeScope";

const judge = (assignments: any[]) => buildJudgeScope("judge", assignments);

describe("canAccessCategory", () => {
  it("category-specific assignment", () => {
    const s = judge([{ eventId: "e1", categoryId: "c1" }]);
    expect(canAccessCategory(s, { id: "c1", eventId: "e1" })).toBe(true);
    expect(canAccessCategory(s, { id: "c2", eventId: "e1" })).toBe(false);
  });
  it("event-wide assignment", () => {
    const s = judge([{ eventId: "e1", categoryId: null }]);
    expect(canAccessCategory(s, { id: "any", eventId: "e1" })).toBe(true);
    expect(canAccessCategory(s, { id: "any", eventId: "e2" })).toBe(false);
  });
  it("manager/admin exempt, unassigned judge denied", () => {
    expect(canAccessCategory(buildJudgeScope("manager", []), { id: "c", eventId: "e" })).toBe(true);
    expect(canAccessCategory(buildJudgeScope("admin", []), { id: "c", eventId: "e" })).toBe(true);
    expect(canAccessCategory(judge([]), { id: "c", eventId: "e" })).toBe(false);
  });
});

describe("participantView", () => {
  const models = [
    { categoryId: "c1", eventId: "e1", displayNumber: 7 },
    { categoryId: "c2", eventId: "e1", displayNumber: 3 }
  ];
  it("returns only displayName and displayNumber", () => {
    const v = participantView(judge([{ eventId: "e1", categoryId: "c1" }]), models, { firstName: "Ada", lastName: "Lovelace", ...{ email: "x@y" } } as any);
    expect(v).toEqual({ displayName: "Ada Lovelace", displayNumber: 7 });
    expect(Object.keys(v!).sort()).toEqual(["displayName", "displayNumber"]);
  });
  it("null when the user has no model in an accessible category", () => {
    expect(participantView(judge([{ eventId: "e2", categoryId: null }]), models, null)).toBeNull();
    expect(participantView(judge([]), models, null)).toBeNull();
  });
  it("categoryId narrows the visible models", () => {
    const s = judge([{ eventId: "e1", categoryId: null }]);
    expect(participantView(s, models, null, "c2")?.displayNumber).toBe(3);
    expect(participantView(s, models, null, "nope")).toBeNull();
  });
  it("null displayName when no profile", () => {
    expect(participantView(buildJudgeScope("admin", []), models, null)?.displayName).toBeNull();
  });
});
