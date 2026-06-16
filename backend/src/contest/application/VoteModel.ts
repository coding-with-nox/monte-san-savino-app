import { Vote, type VoteRank } from "../domain/Vote";
import type { VoteRepository } from "./ports/VoteRepository";
import type { ModelReadRepository } from "./ports/ModelReadRepository";

export class VoteModel {
  constructor(private readonly votes: VoteRepository, private readonly models: ModelReadRepository) {}
  async execute(input: { id: string; judgeId: string; modelId: string; rank: VoteRank }) {
    const model = await this.models.getModelCategory(input.modelId);
    if (!model) throw new Error("Model not found");
    if (model.categoryStatus === "closed") throw new Error("Category is closed");

    const latest = await this.votes.findLatestByJudgeAndModel(input.judgeId, input.modelId);
    const vote = new Vote(input.id, input.judgeId, input.modelId, input.rank);
    await this.votes.add(vote);
    return { voteId: vote.id, updated: Boolean(latest) };
  }
}
