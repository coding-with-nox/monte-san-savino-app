import { describe, it, expect } from "bun:test";
import { normalizeSocialValue, normalizeSocialPatch } from "../socialLinks";

describe("normalizeSocialValue", () => {
  it("accepts handles with or without @ and strips it", () => {
    expect(normalizeSocialValue("instagram", "@mario.rossi")).toEqual({ ok: true, value: "mario.rossi" });
    expect(normalizeSocialValue("facebook", "mario_rossi")).toEqual({ ok: true, value: "mario_rossi" });
  });
  it("treats empty/null as clearing the field", () => {
    expect(normalizeSocialValue("instagram", "  ")).toEqual({ ok: true, value: null });
    expect(normalizeSocialValue("website", null)).toEqual({ ok: true, value: null });
  });
  it("accepts http/https URLs", () => {
    expect(normalizeSocialValue("instagram", "https://instagram.com/mario")).toEqual({ ok: true, value: "https://instagram.com/mario" });
    expect(normalizeSocialValue("website", "http://example.com/x")).toEqual({ ok: true, value: "http://example.com/x" });
  });
  it("prepends https to bare domains for website", () => {
    expect(normalizeSocialValue("website", "example.com")).toEqual({ ok: true, value: "https://example.com/" });
  });
  it("rejects dangerous or non-http schemes", () => {
    for (const bad of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,<b>", "ftp://x.com", "file:///etc/passwd", "vbscript:x"]) {
      for (const field of ["instagram", "facebook", "website"] as const) {
        expect(normalizeSocialValue(field, bad).ok).toBe(false);
      }
    }
  });
  it("rejects whitespace, control chars, credentials and overlong values", () => {
    expect(normalizeSocialValue("instagram", "mario rossi").ok).toBe(false);
    expect(normalizeSocialValue("website", "https://user:pw@example.com").ok).toBe(false);
    expect(normalizeSocialValue("website", "https://example.com/" + "a".repeat(250)).ok).toBe(false);
    expect(normalizeSocialValue("instagram", "a".repeat(201)).ok).toBe(false);
  });
  it("rejects a website that is only a handle", () => {
    expect(normalizeSocialValue("website", "@mario").ok).toBe(false);
  });
  it("normalizeSocialPatch only touches provided keys and reports errors", () => {
    expect(normalizeSocialPatch({ instagram: "@a" })).toEqual({ ok: true, patch: { instagram: "a" } });
    expect(normalizeSocialPatch({ website: "javascript:alert(1)" }).ok).toBe(false);
    expect(normalizeSocialPatch({})).toEqual({ ok: true, patch: {} });
  });
});
