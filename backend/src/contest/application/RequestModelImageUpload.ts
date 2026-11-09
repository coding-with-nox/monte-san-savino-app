import type { ObjectStorage } from "../../shared/application/ports/ObjectStorage";
import { buildModelImageKey, normalizeImageContentType, resolveMaxImageBytes } from "../../shared/domain/imageUpload";

export class InvalidImageContentTypeError extends Error {
  constructor() { super("contentType must be one of image/jpeg, image/jpg, image/png, image/webp"); }
}

export class RequestModelImageUpload {
  constructor(private readonly storage: ObjectStorage, private readonly maxBytes: number = resolveMaxImageBytes()) {}
  async execute(input: { modelId: string; contentType: string }) {
    const type = normalizeImageContentType(input.contentType);
    if (!type) throw new InvalidImageContentTypeError();
    const key = buildModelImageKey(input.modelId, type.ext);
    return await this.storage.getUploadUrl({ key, contentType: type.contentType, maxBytes: this.maxBytes });
  }
}
