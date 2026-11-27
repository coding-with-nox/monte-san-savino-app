export interface ModelReadRepository {
  getModelCategory(modelId: string, opts?: { lock?: boolean }): Promise<{ modelId: string; categoryId: string; categoryStatus: string; missing?: boolean } | null>;
  listModelsByCategory(categoryId: string): Promise<{ modelId: string; name: string }[]>;
}
