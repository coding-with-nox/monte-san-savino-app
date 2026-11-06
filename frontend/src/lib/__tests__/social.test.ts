import { describe, it, expect } from "vitest";
import { hasInvalidSocial, safeHttpUrl, socialPayload } from "../social";

describe("social helpers", () => {
  it("accepts http/https and adds https when scheme is missing", () => {
    expect(safeHttpUrl("https://a.com/x")).toBe("https://a.com/x");
    expect(safeHttpUrl("http://a.com")).toBe("http://a.com/");
    expect(safeHttpUrl("a.com/profile")).toBe("https://a.com/profile");
  });

  it("rejects dangerous or malformed values", () => {
    expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpUrl("data:text/html,x")).toBeNull();
    expect(safeHttpUrl("ftp://a.com")).toBeNull();
    expect(safeHttpUrl("not a url")).toBeNull();
    expect(safeHttpUrl("")).toBeNull();
    expect(safeHttpUrl(null)).toBeNull();
  });

  it("detects invalid fields and builds a payload with nulls for empty values", () => {
    expect(hasInvalidSocial({ instagram: "javascript:x" })).toBe(true);
    expect(hasInvalidSocial({ instagram: "", website: "a.com" })).toBe(false);
    expect(socialPayload({ instagram: " ", facebook: " f.com ", website: undefined })).toEqual({
      instagram: null,
      facebook: "f.com",
      website: null,
      patreon: null,
      pinterest: null,
      tiktok: null
    });
    expect(hasInvalidSocial({ tiktok: "javascript:x" })).toBe(true);
    expect(socialPayload({ patreon: " patreon.com/x " }).patreon).toBe("patreon.com/x");
  });
});
