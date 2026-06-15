import { describe, it, expect } from "bun:test";
import { Vote } from "../Vote";

describe("Vote.unit", () => {
  it("constructs with all fields set correctly", () => {
    const before = new Date();
    const vote = new Vote("v1", "judge-1", "model-1", 2);
    const after = new Date();

    expect(vote.id).toBe("v1");
    expect(vote.judgeId).toBe("judge-1");
    expect(vote.modelId).toBe("model-1");
    expect(vote.rank).toBe(2);
    expect(vote.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(vote.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it("accepts an explicit createdAt date", () => {
    const date = new Date("2024-01-15T10:00:00Z");
    const vote = new Vote("v2", "judge-2", "model-2", 0, date);
    expect(vote.createdAt).toBe(date);
  });

  it("changeRank updates the rank", () => {
    const vote = new Vote("v3", "judge-3", "model-3", 1);
    vote.changeRank(3);
    expect(vote.rank).toBe(3);
  });

  it("changeRank to 0 sets rank to 0", () => {
    const vote = new Vote("v4", "judge-4", "model-4", 3);
    vote.changeRank(0);
    expect(vote.rank).toBe(0);
  });
});
