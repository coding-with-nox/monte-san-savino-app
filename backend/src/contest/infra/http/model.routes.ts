import { Elysia, t } from "elysia";
import { and, desc, eq, ilike, isNotNull } from "drizzle-orm";
import { requireRole } from "../../../identity/infra/http/role.middleware";
import { tenantMiddleware } from "../../../tenancy/infra/http/tenant.middleware";
import { formatModelCode, loadModelCodeFormatSettings } from "./model-code";
import { modelsTable, modelImagesTable } from "../persistence/schema";

async function generateModelCode(tenantDb: any): Promise<number> {
  const [maxRow] = await tenantDb
    .select({ code: modelsTable.code })
    .from(modelsTable)
    .where(isNotNull(modelsTable.code))
    .orderBy(desc(modelsTable.code))
    .limit(1);

  return Number(maxRow?.code ?? 0) + 1;
}

function isCodeConflict(err: unknown): boolean {
  const msg = String((err as any)?.message ?? "");
  return msg.includes("ux_models_code") || msg.includes("models_code_key");
}

export const modelRoutes = new Elysia({ prefix: "/models" })
  .use(tenantMiddleware)
  .use(requireRole("user"))
  .get("/", async ({ tenantDb, user, query }) => {
    const search = query?.search ? String(query.search) : null;
    const clauses = [eq(modelsTable.userId, user!.id as any)];
    if (search) clauses.push(ilike(modelsTable.name, `%${search}%`));
    const codeFormat = await loadModelCodeFormatSettings(tenantDb);
    const rows = await tenantDb.select().from(modelsTable).where(and(...clauses));
    return rows.map((row: any) => ({
      ...row,
      code: formatModelCode(row.code, codeFormat) || null
    }));
  }, {
    detail: {
      summary: "Lista modelli",
      tags: ["Models"],
      security: [{ bearerAuth: [] }]
    }
  })
  .post("/", async ({ tenantDb, user, body }) => {
    const modelId = crypto.randomUUID();
    let lastError: unknown = null;
    const codeFormat = await loadModelCodeFormatSettings(tenantDb);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = await generateModelCode(tenantDb);
      try {
        await tenantDb.insert(modelsTable).values({
          id: modelId,
          userId: user!.id as any,
          categoryId: body.categoryId,
          teamId: body.teamId ?? null,
          name: body.name,
          description: body.description ?? null,
          code,
          imageUrl: body.imageUrl ?? null
        });
        return { id: modelId, code: formatModelCode(code, codeFormat) };
      } catch (err) {
        if (!isCodeConflict(err)) throw err;
        lastError = err;
      }
    }

    throw lastError ?? new Error("Unable to generate model code");
  }, {
    body: t.Object({
      name: t.String(),
      categoryId: t.String(),
      teamId: t.Optional(t.String()),
      description: t.Optional(t.String()),
      imageUrl: t.Optional(t.String())
    }),
    detail: {
      summary: "Crea modello",
      tags: ["Models"],
      security: [{ bearerAuth: [] }]
    }
  })
  .get("/:modelId", async ({ tenantDb, user, params, set }) => {
    const rows = await tenantDb
      .select()
      .from(modelsTable)
      .where(and(eq(modelsTable.id, params.modelId as any), eq(modelsTable.userId, user!.id as any)));
    if (!rows.length) {
      set.status = 404;
      return { error: "Not found" };
    }
    const codeFormat = await loadModelCodeFormatSettings(tenantDb);
    const images = await tenantDb.select().from(modelImagesTable).where(eq(modelImagesTable.modelId, params.modelId as any));
    return {
      model: {
        ...rows[0],
        code: formatModelCode((rows[0] as any).code, codeFormat) || null
      },
      images
    };
  }, {
    params: t.Object({ modelId: t.String() }),
    detail: {
      summary: "Dettaglio modello",
      tags: ["Models"],
      security: [{ bearerAuth: [] }]
    }
  })
  .put("/:modelId", async ({ tenantDb, user, params, body, set }) => {
    const rows = await tenantDb
      .select()
      .from(modelsTable)
      .where(and(eq(modelsTable.id, params.modelId as any), eq(modelsTable.userId, user!.id as any)));
    if (!rows.length) {
      set.status = 404;
      return { error: "Not found" };
    }
    await tenantDb.update(modelsTable).set(body).where(eq(modelsTable.id, params.modelId as any));
    return { updated: true };
  }, {
    params: t.Object({ modelId: t.String() }),
    body: t.Object({
      name: t.Optional(t.String()),
      categoryId: t.Optional(t.String()),
      teamId: t.Optional(t.String()),
      description: t.Optional(t.String()),
      imageUrl: t.Optional(t.String())
    }),
    detail: {
      summary: "Aggiorna modello",
      tags: ["Models"],
      security: [{ bearerAuth: [] }]
    }
  })
  .delete("/:modelId", async ({ tenantDb, user, params, set }) => {
    const rows = await tenantDb
      .select()
      .from(modelsTable)
      .where(and(eq(modelsTable.id, params.modelId as any), eq(modelsTable.userId, user!.id as any)));
    if (!rows.length) {
      set.status = 404;
      return { error: "Not found" };
    }
    await tenantDb.delete(modelImagesTable).where(eq(modelImagesTable.modelId, params.modelId as any));
    await tenantDb.delete(modelsTable).where(eq(modelsTable.id, params.modelId as any));
    return { deleted: true };
  }, {
    params: t.Object({ modelId: t.String() }),
    detail: {
      summary: "Elimina modello",
      tags: ["Models"],
      security: [{ bearerAuth: [] }]
    }
  })
  .post("/:modelId/images", async ({ tenantDb, user, params, body, set }) => {
    const rows = await tenantDb
      .select()
      .from(modelsTable)
      .where(and(eq(modelsTable.id, params.modelId as any), eq(modelsTable.userId, user!.id as any)));
    if (!rows.length) {
      set.status = 404;
      return { error: "Not found" };
    }
    const imageId = crypto.randomUUID();
    await tenantDb.insert(modelImagesTable).values({ id: imageId, modelId: params.modelId, url: body.url });
    return { id: imageId };
  }, {
    params: t.Object({ modelId: t.String() }),
    body: t.Object({ url: t.String() }),
    detail: {
      summary: "Aggiungi immagine",
      tags: ["Models"],
      security: [{ bearerAuth: [] }]
    }
  })
  .delete("/:modelId/images/:imageId", async ({ tenantDb, user, params, set }) => {
    const rows = await tenantDb
      .select()
      .from(modelsTable)
      .where(and(eq(modelsTable.id, params.modelId as any), eq(modelsTable.userId, user!.id as any)));
    if (!rows.length) {
      set.status = 404;
      return { error: "Not found" };
    }
    await tenantDb.delete(modelImagesTable).where(and(eq(modelImagesTable.id, params.imageId as any), eq(modelImagesTable.modelId, params.modelId as any)));
    return { deleted: true };
  }, {
    params: t.Object({ modelId: t.String(), imageId: t.String() }),
    detail: {
      summary: "Elimina immagine",
      tags: ["Models"],
      security: [{ bearerAuth: [] }]
    }
  });
