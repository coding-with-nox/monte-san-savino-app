import { eq, inArray } from "drizzle-orm";
import { CategoryClosedError } from "../../domain/errors";
import { categoriesTable, judgeCompletionsTable, votesTable } from "../persistence/schema";

export interface CategoryChangeStore {
  categoryStatuses(categoryIds: string[]): Promise<{ id: string; status: string }[]>;
  deleteModelVotes(modelId: string): Promise<void>;
  deleteCompletions(categoryId: string): Promise<void>;
}

const drizzleStore = (tx: any): CategoryChangeStore => ({
  async categoryStatuses(ids) {
    return await tx.select({ id: categoriesTable.id, status: categoriesTable.status }).from(categoriesTable).where(inArray(categoriesTable.id, ids as any[]));
  },
  async deleteModelVotes(modelId) { await tx.delete(votesTable).where(eq(votesTable.modelId, modelId as any)); },
  async deleteCompletions(categoryId) { await tx.delete(judgeCompletionsTable).where(eq(judgeCompletionsTable.categoryId, categoryId as any)); }
});

/**
 * Shared side effects of moving a model to another category (owner and admin paths). Must run inside
 * the same transaction as the model update.
 *  - Closed old or new category: 409 CATEGORY_CLOSED (awards are frozen; reopen the category first,
 *    which invalidates awards and completions). Nothing is modified, the throw rolls the tx back.
 *  - Otherwise: the model's votes are deleted and judge completions of the OLD category invalidated.
 */
export async function applyCategoryChange(
  tx: any, modelId: string, oldCategoryId: string, newCategoryId: string,
  store: CategoryChangeStore = drizzleStore(tx)
): Promise<void> {
  const rows = await store.categoryStatuses([oldCategoryId, newCategoryId]);
  if (rows.some((r) => r.status === "closed")) {
    throw new CategoryClosedError("Category is closed: reopen it before moving models in or out of it");
  }
  await store.deleteModelVotes(modelId);
  await store.deleteCompletions(oldCategoryId);
}
