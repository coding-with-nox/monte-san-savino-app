import { Elysia, t } from "elysia";
import { requireRole } from "../../../identity/infra/http/role.middleware";
import { and, desc, eq, inArray, isNull, or, lte, gte } from "drizzle-orm";
import { VoteRepositoryDrizzle } from "../persistence/voteRepository.drizzle";
import { ModelReadRepositoryDrizzle } from "../persistence/modelReadRepository.drizzle";
import { VoteModel } from "../../application/VoteModel";
import { awardsTable, awardBracketsTable, judgeCompletionsTable, categoriesTable, eventsTable, judgeAssignmentsTable, modelsTable, modelImagesTable, registrationsTable, votesTable } from "../persistence/schema";
import { usersTable, userProfilesTable } from "../../../identity/infra/persistence/schema";
import { tenantMiddleware } from "../../../tenancy/infra/http/tenant.middleware";
import { formatModelCode, loadModelCodeFormatSettings } from "./model-code";

export const judgeRoutes = new Elysia({ prefix: "/judge" })
  .use(tenantMiddleware)
  .use(requireRole("judge"))
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
    const eventId = query?.eventId ? String(query.eventId) : null;
    let whereClause: any = undefined;
    if (eventId) {
      whereClause = eq(categoriesTable.eventId, eventId as any);
    }
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
        imageUrl: modelsTable.imageUrl
      })
      .from(modelsTable)
      .innerJoin(categoriesTable, eq(categoriesTable.id, modelsTable.categoryId));
    const rows = whereClause ? await queryBuilder.where(whereClause) : await queryBuilder;
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
      .orderBy(desc(votesTable.createdAt), desc(votesTable.id));

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
    detail: {
      summary: "Lista modelli giudicabili",
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
    params: t.Object({ modelId: t.String() }),
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
  .get("/models/:modelId", async ({ tenantDb, params }) => {
    const rows = await tenantDb
      .select({
        id: modelsTable.id,
        categoryId: modelsTable.categoryId,
        code: modelsTable.code,
        imageUrl: modelsTable.imageUrl,
        displayNumber: modelsTable.displayNumber,
        categorySeqId: categoriesTable.seqId
      })
      .from(modelsTable)
      .leftJoin(categoriesTable, eq(categoriesTable.id, modelsTable.categoryId))
      .where(eq(modelsTable.id, params.modelId as any));
    const images = await tenantDb.select().from(modelImagesTable).where(eq(modelImagesTable.modelId, params.modelId as any));
    if (!rows.length) {
      return { model: null, images };
    }
    const codeFormat = await loadModelCodeFormatSettings(tenantDb);
    const { categorySeqId: catSeqId, ...modelRow } = rows[0] as any;
    return {
      model: {
        ...modelRow,
        code: formatModelCode(modelRow.code, catSeqId, modelRow.displayNumber, codeFormat) || null
      },
      images
    };
  }, {
    params: t.Object({ modelId: t.String() }),
    detail: {
      summary: "Dettaglio modello giudice",
      tags: ["Judging"],
      security: [{ bearerAuth: [] }]
    }
  })
  .get("/participants/:userId", async ({ tenantDb, params }) => {
    const profile = await tenantDb
      .select({
        id: usersTable.id,
        email: usersTable.email,
        firstName: userProfilesTable.firstName,
        lastName: userProfilesTable.lastName
      })
      .from(usersTable)
      .leftJoin(userProfilesTable, eq(usersTable.id, userProfilesTable.userId))
      .where(eq(usersTable.id, params.userId as any));
    const registrations = await tenantDb
      .select()
      .from(registrationsTable)
      .where(eq(registrationsTable.userId, params.userId as any));
    return { profile: profile[0] ?? null, registrations };
  }, {
    params: t.Object({ userId: t.String() }),
    detail: {
      summary: "Dettaglio concorrente",
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
  .post("/categories/:categoryId/complete", async ({ user, tenantDb, params, set }) => {
    const { categoryId } = params;

    // 1. Load category
    const categoryRows = await tenantDb
      .select({ id: categoriesTable.id, eventId: categoriesTable.eventId, status: categoriesTable.status })
      .from(categoriesTable)
      .where(eq(categoriesTable.id, categoryId as any));
    if (!categoryRows.length) {
      set.status = 404;
      return { error: "Category not found" };
    }
    const category = categoryRows[0];
    if (category.status === "closed") {
      set.status = 400;
      return { error: "Category already closed" };
    }
    const eventId = category.eventId;

    // 2. Upsert completion record
    await tenantDb
      .insert(judgeCompletionsTable)
      .values({ id: crypto.randomUUID() as any, judgeId: user!.id as any, categoryId: categoryId as any })
      .onConflictDoNothing();

    // 3. Count judges assigned to this category (directly or event-wide)
    const assignedJudges = await tenantDb
      .select({ judgeId: judgeAssignmentsTable.judgeId })
      .from(judgeAssignmentsTable)
      .where(
        and(
          eq(judgeAssignmentsTable.eventId, eventId as any),
          or(
            eq(judgeAssignmentsTable.categoryId, categoryId as any),
            isNull(judgeAssignmentsTable.categoryId)
          )
        )
      );
    const assignedJudgeIds = [...new Set(assignedJudges.map((r: any) => r.judgeId))];
    const totalJudges = assignedJudgeIds.length;

    // 4. Count completions for this category
    const completionRows = await tenantDb
      .select({ judgeId: judgeCompletionsTable.judgeId })
      .from(judgeCompletionsTable)
      .where(eq(judgeCompletionsTable.categoryId, categoryId as any));
    const completedJudges = completionRows.length;

    // 5. Not all done yet
    if (completedJudges < totalJudges) {
      return { completed: true, allDone: false, totalJudges, completedJudges };
    }

    // 6. All done: freeze awards + close category
    const models = await tenantDb
      .select({ id: modelsTable.id })
      .from(modelsTable)
      .where(eq(modelsTable.categoryId, categoryId as any));

    const modelIds = models.map((m: any) => m.id);

    if (modelIds.length > 0) {
      // Get all votes for these models from assigned judges
      const allVotes = await tenantDb
        .select({
          judgeId: votesTable.judgeId,
          modelId: votesTable.modelId,
          rank: votesTable.rank,
          createdAt: votesTable.createdAt,
          id: votesTable.id
        })
        .from(votesTable)
        .where(
          and(
            inArray(votesTable.modelId, modelIds as any),
            inArray(votesTable.judgeId, assignedJudgeIds as any)
          )
        )
        .orderBy(desc(votesTable.createdAt), desc(votesTable.id));

      // Deduplicate: latest vote per judge per model
      const latestVoteMap = new Map<string, number>();
      for (const vote of allVotes) {
        const key = `${vote.judgeId}::${vote.modelId}`;
        if (!latestVoteMap.has(key)) {
          latestVoteMap.set(key, vote.rank);
        }
      }

      // Load brackets for the event
      const brackets = await tenantDb
        .select()
        .from(awardBracketsTable)
        .where(eq(awardBracketsTable.eventId, eventId as any));

      // Compute and upsert award for each model
      for (const model of models) {
        let totalScore = 0;
        for (const judgeId of assignedJudgeIds) {
          const key = `${judgeId}::${model.id}`;
          totalScore += latestVoteMap.get(key) ?? 0;
        }

        // Find matching bracket
        const matchingBracket = brackets
          .filter((b: any) => b.lowLimit <= totalScore && b.highLimit >= totalScore)
          .sort((a: any, b: any) => a.medalRank - b.medalRank)[0];

        const medalLabel = matchingBracket?.medalLabel ?? "None";
        const medalRank = matchingBracket?.medalRank ?? 0;

        await tenantDb
          .insert(awardsTable)
          .values({
            id: crypto.randomUUID() as any,
            categoryId: categoryId as any,
            modelId: model.id as any,
            totalScore,
            medalLabel,
            medalRank,
            source: "aggregate"
          })
          .onConflictDoUpdate({
            target: [awardsTable.categoryId, awardsTable.modelId],
            set: { totalScore, medalLabel, medalRank, source: "aggregate" }
          });
      }
    }

    // Close category
    await tenantDb
      .update(categoriesTable)
      .set({ status: "closed" })
      .where(eq(categoriesTable.id, categoryId as any));

    return { completed: true, allDone: true, totalJudges, completedJudges };
  }, {
    params: t.Object({ categoryId: t.String() }),
    detail: { summary: "Segna giudizio categoria completato", tags: ["Judging"], security: [{ bearerAuth: [] }] }
  })
  .get("/categories/:categoryId/completion", async ({ tenantDb, params }) => {
    const { categoryId } = params;

    const categoryRows = await tenantDb
      .select({ id: categoriesTable.id, eventId: categoriesTable.eventId, status: categoriesTable.status })
      .from(categoriesTable)
      .where(eq(categoriesTable.id, categoryId as any));
    if (!categoryRows.length) {
      return { categoryId, status: "open", totalJudges: 0, completedJudges: 0, allDone: false };
    }
    const category = categoryRows[0];
    const eventId = category.eventId;

    const assignedJudges = await tenantDb
      .select({ judgeId: judgeAssignmentsTable.judgeId })
      .from(judgeAssignmentsTable)
      .where(
        and(
          eq(judgeAssignmentsTable.eventId, eventId as any),
          or(
            eq(judgeAssignmentsTable.categoryId, categoryId as any),
            isNull(judgeAssignmentsTable.categoryId)
          )
        )
      );
    const totalJudges = new Set(assignedJudges.map((r: any) => r.judgeId)).size;

    const completionRows = await tenantDb
      .select({ judgeId: judgeCompletionsTable.judgeId })
      .from(judgeCompletionsTable)
      .where(eq(judgeCompletionsTable.categoryId, categoryId as any));
    const completedJudges = completionRows.length;

    return {
      categoryId,
      status: category.status as "open" | "closed",
      totalJudges,
      completedJudges,
      allDone: category.status === "closed" || completedJudges >= totalJudges
    };
  }, {
    params: t.Object({ categoryId: t.String() }),
    detail: { summary: "Stato completamento giudici per categoria", tags: ["Judging"], security: [{ bearerAuth: [] }] }
  })
  .post("/vote", async ({ user, tenantDb, body }) => {
    const uc = new VoteModel(new VoteRepositoryDrizzle(tenantDb), new ModelReadRepositoryDrizzle(tenantDb));
    return await uc.execute({ id: crypto.randomUUID(), judgeId: user!.id, modelId: body.modelId, rank: body.rank });
  }, {
    body: t.Object({ modelId: t.String(), rank: t.Union([t.Literal(0), t.Literal(1), t.Literal(2), t.Literal(3), t.Literal(4)]) }),
    detail: {
      summary: "Vota un modello",
      description: "Crea o aggiorna il voto del giudice per un modello specifico.",
      tags: ["Judging"],
      security: [{ bearerAuth: [] }]
    },
    response: {
      200: t.Object({ voteId: t.String(), updated: t.Boolean() })
    }
  });
