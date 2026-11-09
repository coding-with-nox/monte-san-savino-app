import { Elysia, t } from "elysia";
import { eq, sql } from "drizzle-orm";
import { applyPage, withPagination } from "../../../shared/infra/http/pagination";
import { requireRole } from "../../../identity/infra/http/role.middleware";
import { tenantMiddleware } from "../../../tenancy/infra/http/tenant.middleware";
import { categoriesTable, modelImagesTable, modelsTable, registrationsTable } from "../persistence/schema";
import { formatModelCode, loadModelCodeFormatSettings } from "./model-code";
import { applyCategoryChange } from "./model-category-change";
import { cleanupUnreferencedImages } from "./model-image-cleanup";
import { isImageUrlAcceptable } from "./model.routes";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Spostamento classe: uuid valido, classe di destinazione esistente e dello stesso evento. */
export async function validateCategoryMove(tenantDb: any, currentCategoryId: string, target: unknown):
  Promise<{ ok: true; changed: boolean } | { ok: false; status: 404 | 409 | 422; error: string }> {
  if (target === undefined || target === currentCategoryId) return { ok: true, changed: false };
  if (typeof target !== "string" || !UUID_RE.test(target)) return { ok: false, status: 422, error: "categoryId must be a valid uuid" };
  const [dest] = await tenantDb.select({ eventId: categoriesTable.eventId }).from(categoriesTable).where(eq(categoriesTable.id, target as any)).limit(1);
  if (!dest) return { ok: false, status: 404, error: "Target class not found" };
  const [src] = await tenantDb.select({ eventId: categoriesTable.eventId }).from(categoriesTable).where(eq(categoriesTable.id, currentCategoryId as any)).limit(1);
  if (src && src.eventId !== dest.eventId) return { ok: false, status: 409, error: "Target class belongs to a different event" };
  return { ok: true, changed: true };
}

export const adminModelsRoutes = new Elysia({ prefix: "/admin/models" })
  .use(tenantMiddleware)
  .use(requireRole("manager"))
  .get("/", async ({ tenantDb, query, set }) => {
    const eventId = query?.eventId ? String(query.eventId) : null;
    const codeFormat = await loadModelCodeFormatSettings(tenantDb);
    const where = eventId ? eq(categoriesTable.eventId, eventId as any) : undefined;
    const base = () => {
      const q = tenantDb
        .select({
          id: modelsTable.id,
          userId: modelsTable.userId,
          categoryId: modelsTable.categoryId,
          name: modelsTable.name,
          description: modelsTable.description,
          code: modelsTable.code,
          imageUrl: modelsTable.imageUrl,
          levelId: modelsTable.levelId,
          displayNumber: modelsTable.displayNumber,
          isTeam: modelsTable.isTeam,
          notes: modelsTable.notes,
          internalNotes: modelsTable.internalNotes,
          categorySeqId: categoriesTable.seqId
        })
        .from(modelsTable);
      // Without eventId keep models whose category is missing (left join); with it the event filter implies inner join.
      return (eventId
        ? q.innerJoin(categoriesTable, eq(categoriesTable.id, modelsTable.categoryId))
        : q.leftJoin(categoriesTable, eq(categoriesTable.id, modelsTable.categoryId))
      ).where(where).$dynamic();
    };
    const result = await withPagination(
      { query: query as any, set: set as any },
      async () => {
        const c = tenantDb.select({ n: sql<number>`count(*)::int` }).from(modelsTable);
        const rows = await (eventId
          ? c.innerJoin(categoriesTable, eq(categoriesTable.id, modelsTable.categoryId)).where(where)
          : c);
        return Number((rows as any[])[0]?.n ?? 0);
      },
      (page) => applyPage(base(), modelsTable.id, page)
    );
    if (!Array.isArray(result)) return result;
    return result.map((row: any) => {
      const { categorySeqId, ...rest } = row;
      return { ...rest, code: formatModelCode(row.code, categorySeqId, row.displayNumber, codeFormat) || null };
    });
  }, {
    detail: {
      summary: "Lista modelli (admin)",
      tags: ["Admin"],
      security: [{ bearerAuth: [] }]
    }
  })
  .put("/:modelId", async ({ tenantDb, params, body, set }) => {
    const [current] = await tenantDb
      .select({ id: modelsTable.id, categoryId: modelsTable.categoryId, imageUrl: modelsTable.imageUrl })
      .from(modelsTable)
      .where(eq(modelsTable.id, params.modelId as any))
      .limit(1);
    if (!current) {
      set.status = 404;
      return { error: "Model not found" };
    }
    if (!isImageUrlAcceptable((body as any).imageUrl)) {
      set.status = 422;
      return { error: "Invalid image url" };
    }
    const move = await validateCategoryMove(tenantDb, current.categoryId, (body as any).categoryId);
    if (!move.ok) {
      set.status = move.status;
      return { error: move.error };
    }
    const updates: Record<string, unknown> = { ...(body as Record<string, unknown>) };
    if (typeof updates.code === "string") {
      const trailingDigits = updates.code.match(/(\d+)\s*$/);
      updates.code = trailingDigits ? Number.parseInt(trailingDigits[1], 10) : null;
    }
    for (const key of ["notes", "internalNotes"] as const) {
      if (typeof updates[key] === "string") updates[key] = (updates[key] as string).trim() || null;
    }
    await tenantDb.transaction(async (tx: any) => {
      if (move.changed) await applyCategoryChange(tx, params.modelId, current.categoryId, (body as any).categoryId);
      await tx.update(modelsTable).set(updates as any).where(eq(modelsTable.id, params.modelId as any));
      if (move.changed) {
        // Mantiene coerente l'iscrizione collegata al modello.
        await tx.update(registrationsTable).set({ categoryId: (body as any).categoryId }).where(eq(registrationsTable.modelId, params.modelId as any));
      }
    });
    const newUrl = (body as any).imageUrl;
    if (newUrl !== undefined && newUrl !== current.imageUrl) await cleanupUnreferencedImages(tenantDb, [current.imageUrl]);
    return { updated: true };
  }, {
    params: t.Object({ modelId: t.String() }),
    body: t.Object({
      name: t.Optional(t.String()),
      categoryId: t.Optional(t.String()),
      description: t.Optional(t.String()),
      code: t.Optional(t.Union([t.Number(), t.String()])),
      imageUrl: t.Optional(t.String()),
      notes: t.Optional(t.String({ maxLength: 2000 })),
      internalNotes: t.Optional(t.String({ maxLength: 4000 }))
    }),
    detail: {
      summary: "Aggiorna modello (admin)",
      tags: ["Admin"],
      security: [{ bearerAuth: [] }]
    }
  })
  .delete("/:modelId", async ({ tenantDb, params }) => {
    const [m] = await tenantDb.select({ imageUrl: modelsTable.imageUrl }).from(modelsTable).where(eq(modelsTable.id, params.modelId as any)).limit(1);
    const imgs = await tenantDb.select({ url: modelImagesTable.url }).from(modelImagesTable).where(eq(modelImagesTable.modelId, params.modelId as any));
    await tenantDb.delete(modelsTable).where(eq(modelsTable.id, params.modelId as any));
    await cleanupUnreferencedImages(tenantDb, [m?.imageUrl, ...imgs.map((i: any) => i.url)]);
    return { deleted: true };
  }, {
    params: t.Object({ modelId: t.String() }),
    detail: {
      summary: "Elimina modello (admin)",
      tags: ["Admin"],
      security: [{ bearerAuth: [] }]
    }
  });
