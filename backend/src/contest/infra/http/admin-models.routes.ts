import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";
import { requireRole } from "../../../identity/infra/http/role.middleware";
import { tenantMiddleware } from "../../../tenancy/infra/http/tenant.middleware";
import { categoriesTable, modelsTable } from "../persistence/schema";
import { formatModelCode, loadModelCodeFormatSettings } from "./model-code";

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
  .put("/:modelId", async ({ tenantDb, params, body }) => {
    const updates: Record<string, unknown> = { ...(body as Record<string, unknown>) };
    if (typeof updates.code === "string") {
      const trailingDigits = updates.code.match(/(\d+)\s*$/);
      updates.code = trailingDigits ? Number.parseInt(trailingDigits[1], 10) : null;
    }
    await tenantDb.update(modelsTable).set(updates as any).where(eq(modelsTable.id, params.modelId as any));
    return { updated: true };
  }, {
    params: t.Object({ modelId: t.String() }),
    body: t.Object({
      name: t.Optional(t.String()),
      categoryId: t.Optional(t.String()),
      description: t.Optional(t.String()),
      code: t.Optional(t.Union([t.Number(), t.String()])),
      imageUrl: t.Optional(t.String())
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
