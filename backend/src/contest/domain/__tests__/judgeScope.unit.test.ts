import { describe, it, expect } from "bun:test";
import { buildJudgeScope, canAccessCategory } from "../judgeScope";

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
