import { Client } from "minio";
import { assertProductionSecrets } from "../config/productionEnv";
import { allowedImageBase, objectKeyFromImageUrl } from "../../domain/imageUrl";
import { logger } from "../logger/logger";
import type { ObjectDeleter, ObjectStorage } from "../../application/ports/ObjectStorage";

// Short-lived presigned URL (seconds).
export const UPLOAD_URL_EXPIRY_SECONDS = 120;

export class MinioStorage implements ObjectStorage, ObjectDeleter {
  // Dev-only fallbacks (minioadmin); production requires explicit non-default keys.
  private client = (assertProductionSecrets(process.env, ["MINIO_ACCESS_KEY", "MINIO_SECRET_KEY"]), new Client({
    endPoint: process.env.MINIO_ENDPOINT ?? "localhost",
    port: Number(process.env.MINIO_PORT ?? "9000"),
    useSSL: (process.env.MINIO_SSL ?? "false") === "true",
    accessKey: process.env.MINIO_ACCESS_KEY ?? "minioadmin",
    secretKey: process.env.MINIO_SECRET_KEY ?? "minioadmin"
  }));
  private bucket = process.env.MINIO_BUCKET ?? "models";

  // Bucket creation runs once per process (retried only if it failed).
  private static ensured = new Map<string, Promise<void>>();

  private ensureBucket(): Promise<void> {
    let p = MinioStorage.ensured.get(this.bucket);
    if (!p) {
      p = (async () => {
        if (!(await this.client.bucketExists(this.bucket))) {
          await this.client.makeBucket(this.bucket, "eu-west-1");
        }
      })().catch((err) => {
        MinioStorage.ensured.delete(this.bucket);
        throw err;
      });
      MinioStorage.ensured.set(this.bucket, p);
    }
    return p;
  }

  // NOTE: presignedPutObject cannot sign content-type nor content-length-range, so `contentType`
  // and `maxBytes` are enforced only by the API (allowlist, random key) and not by MinIO.
  // Enforcing them server-side requires presignedPostPolicy (multipart POST), which changes the
  // client upload flow (frontend currently does a PUT).
  async getUploadUrl(input: { key: string; contentType: string; maxBytes?: number }) {
    await this.ensureBucket();
    const uploadUrl = await this.client.presignedPutObject(this.bucket, input.key, UPLOAD_URL_EXPIRY_SECONDS);
    const publicBase = (process.env.MINIO_PUBLIC_URL ?? "http://localhost:9000").replace(/\/+$/, "");
    const publicUrl = `${publicBase}/${this.bucket}/${input.key}`;
    return { uploadUrl, publicUrl };
  }

  async deleteObjectByUrl(url: string): Promise<void> {
    try {
      const key = objectKeyFromImageUrl(url, allowedImageBase());
      if (!key) return; // external or unsafe URL: never touch it
      await this.client.removeObject(this.bucket, key);
    } catch (err) {
      logger.warn({ err: { message: (err as Error)?.message, code: (err as any)?.code } }, "MinIO object cleanup failed");
    }
  }
}
