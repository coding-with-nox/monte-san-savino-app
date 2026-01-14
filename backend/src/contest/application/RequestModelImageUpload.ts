import type { ObjectStorage } from "../../shared/application/ports/ObjectStorage";
export class RequestModelImageUpload {
  constructor(private readonly storage: ObjectStorage) {}
  async execute(input: { modelId: string; contentType: string }) {
    const key = `models/${input.modelId}`;
    return await this.storage.getUploadUrl({ key, contentType: input.contentType });
  }
}
