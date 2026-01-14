import { Client } from "minio";
import type { ObjectStorage } from "../../application/ports/ObjectStorage";

export class MinioStorage implements ObjectStorage {
  private client = new Client({
    endPoint: process.env.MINIO_ENDPOINT ?? "localhost",
    port: Number(process.env.MINIO_PORT ?? "9000"),
    useSSL: (process.env.MINIO_SSL ?? "false") === "true",
    accessKey: process.env.MINIO_ACCESS_KEY ?? "minioadmin",
    secretKey: process.env.MINIO_SECRET_KEY ?? "minioadmin"
  });
  private bucket = process.env.MINIO_BUCKET ?? "models";

  async getUploadUrl(input: { key: string; contentType: string }) {
    await this.client.makeBucket(this.bucket, "eu-west-1").catch(() => {});
    const uploadUrl = await this.client.presignedPutObject(this.bucket, input.key, 60 * 5);
    const publicUrl = `${(process.env.MINIO_PUBLIC_URL ?? "http://localhost:9000")}/${this.bucket}/${input.key}`;
    return { uploadUrl, publicUrl };
  }
}
