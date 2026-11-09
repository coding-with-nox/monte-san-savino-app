import { Elysia, t } from "elysia";
import { requireRole } from "../../../identity/infra/http/role.middleware";
import { and, desc, eq, inArray } from "drizzle-orm";
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
import { ForbiddenError, NotFoundError } from "../../domain/errors";
import { domainErrorHandler } from "../../../shared/infra/http/domainErrorHandler";

const uuid = () => t.String({ format: "uuid" });

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
        code: formatModelCode(modelRow.code, catSeqId, modelRow.displayNumber, codeFormat) || null
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
      (fn) => db.transaction((tx: any) => fn({ votes: new VoteRepositoryDrizzle(tx) as any, models: new ModelReadRepositoryDrizzle(tx) as any }))
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
    body: t.Object({ modelId: uuid(), rank: t.Union([t.Literal(0), t.Literal(1), t.Literal(2), t.Literal(3), t.Literal(4)]) }),
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
