import { Elysia, t } from "elysia";
import { requireRole } from "../../../identity/infra/http/role.middleware";
import { and, desc, eq, ilike, sql } from "drizzle-orm";
import { VoteRepositoryDrizzle } from "../persistence/voteRepository.drizzle";
import { ModelReadRepositoryDrizzle } from "../persistence/modelReadRepository.drizzle";
import { VoteModel } from "../../application/VoteModel";
import { categoriesTable, eventsTable, judgeAssignmentsTable, modelsTable, modelImagesTable, registrationsTable, votesTable } from "../persistence/schema";
import { usersTable, userProfilesTable } from "../../../identity/infra/persistence/schema";
import { tenantMiddleware } from "../../../tenancy/infra/http/tenant.middleware";

export const judgeRoutes = new Elysia({ prefix: "/judge" })
  .use(tenantMiddleware)
  .use(requireRole("judge"))
  .get("/events", async ({ tenantDb, user }) => {
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
    const search = query?.search ? String(query.search) : null;
    let whereClause: any = undefined;
    if (eventId) {
      whereClause = eq(categoriesTable.eventId, eventId as any);
    }
    if (search) {
      whereClause = whereClause
        ? and(whereClause, ilike(modelsTable.name, `%${search}%`))
        : ilike(modelsTable.name, `%${search}%`);
    }
    const queryBuilder = tenantDb
      .select({
        id: modelsTable.id,
        name: modelsTable.name,
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
          sql`${votesTable.modelId} = ANY(${modelIds})`
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
    const rows = await tenantDb.select().from(modelsTable).where(eq(modelsTable.id, params.modelId as any));
    const images = await tenantDb.select().from(modelImagesTable).where(eq(modelImagesTable.modelId, params.modelId as any));
    return { model: rows[0] ?? null, images };
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
  .post("/vote", async ({ user, tenantDb, body }) => {
    const uc = new VoteModel(new VoteRepositoryDrizzle(tenantDb), new ModelReadRepositoryDrizzle(tenantDb));
    return await uc.execute({ id: crypto.randomUUID(), judgeId: user!.id, modelId: body.modelId, rank: body.rank });
  }, {
    body: t.Object({ modelId: t.String(), rank: t.Union([t.Literal(0), t.Literal(1), t.Literal(2), t.Literal(3)]) }),
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
