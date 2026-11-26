import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { cleanupUnreferencedImages, setStorageFactory } from "../model-image-cleanup";
import { MinioStorage } from "../../../../shared/infra/storage/minioStorage";
import { objectKeyFromImageUrl } from "../../../../shared/domain/imageUrl";

const BASE = "http://localhost:9000/models";
const saved = { p: process.env.MINIO_PUBLIC_URL, b: process.env.MINIO_BUCKET };
beforeEach(() => { delete process.env.MINIO_PUBLIC_URL; delete process.env.MINIO_BUCKET; });
afterEach(() => {
  setStorageFactory(null);
  for (const [k, v] of [["MINIO_PUBLIC_URL", saved.p], ["MINIO_BUCKET", saved.b]] as const) {
    if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
});

// Fake db: every select().from().where().limit() resolves to the next queued result set.
function fakeDb(referenced: boolean) {
  const chain: any = { from: () => chain, where: () => chain, limit: async () => (referenced ? [{ id: "x" }] : []) };
  return { select: () => chain };
}
function fakeStorage(fail = false) {
  const deleted: string[] = [];
  return { deleted, storage: {
    getUploadUrl: async () => ({ uploadUrl: "", publicUrl: "" }),
    deleteObjectByUrl: async (u: string) => { deleted.push(u); if (fail) throw new Error("boom"); }
  } };
}

describe("cleanupUnreferencedImages", () => {
  it("deletes own unreferenced urls", async () => {
    const s = fakeStorage(); setStorageFactory(() => s.storage);
    await cleanupUnreferencedImages(fakeDb(false), [`${BASE}/a/1.png`, `${BASE}/a/1.png`, null]);
    expect(s.deleted).toEqual([`${BASE}/a/1.png`]);
  });
  it("skips external urls", async () => {
    const s = fakeStorage(); setStorageFactory(() => s.storage);
    await cleanupUnreferencedImages(fakeDb(false), ["https://evil.example/models/a.png", "http://localhost:9000/other/a.png"]);
    expect(s.deleted).toEqual([]);
  });
  it("skips still-referenced urls", async () => {
    const s = fakeStorage(); setStorageFactory(() => s.storage);
    await cleanupUnreferencedImages(fakeDb(true), [`${BASE}/a/1.png`]);
    expect(s.deleted).toEqual([]);
  });
  it("never propagates storage errors", async () => {
    const s = fakeStorage(true); setStorageFactory(() => s.storage);
    await expect(cleanupUnreferencedImages(fakeDb(false), [`${BASE}/a/1.png`])).resolves.toBeUndefined();
    expect(s.deleted.length).toBe(1);
  });
});

describe("objectKeyFromImageUrl / MinioStorage.deleteObjectByUrl", () => {
  it("extracts key and rejects traversal/external", () => {
    expect(objectKeyFromImageUrl(`${BASE}/m1/a.png`, BASE)).toBe("m1/a.png");
    expect(objectKeyFromImageUrl(`${BASE}/m1/%2e%2e/a.png`, BASE)).toBeNull();
    expect(objectKeyFromImageUrl("http://x.example/models/a.png", BASE)).toBeNull();
    expect(objectKeyFromImageUrl(`${BASE}/`, BASE)).toBeNull();
  });
  it("removes only own keys and swallows minio errors", async () => {
    const st: any = new MinioStorage();
    const removed: string[] = [];
    st.client = { removeObject: async (b: string, k: string) => { removed.push(`${b}/${k}`); throw new Error("down"); } };
    await st.deleteObjectByUrl(`${BASE}/m1/a.png`);
    await st.deleteObjectByUrl("https://evil.example/models/m1/a.png");
    await st.deleteObjectByUrl(`${BASE}/m1/../a.png`);
    expect(removed).toEqual(["models/m1/a.png"]);
  });
});
