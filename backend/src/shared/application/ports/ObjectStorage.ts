export interface ObjectStorage {
  getUploadUrl(input: { key: string; contentType: string; maxBytes?: number }): Promise<{ uploadUrl: string; publicUrl: string }>;
}
