import { Elysia, t } from "elysia";
import { requireRole } from "../../../identity/infra/http/role.middleware";
import { VoteRepositoryDrizzle } from "../persistence/voteRepository.drizzle";
import { ModelReadRepositoryDrizzle } from "../persistence/modelReadRepository.drizzle";
import { VoteModel } from "../../application/VoteModel";

export const judgeRoutes = new Elysia({ prefix: "/judge" })
  .use(requireRole("judge"))
  .post("/vote", async ({ user, tenantDb, body }) => {
    const uc = new VoteModel(new VoteRepositoryDrizzle(tenantDb), new ModelReadRepositoryDrizzle(tenantDb));
    return await uc.execute({ id: crypto.randomUUID(), judgeId: user.id, modelId: body.modelId, rank: body.rank });
  }, { body: t.Object({ modelId: t.String(), rank: t.Union([t.Literal(0), t.Literal(1), t.Literal(2), t.Literal(3)]) }) });
