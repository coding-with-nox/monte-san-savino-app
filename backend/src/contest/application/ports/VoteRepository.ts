import { Vote } from "../../domain/Vote";
export interface VoteRepository {
  findByJudgeAndModel(judgeId: string, modelId: string): Promise<Vote | null>;
  upsert(vote: Vote): Promise<void>;
  listByCategory(categoryId: string): Promise<Vote[]>;
}
