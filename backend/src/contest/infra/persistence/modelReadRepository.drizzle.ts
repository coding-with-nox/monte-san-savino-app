import { eq } from "drizzle-orm";
import { modelsTable } from "./schema";

export class ModelReadRepositoryDrizzle {
  constructor(private readonly db: any) {}
  async getModelCategory(modelId: string) {
    const rows = await this.db.select({ modelId: modelsTable.id, categoryId: modelsTable.categoryId })
      .from(modelsTable)
      .where(eq(modelsTable.id, modelId as any));
    return rows[0] ?? null;
  }
  async listModelsByCategory(categoryId: string) {
    return await this.db.select({ modelId: modelsTable.id, name: modelsTable.name })
      .from(modelsTable)
      .where(eq(modelsTable.categoryId, categoryId as any));
  }
}
