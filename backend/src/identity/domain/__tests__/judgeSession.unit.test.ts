import { describe, it, expect } from "bun:test";
import { isJudgeSessionOver, judgeSessionEndsAt, judgeSessionHoursFromEnv, refreshCapFor, sessionStartOf } from "../judgeSession";

const HOUR = 3600;

describe("JUDGE_SESSION_HOURS", () => {
  it("defaults to 24 hours when unset or blank", () => {
    expect(judgeSessionHoursFromEnv({})).toBe(24);
    expect(judgeSessionHoursFromEnv({ JUDGE_SESSION_HOURS: "   " })).toBe(24);
  });
  it("accepts whole hours from 1 to 72", () => {
    expect(judgeSessionHoursFromEnv({ JUDGE_SESSION_HOURS: "1" })).toBe(1);
    expect(judgeSessionHoursFromEnv({ JUDGE_SESSION_HOURS: " 72 " })).toBe(72);
  });
  it("rejects anything else with an error naming the variable only", () => {
    for (const value of ["0", "73", "-1", "1.5", "1e1", "abc", "0x10"]) {
      expect(() => judgeSessionHoursFromEnv({ JUDGE_SESSION_HOURS: value })).toThrow(/^JUDGE_SESSION_HOURS must be an integer between 1 and 72$/);
    }
  });
});

describe("judge session window", () => {
  it("sessionStartOf prefers sst and falls back to iat (old tokens)", () => {
    expect(sessionStartOf({ sst: 100, iat: 200 })).toBe(100);
    expect(sessionStartOf({ iat: 200 })).toBe(200);
    expect(sessionStartOf({})).toBeUndefined();
  });

  it("the session ends exactly sst + hours: the instant itself is still valid, one second later is over", () => {
    const sst = 1_000_000;
    expect(judgeSessionEndsAt(sst, 24)).toBe(sst + 24 * HOUR);
    expect(isJudgeSessionOver(sst, 24, sst + 24 * HOUR)).toBe(false);
    expect(isJudgeSessionOver(sst, 24, sst + 24 * HOUR + 1)).toBe(true);
    expect(isJudgeSessionOver(sst, 1, sst + HOUR - 1)).toBe(false);
  });

  it("refreshCapFor caps judges only", () => {
    expect(refreshCapFor("judge", 500, 2)).toEqual({ expiresAt: 500 + 2 * HOUR });
    for (const role of ["user", "staff", "jury_president", "manager", "admin"]) {
      expect(refreshCapFor(role, 500, 2)).toBeUndefined();
    }
  });
});
