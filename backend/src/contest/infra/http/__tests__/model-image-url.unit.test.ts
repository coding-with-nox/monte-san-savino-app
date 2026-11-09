import { afterEach, describe, expect, it } from "bun:test";
import { isImageUrlAcceptable } from "../model.routes";

const saved = { p: process.env.MINIO_PUBLIC_URL, b: process.env.MINIO_BUCKET };
afterEach(() => {
  for (const [k, v] of [["MINIO_PUBLIC_URL", saved.p], ["MINIO_BUCKET", saved.b]] as const) {
    if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
});

describe("isImageUrlAcceptable", () => {
  it("uses dev default (localhost:9000/models) when env unset", () => {
    delete process.env.MINIO_PUBLIC_URL; delete process.env.MINIO_BUCKET;
    expect(isImageUrlAcceptable("http://localhost:9000/models/abc/1.png")).toBe(true);
    expect(isImageUrlAcceptable("http://evil.example/models/abc/1.png")).toBe(false);
    expect(isImageUrlAcceptable("http://localhost:9000/other/1.png")).toBe(false);
    expect(isImageUrlAcceptable("javascript:alert(1)")).toBe(false);
  });
  it("accepts publicUrl built like minioStorage with configured env", () => {
    process.env.MINIO_PUBLIC_URL = "https://cdn.example.com"; process.env.MINIO_BUCKET = "b";
    expect(isImageUrlAcceptable("https://cdn.example.com/b/k/x.jpg")).toBe(true);
    expect(isImageUrlAcceptable("http://localhost:9000/b/k/x.jpg")).toBe(false);
    expect(isImageUrlAcceptable("https://cdn.example.com/b/../secret")).toBe(false);
  });
  it("allows absent value, rejects empty string", () => {
    expect(isImageUrlAcceptable(undefined)).toBe(true);
    expect(isImageUrlAcceptable("")).toBe(false);
  });
});
