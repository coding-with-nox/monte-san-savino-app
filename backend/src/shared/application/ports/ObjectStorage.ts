export interface ObjectStorage {
  /**
   * Signed upload form (multipart POST to `uploadUrl` with `fields`, then the file as field "file").
   * The signature binds key, content type and maximum size: the storage refuses anything else.
   */
  getUploadUrl(input: { key: string; contentType: string; maxBytes?: number }): Promise<{ uploadUrl: string; publicUrl: string; fields: Record<string, string> }>;
}

/** Best-effort cleanup capability (kept separate so upload-only consumers need not implement it). */
export interface ObjectDeleter {
  /** Removes the object behind one of our own public URLs. Never throws. */
  deleteObjectByUrl(url: string): Promise<void>;
}
