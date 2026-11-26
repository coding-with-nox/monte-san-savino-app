import { eq } from "drizzle-orm";
import type { ObjectDeleter } from "../../../shared/application/ports/ObjectStorage";
import { isAllowedImageUrl, allowedImageBase } from "../../../shared/domain/imageUrl";
import { logger } from "../../../shared/infra/logger/logger";
import { MinioStorage } from "../../../shared/infra/storage/minioStorage";
import { modelImagesTable, modelsTable } from "../persistence/schema";

export type StorageFactory = () => ObjectDeleter;
let factory: StorageFactory = () => new MinioStorage();
/** Test hook. */
export function setStorageFactory(f: StorageFactory | null) { factory = f ?? (() => new MinioStorage()); }

/**
 * Post-commit, best effort: deletes the objects behind `urls` unless still referenced by a model or
 * image row. Only our own URLs are considered. Never throws.
 */
export async function cleanupUnreferencedImages(tenantDb: any, urls: (string | null | undefined)[]): Promise<void> {
  try {
    const base = allowedImageBase();
    const candidates = [...new Set(urls.filter((u): u is string => typeof u === "string" && isAllowedImageUrl(u, base)))];
    if (!candidates.length) return;
    const storage = factory();
    for (const url of candidates) {
      try {
        const a = await tenantDb.select({ id: modelsTable.id }).from(modelsTable).where(eq(modelsTable.imageUrl, url)).limit(1);
        if (a.length) continue;
        const b = await tenantDb.select({ id: modelImagesTable.id }).from(modelImagesTable).where(eq(modelImagesTable.url, url)).limit(1);
        if (b.length) continue;
        await storage.deleteObjectByUrl(url);
      } catch (err) {
        logger.warn({ err: { message: (err as Error)?.message } }, "image cleanup failed");
      }
    }
  } catch (err) {
    logger.warn({ err: { message: (err as Error)?.message } }, "image cleanup failed");
  }
}
