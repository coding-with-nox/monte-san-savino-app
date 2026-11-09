import { describe, it, expect } from "bun:test";
import { buildModelImageKey, isUuid, normalizeImageContentType, resolveMaxImageBytes } from "../imageUpload";
import { allowedImageBase, isAllowedImageUrl } from "../imageUrl";

const ID = "123e4567-e89b-12d3-a456-426614174000";

describe("imageUpload helpers", () => {
  it("validates uuid", () => {
    expect(isUuid(ID)).toBe(true);
    expect(isUuid("../x")).toBe(false);
    expect(isUuid(undefined)).toBe(false);
  });
  it("allowlists content types", () => {
    expect(normalizeImageContentType("image/JPEG")).toEqual({ contentType: "image/jpeg", ext: "jpg" });
    expect(normalizeImageContentType("image/png; charset=x")?.ext).toBe("png");
    expect(normalizeImageContentType("image/webp")?.ext).toBe("webp");
    expect(normalizeImageContentType("text/html")).toBeNull();
    expect(normalizeImageContentType("image/svg+xml")).toBeNull();
    expect(normalizeImageContentType("constructor")).toBeNull();
    expect(normalizeImageContentType(5)).toBeNull();
  });
  it("builds random per-model keys", () => {
    const a = buildModelImageKey(ID, "png");
    const b = buildModelImageKey(ID, "png");
    expect(a).toMatch(new RegExp(`^models/${ID}/[0-9a-f-]{36}\\.png$`));
    expect(a).not.toBe(b);
    expect(() => buildModelImageKey("../evil", "png")).toThrow();
  });
  it("max bytes default 5MB, configurable", () => {
    expect(resolveMaxImageBytes({})).toBe(5 * 1024 * 1024);
    expect(resolveMaxImageBytes({ MAX_IMAGE_BYTES: "1000" })).toBe(1000);
    expect(resolveMaxImageBytes({ MAX_IMAGE_BYTES: "abc" })).toBe(5 * 1024 * 1024);
  });
});

describe("isAllowedImageUrl", () => {
  const base = "https://cdn.example.com/models";
  it("accepts urls under the public base", () => {
    expect(isAllowedImageUrl(`${base}/models/${ID}/a.jpg`, base)).toBe(true);
  });
  it("rejects other hosts, schemes, prefixes and tricks", () => {
    for (const u of [
      "https://evil.com/models/a.jpg",
      "http://cdn.example.com/models/a.jpg",
      "javascript:alert(1)",
      "data:image/png;base64,AAAA",
      "https://cdn.example.com.evil.com/models/a.jpg",
      "https://cdn.example.com/modelsX/a.jpg",
      "https://cdn.example.com/models/",
      "https://cdn.example.com/models/../secret",
      "https://cdn.example.com/models/%2e%2e/secret",
      "https://user:pw@cdn.example.com/models/a.jpg",
      "not a url", "", null
    ]) expect(isAllowedImageUrl(u, base)).toBe(false);
  });
  it("derives base from env", () => {
    expect(allowedImageBase({ MINIO_PUBLIC_URL: "https://x.io/", MINIO_BUCKET: "b" })).toBe("https://x.io/b");
    expect(allowedImageBase({})).toBe("http://localhost:9000/models");
  });
});
