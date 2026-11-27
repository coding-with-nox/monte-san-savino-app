import { describe, it, expect } from "bun:test";
import {
  generateResetToken, hashResetToken, isResetTokenUsable, resetTokenExpiresAt, RESET_TOKEN_TTL_MS
} from "../passwordReset";

describe("reset token", () => {
  it("is 32 random bytes encoded as URL-safe base64 (43 chars, no padding)", () => {
    const token = generateResetToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(generateResetToken()).not.toBe(token);
  });
  it("is stored only as its sha256 hex digest", () => {
    const token = "example-token";
    const hash = hashResetToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(hashResetToken(token));
    expect(hash).not.toContain(token);
    expect(hashResetToken("other-token")).not.toBe(hash);
  });
});

describe("reset token expiry", () => {
  const now = Date.UTC(2026, 10, 27, 10, 0, 0);
  it("expires 60 minutes after issue", () => {
    expect(RESET_TOKEN_TTL_MS).toBe(60 * 60_000);
    expect(resetTokenExpiresAt(now).getTime()).toBe(now + 60 * 60_000);
  });
  it("is usable only before expiry and only once", () => {
    const expiresAt = resetTokenExpiresAt(now);
    expect(isResetTokenUsable({ expiresAt, usedAt: null }, now)).toBe(true);
    expect(isResetTokenUsable({ expiresAt, usedAt: null }, expiresAt.getTime() - 1)).toBe(true);
    expect(isResetTokenUsable({ expiresAt, usedAt: null }, expiresAt.getTime())).toBe(false);
    expect(isResetTokenUsable({ expiresAt, usedAt: new Date(now) }, now)).toBe(false);
  });
});
