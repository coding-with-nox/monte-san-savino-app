import { and, desc, eq } from "drizzle-orm";
import { votesTable, modelsTable } from "./schema";
import { Vote } from "../../domain/Vote";

export class VoteRepositoryDrizzle {
  constructor(private readonly db: any) {}
  async findLatestByJudgeAndModel(judgeId: string, modelId: string): Promise<Vote | null> {
    const rows = await this.db
      .select()
      .from(votesTable)
      .where(and(eq(votesTable.judgeId, judgeId as any), eq(votesTable.modelId, modelId as any)))
      .orderBy(desc(votesTable.createdAt), desc(votesTable.id))
      .limit(1);
    if (!rows.length) return null;
    const r = rows[0];
    return new Vote(r.id, r.judgeId, r.modelId, r.rank as any, r.createdAt ?? new Date());
  }
  async add(vote: Vote): Promise<void> {
    await this.db.insert(votesTable).values({
      id: vote.id, judgeId: vote.judgeId as any, modelId: vote.modelId as any, rank: vote.rank, createdAt: vote.createdAt
    });
  }
  async listHistoryByJudgeAndModel(judgeId: string, modelId: string): Promise<Vote[]> {
    const rows = await this.db
      .select()
      .from(votesTable)
      .where(and(eq(votesTable.judgeId, judgeId as any), eq(votesTable.modelId, modelId as any)))
      .orderBy(desc(votesTable.createdAt), desc(votesTable.id));
    return rows.map((r: any) => new Vote(r.id, r.judgeId, r.modelId, r.rank as any, r.createdAt ?? new Date()));
  }
  async listByCategory(categoryId: string): Promise<Vote[]> {
    const rows = await this.db.select({
      id: votesTable.id, judgeId: votesTable.judgeId, modelId: votesTable.modelId, rank: votesTable.rank, createdAt: votesTable.createdAt
    }).from(votesTable)
      .innerJoin(modelsTable, eq(modelsTable.id, votesTable.modelId))
      .where(eq(modelsTable.categoryId, categoryId as any));
    return rows.map((r:any) => new Vote(r.id, r.judgeId, r.modelId, r.rank as any, r.createdAt ?? new Date()));
  }
}
