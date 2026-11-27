import { describe, it, expect } from "bun:test";
import { normalizeUsername, isUsernameIdentifier, USERNAME_MIN_LENGTH, USERNAME_MAX_LENGTH } from "../username";

describe("normalizeUsername", () => {
  it("treats null, undefined and blank as no username", () => {
    expect(normalizeUsername(null)).toEqual({ ok: true, value: null });
    expect(normalizeUsername(undefined)).toEqual({ ok: true, value: null });
    expect(normalizeUsername("   ")).toEqual({ ok: true, value: null });
  });
  it("accepts 3-30 characters from [a-zA-Z0-9._-] and trims them", () => {
    expect(normalizeUsername("  Mario.Rossi_01-x ")).toEqual({ ok: true, value: "Mario.Rossi_01-x" });
    expect(normalizeUsername("a".repeat(USERNAME_MIN_LENGTH))).toEqual({ ok: true, value: "aaa" });
    expect(normalizeUsername("a".repeat(USERNAME_MAX_LENGTH)).ok).toBe(true);
  });
  it("rejects too short and too long names", () => {
    expect(normalizeUsername("ab").ok).toBe(false);
    expect(normalizeUsername("a".repeat(USERNAME_MAX_LENGTH + 1)).ok).toBe(false);
  });
  it("rejects '@' and any character outside the allowed set", () => {
    expect(normalizeUsername("mario@rossi")).toEqual({ ok: false, error: "username cannot contain '@'" });
    expect(normalizeUsername("mario rossi").ok).toBe(false);
    expect(normalizeUsername("mario/rossi").ok).toBe(false);
    expect(normalizeUsername("lalalaà").ok).toBe(false);
  });
  it("rejects non-string values", () => {
    expect(normalizeUsername(42)).toEqual({ ok: false, error: "username must be a string" });
  });
});

describe("isUsernameIdentifier", () => {
  it("treats a login value without '@' as a username and one with '@' as an email", () => {
    expect(isUsernameIdentifier("mario.rossi")).toBe(true);
    expect(isUsernameIdentifier("")).toBe(true);
    expect(isUsernameIdentifier("mario@example.com")).toBe(false);
    expect(isUsernameIdentifier("@example")).toBe(false);
  });
});
