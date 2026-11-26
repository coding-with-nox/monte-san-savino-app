import { Elysia, t } from "elysia";
import { requireRole } from "../../../identity/infra/http/role.middleware";
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { VoteRepositoryDrizzle } from "../persistence/voteRepository.drizzle";
import { ModelReadRepositoryDrizzle } from "../persistence/modelReadRepository.drizzle";
import { VoteModel } from "../../application/VoteModel";
import { categoriesTable, eventsTable, judgeAssignmentsTable, modelsTable, modelImagesTable, votesTable } from "../persistence/schema";
import { usersTable, userProfilesTable } from "../../../identity/infra/persistence/schema";
import { tenantMiddleware } from "../../../tenancy/infra/http/tenant.middleware";
import { formatModelCode, loadModelCodeFormatSettings } from "./model-code";
import { closeCategory, loadCompletionState, reconcileCategory } from "../persistence/categoryClosure";
import { judgeCanVote, loadCategoryRef, loadJudgeContext, loadJudgeScope, loadModelOwnerId } from "../persistence/judgeAccess";
import { canAccessCategory, participantView } from "../../domain/judgeScope";
import { groupDisplays } from "../../domain/display";
import { VoteDisplay } from "../../application/VoteDisplay";
import { ForbiddenError, NotFoundError, OwnModelError } from "../../domain/errors";
import { domainErrorHandler } from "../../../shared/infra/http/domainErrorHandler";

const uuid = () => t.String({ format: "uuid" });
const rankSchema = () => t.Union([t.Literal(0), t.Literal(1), t.Literal(2), t.Literal(3), t.Literal(4)]);

/** Transaction runner binding the vote repositories to one DB transaction. */
const voteTransaction = (db: any) => (fn: any): Promise<any> =>
  db.transaction((tx: any) => fn({ votes: new VoteRepositoryDrizzle(tx), models: new ModelReadRepositoryDrizzle(tx) }));

/** Judge completion phase from the outcome of closeCategory. */
const phaseOfOutcome = (outcome: string) =>
  outcome === "closed" ? "closed" : outcome === "reconciliation" ? "reconciliation" : "judging";

