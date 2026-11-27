import { Elysia, t } from "elysia";
import { and, desc, eq, ilike, inArray, isNotNull } from "drizzle-orm";
import { requireRole } from "../../../identity/infra/http/role.middleware";
import { tenantMiddleware } from "../../../tenancy/infra/http/tenant.middleware";
import { hasPermission, permissionDenied } from "../../../identity/infra/http/permission.middleware";
import { usersTable } from "../../../identity/infra/persistence/schema";
import { logger } from "../../../shared/infra/logger/logger";
import { checkEnrollmentOpen } from "./enrollment-guard";
import { findOwnerLevelLock } from "../persistence/levelLock";
import type { LevelLock } from "../../domain/levelUp";
import { formatModelCode, loadModelCodeFormatSettings } from "./model-code";
import { isAllowedImageUrl, allowedImageBase } from "../../../shared/domain/imageUrl";
import { countParticipantModels, nextTeamCodeForUser, resolveTeamMembers } from "../persistence/modelTeam";
import { MAX_MODELS_PER_PARTICIPANT } from "../../domain/pricing";
import { modelsTable, modelImagesTable, modelTeamMembersTable, categoriesTable, eventCampaignsTable, teamsTable, votesTable, judgeCompletionsTable } from "../persistence/schema";
import { applyCategoryChange } from "./model-category-change";
import { cleanupUnreferencedImages } from "./model-image-cleanup";

/** True when a client-supplied image URL is absent or allowed (evaluated per request so env changes apply). */
export function isImageUrlAcceptable(url: unknown): boolean {
  return url === undefined || url === null || isAllowedImageUrl(url, allowedImageBase());
}

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
  const [maxRow] = await tenantDb
    .select({ displayNumber: modelsTable.displayNumber })
    .from(modelsTable)
    .where(and(
      inArray(modelsTable.categoryId, eventCategoryIds as any[]),
      isNotNull(modelsTable.displayNumber)
    ))
    .orderBy(desc(modelsTable.displayNumber))
    .limit(1);

  return (maxRow?.displayNumber ?? 0) + 1;
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
  return msg.includes("ux_models_code") || msg.includes("models_code_key") || msg.includes("ux_models_team_code");
}

const teamMembersSchema = () => t.Optional(t.Array(t.Object({
  name: t.String(),
  surname: t.String(),
  roleId: t.Optional(t.String({ format: "uuid" })),
  role: t.Optional(t.String()),
  email: t.Optional(t.String({ format: "email" }))
})));

const membersRequired = { error: "teamMembers required for team models", code: "TEAM_MEMBERS_REQUIRED" };
const invalidRole = { error: "Unknown or missing member role", code: "INVALID_MEMBER_ROLE" };
function levelLockedError(set: any, lock: LevelLock) {
  set.status = 422;
  return {
    error: "The participant already has models at another level in this event",
    code: "LEVEL_LOCKED",
    lockedLevelId: lock.lockedLevelId,
    lockedLevelName: lock.lockedLevelName
  };
}

