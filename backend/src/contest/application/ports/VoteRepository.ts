import { Vote } from "../../domain/Vote";
export interface VoteRepository {
  findLatestByJudgeAndModel(judgeId: string, modelId: string): Promise<Vote | null>;
  add(vote: Vote): Promise<void>;
  listHistoryByJudgeAndModel(judgeId: string, modelId: string): Promise<Vote[]>;
  listByCategory(categoryId: string): Promise<Vote[]>;
}
