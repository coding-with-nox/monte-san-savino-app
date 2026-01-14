export interface ObjectStorage {
  getUploadUrl(input: { key: string; contentType: string }): Promise<{ uploadUrl: string; publicUrl: string }>;
}
