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
import { closeCategory, loadCompletionState } from "../persistence/categoryClosure";
import { loadCategoryRef, loadJudgeScope } from "../persistence/judgeAccess";
import { canAccessCategory, participantView } from "../../domain/judgeScope";
import { groupDisplays } from "../../domain/display";
import { VoteDisplay } from "../../application/VoteDisplay";
import { ForbiddenError, NotFoundError } from "../../domain/errors";
import { domainErrorHandler } from "../../../shared/infra/http/domainErrorHandler";

const uuid = () => t.String({ format: "uuid" });
const rankSchema = () => t.Union([t.Literal(0), t.Literal(1), t.Literal(2), t.Literal(3), t.Literal(4)]);

/** Transaction runner binding the vote repositories to one DB transaction. */
const voteTransaction = (db: any) => (fn: any): Promise<any> =>
  db.transaction((tx: any) => fn({ votes: new VoteRepositoryDrizzle(tx), models: new ModelReadRepositoryDrizzle(tx) }));

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
    return await tenantDb
      .select({ eventId: judgeAssignmentsTable.eventId, eventName: eventsTable.name })
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
    // Judges only see models of categories/events they are assigned to (manager/admin exempt)
    const scope = await loadJudgeScope(tenantDb, user!);
    const rows = allRows
      .filter((row: any) => canAccessCategory(scope, { id: row.categoryId, eventId: row.eventId }))
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
      description: "Solo modelli di categorie/eventi assegnati al giudice. Filtri opzionali: eventId, categoryId.",
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
    const scope = await loadJudgeScope(tenantDb, user!);
    if (!canAccessCategory(scope, { id: rows[0].categoryId, eventId: rows[0].eventId as string })) {
      throw new ForbiddenError("Judge is not assigned to this category");
    }
    const images = await tenantDb.select().from(modelImagesTable).where(eq(modelImagesTable.modelId, params.modelId as any));
    const codeFormat = await loadModelCodeFormatSettings(tenantDb);
    const { categorySeqId: catSeqId, eventId: _eventId, ...modelRow } = rows[0] as any;
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
    const scope = await loadJudgeScope(tenantDb, user!);
    const rows = allRows.filter((row: any) => canAccessCategory(scope, { id: row.categoryId, eventId: row.eventId }));
    if (!rows.length) return [];

    const votes = await tenantDb
      .select({ modelId: votesTable.modelId, rank: votesTable.rank })
      .from(votesTable)
      .where(and(eq(votesTable.judgeId, user!.id as any), inArray(votesTable.modelId, rows.map((r: any) => r.id) as any)))
      .orderBy(desc(votesTable.createdAt), desc(votesTable.seq));
    const latest = new Map<string, number>();
    for (const vote of votes) if (!latest.has(vote.modelId)) latest.set(vote.modelId, vote.rank);

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
      models: display.models.map(({ eventId: _e, displayNumber: _d, ...model }) => model)
    }));
  }, {
    query: t.Object({ eventId: t.Optional(uuid()), categoryId: t.Optional(uuid()) }),
    detail: {
      summary: "Display votabili con i loro modelli",
      description: "Raggruppa per (evento, displayNumber) i soli modelli nello scope del giudice.",
      tags: ["Judging"],
      security: [{ bearerAuth: [] }]
    }
  })
  .post("/displays/vote", async ({ user, tenantDb, body }) => {
    const db = tenantDb as any;
    const rows = await db
      .select({ id: modelsTable.id, categoryId: modelsTable.categoryId, eventId: categoriesTable.eventId })
      .from(modelsTable)
      .innerJoin(categoriesTable, eq(categoriesTable.id, modelsTable.categoryId))
      .where(and(eq(categoriesTable.eventId, body.eventId as any), eq(modelsTable.displayNumber, body.displayNumber)));
    if (!rows.length) throw new NotFoundError("Display not found");
    const scope = await loadJudgeScope(db, user!);
    const modelIds = rows
      .filter((r: any) => canAccessCategory(scope, { id: r.categoryId, eventId: r.eventId }))
      .map((r: any) => r.id as string);
    if (!modelIds.length) throw new ForbiddenError("Judge is not assigned to this display");
    const result = await new VoteDisplay(voteTransaction(db)).execute({
      judgeId: user!.id,
      modelIds,
      rank: body.rank,
      // Re-checked inside the transaction: the model may have been moved meanwhile.
      authorize: async (model) => {
        const category = await loadCategoryRef(db, model.categoryId);
        return Boolean(category) && canAccessCategory(scope, category!);
      }
    });
    return { eventId: body.eventId, displayNumber: body.displayNumber, rank: body.rank, ...result };
  }, {
    body: t.Object({ eventId: uuid(), displayNumber: t.Integer({ minimum: 0 }), rank: rankSchema() }),
    detail: {
      summary: "Vota un intero display",
      description: "Applica il voto a tutti i modelli del display nello scope del giudice (categorie chiuse saltate). 404 display inesistente, 403 fuori scope, 409 tutte le categorie chiuse.",
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
    // Judge must be assigned and have voted every model (409 INCOMPLETE_VOTES otherwise).
    const result = await closeCategory(tenantDb as any, params.categoryId, { judgeId: user!.id });
    if (result.outcome === "already_closed") throw new NotFoundError("Category not found"); // unreachable for judges
    return {
      completed: true,
      allDone: result.allDone,
      totalJudges: result.totalJudges,
      completedJudges: result.completedJudges
    };
  }, {
    params: t.Object({ categoryId: uuid() }),
    detail: {
      summary: "Segna giudizio categoria completato",
      description: "409 {code:'INCOMPLETE_VOTES', missing, totalModels, missingModelIds} se il giudice non ha votato tutti i modelli.",
      tags: ["Judging"],
      security: [{ bearerAuth: [] }]
    }
  })
  .get("/categories/:categoryId/completion", async ({ tenantDb, params, user }) => {
    const { categoryId } = params;
    const state = await loadCompletionState(tenantDb, categoryId);
    if (!state) {
      return { categoryId, status: "open", totalJudges: 0, completedJudges: 0, allDone: false };
    }
    const scope = await loadJudgeScope(tenantDb, user!);
    if (!canAccessCategory(scope, { id: categoryId, eventId: state.category.eventId })) {
      throw new ForbiddenError("Judge is not assigned to this category");
    }
    return {
      categoryId,
      status: state.category.status as "open" | "closed",
      totalJudges: state.totalJudges,
      completedJudges: state.completedJudges,
      allDone: state.category.status === "closed" || state.allDone
    };
  }, {
    params: t.Object({ categoryId: uuid() }),
    detail: { summary: "Stato completamento giudici per categoria", tags: ["Judging"], security: [{ bearerAuth: [] }] }
  })
  .post("/vote", async ({ user, tenantDb, body }) => {
    const db = tenantDb as any;
    const uc = new VoteModel(
      new VoteRepositoryDrizzle(db),
      new ModelReadRepositoryDrizzle(db),
      voteTransaction(db)
    );
    return await uc.execute({
      id: crypto.randomUUID(),
      judgeId: user!.id,
      modelId: body.modelId,
      rank: body.rank,
      authorize: async (model) => {
        const category = await loadCategoryRef(db, model.categoryId);
        if (!category) return false;
        return canAccessCategory(await loadJudgeScope(db, user!), category);
      }
    });
  }, {
    body: t.Object({ modelId: uuid(), rank: rankSchema() }),
    detail: {
      summary: "Vota un modello",
      description: "Aggiunge un voto (append-only) del giudice per un modello; vale l'ultimo. 404 modello inesistente, 403 giudice non assegnato, 409 categoria chiusa.",
      tags: ["Judging"],
      security: [{ bearerAuth: [] }]
    },
    response: {
      200: t.Object({ voteId: t.String(), updated: t.Boolean() })
    }
  });
