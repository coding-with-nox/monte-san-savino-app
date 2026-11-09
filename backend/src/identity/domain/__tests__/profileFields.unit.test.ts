import { describe, it, expect } from "bun:test";
import { normalizeCountry, toPublicProfile, normalizeProfilePatch } from "../profileFields";
import { normalizeSocialPatch } from "../../../shared/domain/socialLinks";

describe("country", () => {
  it("normalizes, empties and rejects", () => {
    expect(normalizeCountry("  Italy ")).toEqual({ ok: true, value: "Italy" });
    expect(normalizeCountry("")).toEqual({ ok: true, value: null });
    expect(normalizeCountry(null)).toEqual({ ok: true, value: null });
    expect(normalizeCountry(5).ok).toBe(false);
    expect(normalizeCountry("x".repeat(101)).ok).toBe(false);
    expect(normalizeProfilePatch({}).ok).toBe(true);
  });
});

describe("new social fields", () => {
  it("accept handles and http(s) URLs, reject other schemes", () => {
    const ok = normalizeSocialPatch({ patreon: "@mario", pinterest: "https://pinterest.com/m", tiktok: "m.rossi" } as any);
    expect(ok).toEqual({ ok: true, patch: { patreon: "mario", pinterest: "https://pinterest.com/m", tiktok: "m.rossi" } });
    expect(normalizeSocialPatch({ tiktok: "javascript:alert(1)" } as any).ok).toBe(false);
    expect(normalizeSocialPatch({ patreon: "a b" } as any).ok).toBe(false);
  });
});

describe("toPublicProfile", () => {
  const row = { id: "u1", firstName: "A", country: "IT", instagram: "a", patreon: "p", pinterest: "q", tiktok: "t", facebook: "f", website: "https://w.it", publicProfile: false };
  it("strips country and socials when publicProfile is false/missing", () => {
    for (const r of [row, { ...row, publicProfile: undefined }]) {
      const out = toPublicProfile(r as any);
      expect(out).toEqual({ id: "u1", firstName: "A" });
    }
  });
  it("keeps them when publicProfile is true (flag itself removed)", () => {
    const out: any = toPublicProfile({ ...row, publicProfile: true });
    expect(out.country).toBe("IT");
    expect(out.tiktok).toBe("t");
    expect(out.publicProfile).toBeUndefined();
  });
});
