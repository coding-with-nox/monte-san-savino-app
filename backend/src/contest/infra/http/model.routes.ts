import { Elysia, t } from "elysia";
import { and, desc, eq, ilike, isNotNull } from "drizzle-orm";
import { requireRole } from "../../../identity/infra/http/role.middleware";
import { tenantMiddleware } from "../../../tenancy/infra/http/tenant.middleware";
import { formatModelCode, loadModelCodeFormatSettings } from "./model-code";
import { modelsTable, modelImagesTable, modelTeamMembersTable, categoriesTable } from "../persistence/schema";

async function getCategorySeqId(tenantDb: any, categoryId: string): Promise<number | null> {
  const [row] = await tenantDb
    .select({ seqId: categoriesTable.seqId })
    .from(categoriesTable)
    .where(eq(categoriesTable.id, categoryId as any))
    .limit(1);
  return row?.seqId ?? null;
}

async function computeDisplayNumber(tenantDb: any, userId: string, categoryId: string, levelId: string): Promise<number> {
  // Reuse existing displayNumber for same combo (userId, categoryId, levelId)
  const [existing] = await tenantDb
    .select({ displayNumber: modelsTable.displayNumber })
    .from(modelsTable)
    .where(and(
      eq(modelsTable.userId, userId as any),
      eq(modelsTable.categoryId, categoryId as any),
      eq(modelsTable.levelId, levelId as any),
      isNotNull(modelsTable.displayNumber)
    ))
    .limit(1);

  if (existing?.displayNumber != null) return existing.displayNumber;

  // New combo: assign next sequential number within the event
  const [catRow] = await tenantDb
    .select({ eventId: categoriesTable.eventId })
    .from(categoriesTable)
    .where(eq(categoriesTable.id, categoryId as any))
    .limit(1);

  if (!catRow) return 1;

  const eventCategories = await tenantDb
    .select({ id: categoriesTable.id })
    .from(categoriesTable)
    .where(eq(categoriesTable.eventId, catRow.eventId as any));

  const eventCategoryIds = eventCategories.map((r: any) => r.id);
  if (eventCategoryIds.length === 0) return 1;

  // Find max displayNumber among all models in this event
  let maxDisplay = 0;
  for (const catId of eventCategoryIds) {
    const [maxRow] = await tenantDb
      .select({ displayNumber: modelsTable.displayNumber })
      .from(modelsTable)
      .where(and(
        eq(modelsTable.categoryId, catId as any),
        isNotNull(modelsTable.displayNumber)
      ))
      .orderBy(desc(modelsTable.displayNumber))
      .limit(1);
    if (maxRow?.displayNumber != null && maxRow.displayNumber > maxDisplay) {
      maxDisplay = maxRow.displayNumber;
    }
  }

  return maxDisplay + 1;
}

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
    const rows = await tenantDb
      .select({
        id: modelsTable.id,
        name: modelsTable.name,
        description: modelsTable.description,
        code: modelsTable.code,
        categoryId: modelsTable.categoryId,
        levelId: modelsTable.levelId,
        imageUrl: modelsTable.imageUrl,
        isTeam: modelsTable.isTeam,
        displayNumber: modelsTable.displayNumber,
        categorySeqId: categoriesTable.seqId
      })
      .from(modelsTable)
      .leftJoin(categoriesTable, eq(categoriesTable.id, modelsTable.categoryId))
      .where(and(...clauses));
    return rows.map((row: any) => ({
      ...row,
      code: formatModelCode(row.code, row.categorySeqId, row.displayNumber, codeFormat) || null
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
    const displayNumber = await computeDisplayNumber(tenantDb, user!.id, body.categoryId, body.levelId);
    const categorySeqId = await getCategorySeqId(tenantDb, body.categoryId);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = await generateModelCode(tenantDb);
      try {
        await tenantDb.insert(modelsTable).values({
          id: modelId,
          userId: user!.id as any,
          categoryId: body.categoryId,
          levelId: body.levelId,
          name: body.name,
          description: body.description ?? null,
          code,
          imageUrl: body.imageUrl ?? null,
          isTeam: body.isTeam ?? false,
          displayNumber
        });

        if (body.isTeam && body.teamMembers?.length) {
          await tenantDb.insert(modelTeamMembersTable).values(
            body.teamMembers.map((m: any) => ({
              id: crypto.randomUUID(),
              modelId,
              name: m.name,
              surname: m.surname,
              role: m.role
            }))
          );
        }

        return {
          id: modelId,
          code: formatModelCode(code, categorySeqId, displayNumber, codeFormat)
        };
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
      levelId: t.String(),
      description: t.Optional(t.String()),
      imageUrl: t.Optional(t.String()),
      isTeam: t.Optional(t.Boolean()),
      teamMembers: t.Optional(t.Array(t.Object({
        name: t.String(),
        surname: t.String(),
        role: t.String()
      })))
    }),
    detail: {
      summary: "Crea modello",
      tags: ["Models"],
      security: [{ bearerAuth: [] }]
    }
  })
  .get("/:modelId", async ({ tenantDb, user, params, set }) => {
    const rows = await tenantDb
      .select({
        id: modelsTable.id,
        name: modelsTable.name,
        description: modelsTable.description,
        code: modelsTable.code,
        categoryId: modelsTable.categoryId,
        levelId: modelsTable.levelId,
        imageUrl: modelsTable.imageUrl,
        isTeam: modelsTable.isTeam,
        displayNumber: modelsTable.displayNumber,
        categorySeqId: categoriesTable.seqId
      })
      .from(modelsTable)
      .leftJoin(categoriesTable, eq(categoriesTable.id, modelsTable.categoryId))
      .where(and(eq(modelsTable.id, params.modelId as any), eq(modelsTable.userId, user!.id as any)));

    if (!rows.length) { set.status = 404; return { error: "Not found" }; }

    const codeFormat = await loadModelCodeFormatSettings(tenantDb);
    const images = await tenantDb
      .select()
      .from(modelImagesTable)
      .where(eq(modelImagesTable.modelId, params.modelId as any));
    const teamMembers = await tenantDb
      .select()
      .from(modelTeamMembersTable)
      .where(eq(modelTeamMembersTable.modelId, params.modelId as any));

    const row = rows[0] as any;
    return {
      model: {
        ...row,
        code: formatModelCode(row.code, row.categorySeqId, row.displayNumber, codeFormat) || null
      },
      images,
      teamMembers
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

    if (!rows.length) { set.status = 404; return { error: "Not found" }; }

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.categoryId !== undefined) updateData.categoryId = body.categoryId;
    if (body.levelId !== undefined) updateData.levelId = body.levelId;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.imageUrl !== undefined) updateData.imageUrl = body.imageUrl;
    if (body.isTeam !== undefined) updateData.isTeam = body.isTeam;

    await tenantDb.update(modelsTable).set(updateData).where(eq(modelsTable.id, params.modelId as any));

    if (body.teamMembers !== undefined) {
      await tenantDb.delete(modelTeamMembersTable).where(eq(modelTeamMembersTable.modelId, params.modelId as any));
      if (body.teamMembers.length > 0) {
        await tenantDb.insert(modelTeamMembersTable).values(
          body.teamMembers.map((m: any) => ({
            id: crypto.randomUUID(),
            modelId: params.modelId,
            name: m.name,
            surname: m.surname,
            role: m.role
          }))
        );
      }
    }

    return { updated: true };
  }, {
    params: t.Object({ modelId: t.String() }),
    body: t.Object({
      name: t.Optional(t.String()),
      categoryId: t.Optional(t.String()),
      levelId: t.Optional(t.String()),
      description: t.Optional(t.String()),
      imageUrl: t.Optional(t.String()),
      isTeam: t.Optional(t.Boolean()),
      teamMembers: t.Optional(t.Array(t.Object({
        name: t.String(),
        surname: t.String(),
        role: t.String()
      })))
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

    if (!rows.length) { set.status = 404; return { error: "Not found" }; }

    await tenantDb.delete(modelTeamMembersTable).where(eq(modelTeamMembersTable.modelId, params.modelId as any));
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
    if (!rows.length) { set.status = 404; return { error: "Not found" }; }
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
    if (!rows.length) { set.status = 404; return { error: "Not found" }; }
    await tenantDb.delete(modelImagesTable).where(and(
      eq(modelImagesTable.id, params.imageId as any),
      eq(modelImagesTable.modelId, params.modelId as any)
    ));
    return { deleted: true };
  }, {
    params: t.Object({ modelId: t.String(), imageId: t.String() }),
    detail: {
      summary: "Elimina immagine",
      tags: ["Models"],
      security: [{ bearerAuth: [] }]
    }
  });
