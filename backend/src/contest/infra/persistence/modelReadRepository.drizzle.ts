import { eq } from "drizzle-orm";
import { modelsTable, categoriesTable } from "./schema";

export class ModelReadRepositoryDrizzle {
  constructor(private readonly db: any) {}
  async getModelCategory(modelId: string, opts: { lock?: boolean } = {}) {
    const base = this.db
      .select({
        modelId: modelsTable.id,
        categoryId: modelsTable.categoryId,
        categoryStatus: categoriesTable.status
      })
      .from(modelsTable)
      // inner join: FOR SHARE cannot target the nullable side of an outer join (category_id is NOT NULL anyway)
      .innerJoin(categoriesTable, eq(categoriesTable.id, modelsTable.categoryId))
      .where(eq(modelsTable.id, modelId as any));
    const rows = await (opts.lock ? base.for("share", { of: categoriesTable }) : base);
    return rows[0] ?? null;
  }
  async listModelsByCategory(categoryId: string) {
    return await this.db.select({ modelId: modelsTable.id, name: modelsTable.name })
      .from(modelsTable)
      .where(eq(modelsTable.categoryId, categoryId as any));
  }
}
