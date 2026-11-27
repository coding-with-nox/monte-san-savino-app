import { and, eq } from "drizzle-orm";
import { categoriesTable, levelsTable, modelsTable } from "./schema";
import { LEVEL_LOCK_KEY, findLevelLock, parseBooleanSetting, type LevelLock } from "../../domain/levelUp";
import { loadSettingValue } from "./registrationSettings";

/**
 * The level the owner is locked to in the event of `categoryId` (setting lockLevelToFirstSelection), or null.
 * `excludeModelId`: the model being edited, so that it does not lock itself.
 */
export async function findOwnerLevelLock(tenantDb: any, input: {
  ownerId: string;
  categoryId: string;
  levelId: string;
  excludeModelId?: string;
}): Promise<LevelLock | null> {
  if (!parseBooleanSetting(await loadSettingValue(tenantDb, LEVEL_LOCK_KEY))) return null;

  const [category] = await tenantDb
    .select({ eventId: categoriesTable.eventId })
    .from(categoriesTable)
    .where(eq(categoriesTable.id, input.categoryId as any))
    .limit(1);
  if (!category) return null;

  const [requested] = await tenantDb
    .select({ name: levelsTable.name })
    .from(levelsTable)
    .where(eq(levelsTable.id, input.levelId as any))
    .limit(1);

  const owned = await tenantDb
    .select({ id: modelsTable.id, levelId: modelsTable.levelId, levelName: levelsTable.name })
    .from(modelsTable)
    .innerJoin(categoriesTable, eq(categoriesTable.id, modelsTable.categoryId))
    .leftJoin(levelsTable, eq(levelsTable.id, modelsTable.levelId))
    .where(and(eq(modelsTable.userId, input.ownerId as any), eq(categoriesTable.eventId, category.eventId)));

  return findLevelLock({
    requestedLevelId: input.levelId,
    requestedLevelName: requested?.name ?? null,
    ownModels: (owned as any[])
      .filter((m) => m.id !== input.excludeModelId)
      .map((m) => ({ levelId: m.levelId ?? null, levelName: m.levelName ?? null }))
  });
}