const modelLimit = {
  error: `Maximum ${MAX_MODELS_PER_PARTICIPANT} models per participant`,
  code: "MODEL_LIMIT",
  limit: MAX_MODELS_PER_PARTICIPANT
};

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
        teamId: modelsTable.teamId,
        teamCode: modelsTable.teamCode,
        displayNumber: modelsTable.displayNumber,
        notes: modelsTable.notes,
        categorySeqId: categoriesTable.seqId
      })
      .from(modelsTable)
      .leftJoin(categoriesTable, eq(categoriesTable.id, modelsTable.categoryId))
      .where(and(...clauses));
    return rows.map((row: any) => {
      const { categorySeqId, ...rest } = row;
      return {
        ...rest,
        code: formatModelCode(row.code, categorySeqId, row.displayNumber, codeFormat, row.teamCode) || null
      };
    });
  }, {
    detail: {
      summary: "Lista modelli",
      tags: ["Models"],
      security: [{ bearerAuth: [] }]
    }
  })
  .post("/", async ({ tenantDb, user, body, set }) => {
    // The model (numbers, codes, limit, pricing) belongs to ownerId, which differs from the caller
    // only when enrolling on behalf of another participant.
    let ownerId = user!.id;
    if (body.userId && body.userId.toLowerCase() !== user!.id.toLowerCase()) {
      if (!(await hasPermission(tenantDb, user!.role, "enrollOnBehalf"))) {
        set.status = 403;
        return permissionDenied;
      }
      const [target] = await tenantDb
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(and(eq(usersTable.id, body.userId as any), eq(usersTable.isActive, true)))
        .limit(1);
      if (!target) {
        set.status = 404;
        return { error: "User not found", code: "USER_NOT_FOUND" };
      }
      ownerId = target.id;
    }

    // Temporal guard: block creation when enrollment period is closed
    // Managers and admins can always create models (spec §5b)
    if (user?.role !== "manager" && user?.role !== "admin") {
      const guard = await checkEnrollmentOpen(tenantDb, body.categoryId, set);
      if (guard.blocked) return (set as any).body;
    }

    if (!isImageUrlAcceptable(body.imageUrl)) {
      set.status = 422;
      return { error: "Invalid image url" };
    }

    const lock = await findOwnerLevelLock(tenantDb, { ownerId, categoryId: body.categoryId, levelId: body.levelId });
    if (lock) return levelLockedError(set, lock);

    if (await countParticipantModels(tenantDb, ownerId, body.categoryId) >= MAX_MODELS_PER_PARTICIPANT) {
      set.status = 409;
      return modelLimit;
    }

    // Team = coauthors declared with the model (teamId is the legacy, separate-team flow)
    if (body.isTeam && !body.teamId && !body.teamMembers?.length) {
      set.status = 422;
      return membersRequired;
    }
    const members = body.isTeam ? await resolveTeamMembers(tenantDb, body.teamMembers ?? []) : [];
    if (!members) {
      set.status = 422;
      return invalidRole;
    }

    if (body.isTeam && body.teamId) {
      // verify team belongs to the model owner
      const [teamRow] = await tenantDb
        .select({ id: teamsTable.id })
        .from(teamsTable)
        .where(and(eq(teamsTable.id, body.teamId as any), eq(teamsTable.userId, ownerId as any)))
        .limit(1);
      if (!teamRow) {
        set.status = 422;
        return { error: "teamId not found or not owned by user" };
      }
    }

    const modelId = crypto.randomUUID();
    let lastError: unknown = null;
    const codeFormat = await loadModelCodeFormatSettings(tenantDb);
    const displayNumber = await computeDisplayNumber(tenantDb, ownerId, body.categoryId, body.levelId);
    const categorySeqId = await getCategorySeqId(tenantDb, body.categoryId);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = await generateModelCode(tenantDb);
      const teamCode = body.isTeam ? await nextTeamCodeForUser(tenantDb, ownerId) : null;
      try {
        await tenantDb.insert(modelsTable).values({
          id: modelId,
          userId: ownerId as any,
          categoryId: body.categoryId,
          levelId: body.levelId,
          name: body.name,
          description: body.description ?? null,
          notes: body.notes?.trim() || null,
          code,
          imageUrl: body.imageUrl ?? null,
          isTeam: body.isTeam ?? false,
          teamId: body.teamId ?? null,
          teamCode,
          displayNumber
        });

        if (members.length) {
          await tenantDb.insert(modelTeamMembersTable).values(
            members.map((m) => ({ id: crypto.randomUUID(), modelId, ...m }))
          );
        }

        if (ownerId !== user!.id) {
          logger.info({ actorId: user!.id, actorRole: user!.role, ownerId, modelId }, "Model created on behalf of another user");
        }

        return {
          id: modelId,
          code: formatModelCode(code, categorySeqId, displayNumber, codeFormat, teamCode)
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
      notes: t.Optional(t.Nullable(t.String({ maxLength: 2000 }))),
      imageUrl: t.Optional(t.String()),
      isTeam: t.Optional(t.Boolean()),
      teamId: t.Optional(t.String()),
      teamMembers: teamMembersSchema(),
      userId: t.Optional(t.String({ format: "uuid" }))
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
        teamId: modelsTable.teamId,
        teamCode: modelsTable.teamCode,
        displayNumber: modelsTable.displayNumber,
        notes: modelsTable.notes,
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

    const { categorySeqId, ...modelRow } = rows[0] as any;
    return {
      model: {
        ...modelRow,
        code: formatModelCode(modelRow.code, categorySeqId, modelRow.displayNumber, codeFormat, modelRow.teamCode) || null
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

    // Temporal guard: block edits when enrollment period is closed
    // Managers and admins can always edit models (spec §5b)
    const model = rows[0] as any;
    if (user?.role !== "manager" && user?.role !== "admin") {
      const guard = await checkEnrollmentOpen(tenantDb, model.categoryId, set);
      if (guard.blocked) return (set as any).body;
    }

    if (!isImageUrlAcceptable(body.imageUrl)) {
      set.status = 422;
      return { error: "Invalid image url" };
    }
    const isTeam = body.isTeam ?? Boolean(model.isTeam);
    const teamId = "teamId" in body ? body.teamId : model.teamId;
    const becomesTeam = isTeam && !model.isTeam;
    const clearsMembers = isTeam && body.teamMembers?.length === 0;
    if (!teamId && (clearsMembers || (becomesTeam && !body.teamMembers?.length))) {
      set.status = 422;
      return membersRequired;
    }
    const members = isTeam && body.teamMembers !== undefined ? await resolveTeamMembers(tenantDb, body.teamMembers) : [];
    if (!members) {
      set.status = 422;
      return invalidRole;
    }
    if (body.categoryId !== undefined && body.categoryId !== model.categoryId) {
      const [from, to] = await Promise.all([model.categoryId, body.categoryId].map((id) =>
        tenantDb.select({ eventId: categoriesTable.eventId }).from(categoriesTable).where(eq(categoriesTable.id, id as any)).limit(1)));
      if (to[0] && to[0].eventId !== from[0]?.eventId
        && await countParticipantModels(tenantDb, user!.id, body.categoryId) >= MAX_MODELS_PER_PARTICIPANT) {
        set.status = 409;
        return modelLimit;
      }
    }
    if (body.teamId) {
      const [teamRow] = await tenantDb
        .select({ id: teamsTable.id })
        .from(teamsTable)
        .where(and(eq(teamsTable.id, body.teamId as any), eq(teamsTable.userId, user!.id as any)))
        .limit(1);
      if (!teamRow) {
        set.status = 422;
        return { error: "teamId not found or not owned by user" };
      }
    }

    // If category changes: votes/completions are cleared (and a closed category rejected) by applyCategoryChange
    const categoryChanged = body.categoryId !== undefined && body.categoryId !== model.categoryId;

    // Level lock: checked only when the level or the event (category) changes; the model itself is excluded.
    const levelChanged = body.levelId !== undefined && body.levelId !== model.levelId;
    if (levelChanged || categoryChanged) {
      const lock = await findOwnerLevelLock(tenantDb, {
        ownerId: user!.id,
        categoryId: body.categoryId ?? model.categoryId,
        levelId: body.levelId ?? model.levelId,
        excludeModelId: model.id
      });
      if (lock) return levelLockedError(set, lock);
    }

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.categoryId !== undefined) updateData.categoryId = body.categoryId;
    if (body.levelId !== undefined) updateData.levelId = body.levelId;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.imageUrl !== undefined) updateData.imageUrl = body.imageUrl;
    if (body.notes !== undefined) updateData.notes = body.notes?.trim() || null;
    if (body.isTeam !== undefined) updateData.isTeam = body.isTeam;
    if ("teamId" in body) updateData.teamId = body.teamId ?? null;
    if (becomesTeam && !model.teamCode) updateData.teamCode = await nextTeamCodeForUser(tenantDb, user!.id);
    if (body.isTeam === false) updateData.teamCode = null;

    await tenantDb.transaction(async (tx: any) => {
      if (categoryChanged) await applyCategoryChange(tx, params.modelId, model.categoryId, body.categoryId!);
      await tx.update(modelsTable).set(updateData).where(eq(modelsTable.id, params.modelId as any));
    });
    if (body.imageUrl !== undefined && body.imageUrl !== model.imageUrl) {
      await cleanupUnreferencedImages(tenantDb, [model.imageUrl]);
    }

    if (body.teamMembers !== undefined || body.isTeam === false) {
      await tenantDb.delete(modelTeamMembersTable).where(eq(modelTeamMembersTable.modelId, params.modelId as any));
      if (members.length > 0) {
        await tenantDb.insert(modelTeamMembersTable).values(
          members.map((m) => ({ id: crypto.randomUUID(), modelId: params.modelId, ...m }))
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
      notes: t.Optional(t.Nullable(t.String({ maxLength: 2000 }))),
      imageUrl: t.Optional(t.String()),
      isTeam: t.Optional(t.Boolean()),
      teamId: t.Optional(t.String()),
      teamMembers: teamMembersSchema()
    }),
    detail: {
      summary: "Aggiorna modello",
      tags: ["Models"],
      security: [{ bearerAuth: [] }]
    }
  })
  // Enrollment period guard intentionally omitted: deletion allowed after close date (spec §5b admin only applies to edits)
  .delete("/:modelId", async ({ tenantDb, user, params, set }) => {
    const rows = await tenantDb
      .select()
      .from(modelsTable)
      .where(and(eq(modelsTable.id, params.modelId as any), eq(modelsTable.userId, user!.id as any)));

    if (!rows.length) { set.status = 404; return { error: "Not found" }; }

    const imgs = await tenantDb.select({ url: modelImagesTable.url }).from(modelImagesTable).where(eq(modelImagesTable.modelId, params.modelId as any));
    await tenantDb.delete(modelTeamMembersTable).where(eq(modelTeamMembersTable.modelId, params.modelId as any));
    await tenantDb.delete(modelImagesTable).where(eq(modelImagesTable.modelId, params.modelId as any));
    await tenantDb.delete(modelsTable).where(eq(modelsTable.id, params.modelId as any));
    await cleanupUnreferencedImages(tenantDb, [(rows[0] as any).imageUrl, ...imgs.map((i: any) => i.url)]);
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
    const existingModel = rows[0] as any;
    if (user?.role !== "manager" && user?.role !== "admin") {
      const guard = await checkEnrollmentOpen(tenantDb, existingModel.categoryId, set);
      if (guard.blocked) return (set as any).body;
    }
    if (!isAllowedImageUrl(body.url, allowedImageBase())) {
      set.status = 422;
      return { error: "Invalid image url" };
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
    if (!rows.length) { set.status = 404; return { error: "Not found" }; }
    const existingModel = rows[0] as any;
    if (user?.role !== "manager" && user?.role !== "admin") {
      const guard = await checkEnrollmentOpen(tenantDb, existingModel.categoryId, set);
      if (guard.blocked) return (set as any).body;
    }
    const where = and(
      eq(modelImagesTable.id, params.imageId as any),
      eq(modelImagesTable.modelId, params.modelId as any)
    );
    const imgs = await tenantDb.select({ url: modelImagesTable.url }).from(modelImagesTable).where(where);
    await tenantDb.delete(modelImagesTable).where(where);
    await cleanupUnreferencedImages(tenantDb, imgs.map((i: any) => i.url));
    return { deleted: true };
  }, {
    params: t.Object({ modelId: t.String(), imageId: t.String() }),
    detail: {
      summary: "Elimina immagine",
      tags: ["Models"],
      security: [{ bearerAuth: [] }]
    }
  });
