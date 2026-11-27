import { describe, it, expect } from "bun:test";
import { inParticipantRange, parseParticipantRange } from "../participantRange";

describe("parseParticipantRange", () => {
  it("accepts missing bounds (no bound) and empty strings", () => {
    expect(parseParticipantRange({})).toEqual({ ok: true, range: {} });
    expect(parseParticipantRange({ from: "", to: undefined })).toEqual({ ok: true, range: {} });
    expect(parseParticipantRange(undefined)).toEqual({ ok: true, range: {} });
  });

  it("parses inclusive integer bounds, alone or together", () => {
    expect(parseParticipantRange({ from: "3" })).toEqual({ ok: true, range: { from: 3 } });
    expect(parseParticipantRange({ to: "10" })).toEqual({ ok: true, range: { to: 10 } });
    expect(parseParticipantRange({ from: "3", to: "3" })).toEqual({ ok: true, range: { from: 3, to: 3 } });
  });

  it("rejects non-integers, negatives and from > to (422 in the routes)", () => {
    for (const bad of [{ from: "abc" }, { to: "1.5" }, { from: "-1" }, { from: "10", to: "2" }]) {
      expect(parseParticipantRange(bad).ok).toBe(false);
    }
    expect(parseParticipantRange({ from: "10", to: "2" })).toMatchObject({ ok: false, error: "from must be less than or equal to to" });
  });
});

describe("inParticipantRange", () => {
  it("is inclusive on both ends and unbounded when a bound is missing", () => {
    expect(inParticipantRange(5, { from: 5, to: 7 })).toBe(true);
    expect(inParticipantRange(7, { from: 5, to: 7 })).toBe(true);
    expect(inParticipantRange(4, { from: 5, to: 7 })).toBe(false);
    expect(inParticipantRange(8, { from: 5, to: 7 })).toBe(false);
    expect(inParticipantRange(1, {})).toBe(true);
    expect(inParticipantRange(100, { from: 50 })).toBe(true);
    expect(inParticipantRange(40, { to: 50 })).toBe(true);
  });
});
