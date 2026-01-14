export interface ModelReadRepository {
  getModelCategory(modelId: string): Promise<{ modelId: string; categoryId: string } | null>;
  listModelsByCategory(categoryId: string): Promise<{ modelId: string; name: string }[]>;
}