export const judgeRoutes = new Elysia({ prefix: "/judge" })
  .use(tenantMiddleware)
  .use(requireRole("judge"))
  .use(domainErrorHandler)
  .get("/events", async ({ tenantDb, user }) => {
    const isPrivileged = user!.role === "admin" || user!.role === "manager";
    if (isPrivileged) {
      const rows = await tenantDb.select({ eventId: eventsTable.id, eventName: eventsTable.name }).from(eventsTable);
      return rows;
    }
    // One row per event even when the judge has several category assignments in it.
    return await tenantDb
      .selectDistinct({ eventId: judgeAssignmentsTable.eventId, eventName: eventsTable.name })
      .from(judgeAssignmentsTable)
      .innerJoin(eventsTable, eq(eventsTable.id, judgeAssignmentsTable.eventId))
      .where(eq(judgeAssignmentsTable.judgeId, user!.id as any));
  }, {
    detail: {
      summary: "Eventi assegnati al giudice",
      tags: ["Judging"],
      security: [{ bearerAuth: [] }]
    }
  })
  .get("/models", async ({ tenantDb, query, user }) => {
    const conditions: any[] = [];
    if (query?.eventId) conditions.push(eq(categoriesTable.eventId, query.eventId as any));
    if (query?.categoryId) conditions.push(eq(modelsTable.categoryId, query.categoryId as any));
    const queryBuilder = tenantDb
      .select({
        id: modelsTable.id,
        userId: modelsTable.userId,
        name: modelsTable.name,
        description: modelsTable.description,
        code: modelsTable.code,
        displayNumber: modelsTable.displayNumber,
        teamCode: modelsTable.teamCode,
        categoryId: modelsTable.categoryId,
        categoryName: categoriesTable.name,
        imageUrl: modelsTable.imageUrl,
        eventId: categoriesTable.eventId
      })
      .from(modelsTable)
      .innerJoin(categoriesTable, eq(categoriesTable.id, modelsTable.categoryId));
    const allRows = conditions.length ? await queryBuilder.where(and(...conditions)) : await queryBuilder;
    // Judges only see models they may vote: not their own, and within their assignments (stand-ins: regular owners only).
    const ctx = await loadJudgeContext(tenantDb, user!);
    const rows = allRows
      .filter((row: any) => row.userId !== user!.id && judgeCanVote(ctx, row))
      .map(({ eventId: _eventId, ...rest }: any) => rest);
    if (!rows.length) {
      return [];
    }

    const modelIds = rows.map((row: any) => row.id);
    const votes = await tenantDb
      .select({
        id: votesTable.id,
        modelId: votesTable.modelId,
        rank: votesTable.rank,
        createdAt: votesTable.createdAt
      })
      .from(votesTable)
      .where(
        and(
          eq(votesTable.judgeId, user!.id as any),
          inArray(votesTable.modelId, modelIds as any)
        )
      )
      .orderBy(desc(votesTable.createdAt), desc(votesTable.seq));

    const latestByModel = new Map<string, { currentRank: number; voteCount: number }>();
    for (const vote of votes) {
      const current = latestByModel.get(vote.modelId);
      if (!current) {
        latestByModel.set(vote.modelId, { currentRank: vote.rank, voteCount: 1 });
      } else {
        current.voteCount += 1;
      }
    }

    return rows.map((row: any) => {
      const voteInfo = latestByModel.get(row.id);
      return {
        ...row,
        currentRank: voteInfo?.currentRank ?? null,
        voteCount: voteInfo?.voteCount ?? 0
      };
    });
  }, {
    query: t.Object({ eventId: t.Optional(uuid()), categoryId: t.Optional(uuid()) }),
    detail: {
      summary: "Lista modelli giudicabili",
      description: "Solo modelli di categorie/eventi assegnati al giudice, esclusi quelli di sua proprietà. Filtri opzionali: eventId, categoryId.",
      tags: ["Judging"],
      security: [{ bearerAuth: [] }]
    }
  })
  .get("/models/:modelId/votes", async ({ tenantDb, user, params }) => {
    const repo = new VoteRepositoryDrizzle(tenantDb);
    const votes = await repo.listHistoryByJudgeAndModel(user!.id, params.modelId);
    return votes.map((vote) => ({
      id: vote.id,
      rank: vote.rank,
      createdAt: vote.createdAt.toISOString()
    }));
  }, {
    params: t.Object({ modelId: uuid() }),
    detail: {
      summary: "Storico voti del giudice per modello",
      tags: ["Judging"],
      security: [{ bearerAuth: [] }]
    },
    response: {
      200: t.Array(
        t.Object({
          id: t.String(),
          rank: t.Number(),
          createdAt: t.String()
        })
      )
    }
  })
  .get("/models/:modelId", async ({ tenantDb, params, user }) => {
    const rows = await tenantDb
      .select({
        id: modelsTable.id,
        userId: modelsTable.userId,
        categoryId: modelsTable.categoryId,
        eventId: categoriesTable.eventId,
        code: modelsTable.code,
        imageUrl: modelsTable.imageUrl,
        displayNumber: modelsTable.displayNumber,
        notes: modelsTable.notes,
        teamCode: modelsTable.teamCode,
        categorySeqId: categoriesTable.seqId
      })
      .from(modelsTable)
      .leftJoin(categoriesTable, eq(categoriesTable.id, modelsTable.categoryId))
      .where(eq(modelsTable.id, params.modelId as any));
    if (!rows.length) {
      return { model: null, images: [] };
    }
    if (rows[0].userId === user!.id) throw new OwnModelError();
    const ctx = await loadJudgeContext(tenantDb, user!);
    if (!judgeCanVote(ctx, { categoryId: rows[0].categoryId, eventId: rows[0].eventId as string, userId: rows[0].userId })) {
      throw new ForbiddenError("Judge is not assigned to this category");
    }
    const images = await tenantDb.select().from(modelImagesTable).where(eq(modelImagesTable.modelId, params.modelId as any));
    const codeFormat = await loadModelCodeFormatSettings(tenantDb);
    const { categorySeqId: catSeqId, eventId: _eventId, userId: _owner, ...modelRow } = rows[0] as any;
    return {
      model: {
        ...modelRow,
        code: formatModelCode(modelRow.code, catSeqId, modelRow.displayNumber, codeFormat, modelRow.teamCode) || null
      },
      images
    };
  }, {
    params: t.Object({ modelId: uuid() }),
    detail: {
      summary: "Dettaglio modello giudice",
      description: "403 OWN_MODEL se il modello è del giudice; 403 se fuori scope.",
      tags: ["Judging"],
      security: [{ bearerAuth: [] }]
    }
  })
  .get("/participants/:userId", async ({ tenantDb, params, query, user }) => {
    const models = await tenantDb
      .select({
        categoryId: modelsTable.categoryId,
        eventId: categoriesTable.eventId,
        displayNumber: modelsTable.displayNumber
      })
      .from(modelsTable)
      .innerJoin(categoriesTable, eq(categoriesTable.id, modelsTable.categoryId))
      .where(eq(modelsTable.userId, params.userId as any));
    const scope = await loadJudgeScope(tenantDb, user!);
    // Privacy: no email, no registrations; only name + exhibitor number.
    // Cheap pre-check first so we do not even read the profile of unrelated users.
    if (participantView(scope, models as any, null, query?.categoryId) === null) {
      throw new NotFoundError("Participant not found");
    }
    const [profile] = await tenantDb
      .select({ firstName: userProfilesTable.firstName, lastName: userProfilesTable.lastName })
      .from(usersTable)
      .leftJoin(userProfilesTable, eq(usersTable.id, userProfilesTable.userId))
      .where(eq(usersTable.id, params.userId as any));
    return participantView(scope, models as any, profile ?? null, query?.categoryId)!;
  }, {
    params: t.Object({ userId: uuid() }),
    query: t.Object({ categoryId: t.Optional(uuid()) }),
    detail: {
      summary: "Dettaglio concorrente (solo nome visualizzato e numero espositore)",
      tags: ["Judging"],
      security: [{ bearerAuth: [] }]
    }
  })
  .get("/displays", async ({ tenantDb, query, user }) => {
    const conditions: any[] = [isNotNull(modelsTable.displayNumber)];
    if (query.eventId) conditions.push(eq(categoriesTable.eventId, query.eventId as any));
    if (query.categoryId) conditions.push(eq(modelsTable.categoryId, query.categoryId as any));
    const allRows = await tenantDb
      .select({
        id: modelsTable.id,
        userId: modelsTable.userId,
        name: modelsTable.name,
        code: modelsTable.code,
        teamCode: modelsTable.teamCode,
        displayNumber: modelsTable.displayNumber,
        categoryId: modelsTable.categoryId,
        categoryName: categoriesTable.name,
        categoryStatus: categoriesTable.status,
        categorySeqId: categoriesTable.seqId,
        imageUrl: modelsTable.imageUrl,
        eventId: categoriesTable.eventId
      })
      .from(modelsTable)
      .innerJoin(categoriesTable, eq(categoriesTable.id, modelsTable.categoryId))
      .where(and(...conditions))
      .orderBy(modelsTable.code);
    const ctx = await loadJudgeContext(tenantDb, user!);
    const rows = allRows.filter((row: any) => row.userId !== user!.id && judgeCanVote(ctx, row));
    if (!rows.length) return [];

    const votes = await tenantDb
      .select({ modelId: votesTable.modelId, rank: votesTable.rank })
      .from(votesTable)
      .where(and(eq(votesTable.judgeId, user!.id as any), inArray(votesTable.modelId, rows.map((r: any) => r.id) as any)))
      .orderBy(desc(votesTable.createdAt), desc(votesTable.seq));
    const latest = new Map<string, number>();
    for (const vote of votes) if (!latest.has(vote.modelId)) latest.set(vote.modelId, vote.rank);

    // Discordant models: only in categories in reconciliation (every counted judge completed, votes still discordant).
    const discordant = new Set<string>();
    for (const categoryId of new Set<string>(rows.filter((r: any) => r.categoryStatus === "open").map((r: any) => r.categoryId as string))) {
      const state = await loadCompletionState(tenantDb, categoryId);
      if (state?.phase === "reconciliation") for (const id of state.discordantModelIds) discordant.add(id);
    }

    const codeFormat = await loadModelCodeFormatSettings(tenantDb);
    const models = rows.map((r: any) => ({
      id: r.id as string,
      name: r.name as string,
      code: formatModelCode(r.code, r.categorySeqId, r.displayNumber, codeFormat, r.teamCode) || null,
      categoryId: r.categoryId as string,
      categoryName: r.categoryName as string,
      categoryStatus: r.categoryStatus as string,
      imageUrl: r.imageUrl as string | null,
      eventId: r.eventId as string,
      displayNumber: r.displayNumber as number,
      currentRank: latest.get(r.id) ?? null
    }));
    return groupDisplays(models).map((display) => ({
      ...display,
      // The visible models are exactly those this judge is expected to vote: judged = all open ones are voted.
      judged: display.models.filter((m) => m.categoryStatus === "open").every((m) => latest.has(m.id)),
      issues: display.models.some((m) => discordant.has(m.id)) ? ["DISCORDANT_VOTES"] : [],
      models: display.models.map(({ eventId: _e, displayNumber: _d, ...model }) => model)
    }));
  }, {
    query: t.Object({ eventId: t.Optional(uuid()), categoryId: t.Optional(uuid()) }),
    detail: {
      summary: "Display votabili con i loro modelli",
      description: "Raggruppa per (evento, displayNumber) i soli modelli votabili dal giudice (esclusi i propri). judged: tutti i modelli aperti votati. issues: DISCORDANT_VOTES solo in fase di riconciliazione.",
      tags: ["Judging"],
      security: [{ bearerAuth: [] }]
    }
  })
  .post("/displays/vote", async ({ user, tenantDb, body }) => {
    const db = tenantDb as any;
    const rows = await db
      .select({ id: modelsTable.id, categoryId: modelsTable.categoryId, eventId: categoriesTable.eventId, userId: modelsTable.userId })
      .from(modelsTable)
      .innerJoin(categoriesTable, eq(categoriesTable.id, modelsTable.categoryId))
      .where(and(eq(categoriesTable.eventId, body.eventId as any), eq(modelsTable.displayNumber, body.displayNumber)));
    if (!rows.length) throw new NotFoundError("Display not found");
    // Own models are skipped; 403 only when nothing else remains.
    const others = rows.filter((r: any) => r.userId !== user!.id);
    const ctx = await loadJudgeContext(db, user!);
    const modelIds = others.filter((r: any) => judgeCanVote(ctx, r)).map((r: any) => r.id as string);
    if (!modelIds.length) {
      if (others.length < rows.length) throw new OwnModelError("Judges cannot vote their own models");
      throw new ForbiddenError("Judge is not assigned to this display");
    }
    const result = await new VoteDisplay(voteTransaction(db)).execute({
      judgeId: user!.id,
      modelIds,
      rank: body.rank,
      // Re-checked inside the transaction: the model may have been moved meanwhile.
      authorize: async (model) => {
        const category = await loadCategoryRef(db, model.categoryId);
        const owner = await loadModelOwnerId(db, model.modelId);
        if (!category || !owner) return false;
        if (owner === user!.id) throw new OwnModelError();
        return judgeCanVote(await loadJudgeContext(db, user!), { categoryId: category.id, eventId: category.eventId, userId: owner });
      }
    });
    // Reconciliation: a category whose discordance is gone closes now.
    const categoryOf = new Map<string, string>(rows.map((r: any) => [r.id as string, r.categoryId as string]));
    for (const categoryId of new Set(result.votes.map((v: any) => categoryOf.get(v.modelId)!))) {
      await reconcileCategory(db, categoryId);
    }
    return { eventId: body.eventId, displayNumber: body.displayNumber, rank: body.rank, ...result };
  }, {
    body: t.Object({ eventId: uuid(), displayNumber: t.Integer({ minimum: 0 }), rank: rankSchema() }),
    detail: {
      summary: "Vota un intero display",
      description: "Applica il voto a tutti i modelli votabili del display (esclusi i propri e le categorie chiuse). 404 display inesistente, 403 OWN_MODEL se restano solo modelli propri, 403 fuori scope, 409 tutte le categorie chiuse.",
      tags: ["Judging"],
      security: [{ bearerAuth: [] }]
    }
  })
  // Task 03: expose categories for the category-change request form
  .get("/categories", async ({ tenantDb, query }) => {
    const eventId = query?.eventId ? String(query.eventId) : null;
    if (!eventId) return [];
    return await tenantDb
      .select({ id: categoriesTable.id, name: categoriesTable.name })
      .from(categoriesTable)
      .where(eq(categoriesTable.eventId, eventId as any));
  }, {
    detail: {
      summary: "Categorie per evento (giudice)",
      tags: ["Judging"],
      security: [{ bearerAuth: [] }]
    }
  })
  .post("/categories/:categoryId/complete", async ({ user, tenantDb, params }) => {
    // Judge must be assigned and have voted every model he is expected to vote (409 INCOMPLETE_VOTES otherwise).
    const result = await closeCategory(tenantDb as any, params.categoryId, { judgeId: user!.id });
    if (result.outcome === "already_closed") throw new NotFoundError("Category not found"); // unreachable for judges
    const base = {
      completed: true,
      allDone: result.allDone,
      totalJudges: result.totalJudges,
      completedJudges: result.completedJudges,
      phase: phaseOfOutcome(result.outcome)
    };
    return result.outcome === "reconciliation" ? { ...base, discordantModelIds: result.discordantModelIds } : base;
  }, {
    params: t.Object({ categoryId: uuid() }),
    detail: {
      summary: "Segna giudizio categoria completato",
      description: "409 {code:'INCOMPLETE_VOTES', missing, totalModels, missingModelIds} se il giudice non ha votato tutti i modelli per cui è votante atteso. phase 'reconciliation' con discordantModelIds se restano voti discordanti: la categoria resta aperta finché non si risolvono.",
      tags: ["Judging"],
      security: [{ bearerAuth: [] }]
    }
  })
  .get("/categories/:categoryId/completion", async ({ tenantDb, params, user }) => {
    const { categoryId } = params;
    const state = await loadCompletionState(tenantDb, categoryId);
    if (!state) {
      return { categoryId, status: "open", phase: "judging", totalJudges: 0, completedJudges: 0, allDone: false };
    }
    const scope = await loadJudgeScope(tenantDb, user!);
    if (!canAccessCategory(scope, { id: categoryId, eventId: state.category.eventId })) {
      throw new ForbiddenError("Judge is not assigned to this category");
    }
    return {
      categoryId,
      status: state.category.status as "open" | "closed",
      phase: state.phase,
      totalJudges: state.totalJudges,
      completedJudges: state.completedJudges,
      allDone: state.category.status === "closed" || state.allDone,
      ...(state.phase === "reconciliation" ? { discordantModelIds: state.discordantModelIds } : {})
    };
  }, {
    params: t.Object({ categoryId: uuid() }),
    detail: { summary: "Stato completamento giudici per categoria", description: "phase: judging | reconciliation | closed. discordantModelIds solo in reconciliation.", tags: ["Judging"], security: [{ bearerAuth: [] }] }
  })
  .post("/vote", async ({ user, tenantDb, body }) => {
    const db = tenantDb as any;
    const uc = new VoteModel(
      new VoteRepositoryDrizzle(db),
      new ModelReadRepositoryDrizzle(db),
      voteTransaction(db)
    );
    const result = await uc.execute({
      id: crypto.randomUUID(),
      judgeId: user!.id,
      modelId: body.modelId,
      rank: body.rank,
      authorize: async (model) => {
        const category = await loadCategoryRef(db, model.categoryId);
        const owner = await loadModelOwnerId(db, model.modelId);
        if (!category || !owner) return false;
        if (owner === user!.id) throw new OwnModelError();
        return judgeCanVote(await loadJudgeContext(db, user!), { categoryId: category.id, eventId: category.eventId, userId: owner });
      }
    });
    // Reconciliation: a category whose discordance is gone closes now.
    const [voted] = await db.select({ categoryId: modelsTable.categoryId }).from(modelsTable).where(eq(modelsTable.id, body.modelId as any));
    if (voted) await reconcileCategory(db, voted.categoryId);
    return result;
  }, {
    body: t.Object({ modelId: uuid(), rank: rankSchema() }),
    detail: {
      summary: "Vota un modello",
      description: "Aggiunge un voto (append-only) del giudice per un modello; vale l'ultimo. 404 modello inesistente, 403 OWN_MODEL se il modello è del giudice, 403 giudice non assegnato o stand-in su modello non di un titolare, 409 categoria chiusa.",
      tags: ["Judging"],
      security: [{ bearerAuth: [] }]
    },
    response: {
      200: t.Object({ voteId: t.String(), updated: t.Boolean() })
    }
  });
