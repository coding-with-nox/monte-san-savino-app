import { describe, it, expect } from "bun:test";
import { socialHref, renderSocialHtml } from "../export.routes";

describe("socialHref", () => {
  it("returns null for empty/whitespace/nullish", () => {
    expect(socialHref("tiktok", "")).toBeNull();
    expect(socialHref("tiktok", "  ")).toBeNull();
    expect(socialHref("tiktok", undefined)).toBeNull();
  });
  it("passes http(s) URLs through, builds handles per network", () => {
    expect(socialHref("facebook", "HTTPS://fb.com/x")).toBe("HTTPS://fb.com/x");
    expect(socialHref("tiktok", "mario")).toBe("https://www.tiktok.com/@mario");
    expect(socialHref("patreon", "mario")).toBe("https://www.patreon.com/mario");
  });
  it("rejects handles with unsafe chars", () => {
    expect(socialHref("instagram", "a b")).toBeNull();
    expect(socialHref("instagram", "ftp://x")).toBeNull();
  });
});

describe("renderSocialHtml", () => {
  it("is empty with no data and joins parts with <br/>", () => {
    expect(renderSocialHtml({})).toBe("");
    const h = renderSocialHtml({ instagram: "mario", website: "https://e.com" });
    expect(h).toContain("IG: <a href=");
    expect(h).toContain("<br/>Web: ");
  });
  it("renders plain escaped text when handle is not linkable", () => {
    expect(renderSocialHtml({ instagram: "a b<" })).toBe("IG: a b&lt;");
  });
});
