import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";
import { requireRole } from "../../../identity/infra/http/role.middleware";
import { tenantMiddleware } from "../../../tenancy/infra/http/tenant.middleware";
import { categoriesTable, modelsTable, registrationsTable } from "../persistence/schema";
import { formatModelCode, loadModelCodeFormatSettings } from "./model-code";
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
  .get("/", async ({ tenantDb, query }) => {
    const eventId = query?.eventId ? String(query.eventId) : null;
    const codeFormat = await loadModelCodeFormatSettings(tenantDb);
    if (!eventId) {
      const rows = await tenantDb
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
        .from(modelsTable)
        .leftJoin(categoriesTable, eq(categoriesTable.id, modelsTable.categoryId));
      return rows.map((row: any) => {
        const { categorySeqId, ...rest } = row;
        return { ...rest, code: formatModelCode(row.code, categorySeqId, row.displayNumber, codeFormat) || null };
      });
    }
    const rows = await tenantDb
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
      .from(modelsTable)
      .innerJoin(categoriesTable, eq(categoriesTable.id, modelsTable.categoryId))
      .where(eq(categoriesTable.eventId, eventId as any));
    return rows.map((row: any) => {
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
      .select({ id: modelsTable.id, categoryId: modelsTable.categoryId })
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
    await tenantDb.update(modelsTable).set(updates as any).where(eq(modelsTable.id, params.modelId as any));
    if (move.changed) {
      // Mantiene coerente l'iscrizione collegata al modello.
      await tenantDb.update(registrationsTable).set({ categoryId: (body as any).categoryId }).where(eq(registrationsTable.modelId, params.modelId as any));
    }
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
    await tenantDb.delete(modelsTable).where(eq(modelsTable.id, params.modelId as any));
    return { deleted: true };
  }, {
    params: t.Object({ modelId: t.String() }),
    detail: {
      summary: "Elimina modello (admin)",
      tags: ["Admin"],
      security: [{ bearerAuth: [] }]
    }
  });
