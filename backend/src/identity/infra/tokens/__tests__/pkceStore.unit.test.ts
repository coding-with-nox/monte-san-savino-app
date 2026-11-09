import { describe, it, expect, afterEach, spyOn } from "bun:test";
import { createAuthCode, consumeAuthCode } from "../pkceStore";

const rec = { codeChallenge: "ch", user: { id: "1", email: "a@b.it", role: "user" } };

describe("pkceStore", () => {
  afterEach(() => { /* restore handled per test */ });
  it("returns the record once, then null (single use)", () => {
    const code = createAuthCode(rec);
    expect(consumeAuthCode(code)?.codeChallenge).toBe("ch");
    expect(consumeAuthCode(code)).toBeNull();
  });
  it("returns null for unknown code and generates unique codes", () => {
    expect(consumeAuthCode("nope")).toBeNull();
    expect(createAuthCode(rec)).not.toBe(createAuthCode(rec));
  });
  it("expires after 5 minutes", () => {
    const now = Date.now();
    const code = createAuthCode(rec);
    const spy = spyOn(Date, "now").mockReturnValue(now + 5 * 60 * 1000 + 1);
    try { expect(consumeAuthCode(code)).toBeNull(); } finally { spy.mockRestore(); }
  });
  it("is still valid just before expiry", () => {
    const now = Date.now();
    const code = createAuthCode(rec);
    const spy = spyOn(Date, "now").mockReturnValue(now + 5 * 60 * 1000 - 1000);
    try { expect(consumeAuthCode(code)).not.toBeNull(); } finally { spy.mockRestore(); }
  });
});
