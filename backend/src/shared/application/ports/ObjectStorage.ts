export interface ObjectStorage {
  getUploadUrl(input: { key: string; contentType: string; maxBytes?: number }): Promise<{ uploadUrl: string; publicUrl: string }>;
}

/** Best-effort cleanup capability (kept separate so upload-only consumers need not implement it). */
export interface ObjectDeleter {
  /** Removes the object behind one of our own public URLs. Never throws. */
  deleteObjectByUrl(url: string): Promise<void>;
}
