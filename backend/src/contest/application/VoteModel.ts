import { Vote, type VoteRank } from "../domain/Vote";
import { CategoryClosedError, ForbiddenError, NotFoundError } from "../domain/errors";
import type { VoteRepository } from "./ports/VoteRepository";
import type { ModelReadRepository } from "./ports/ModelReadRepository";

type Repos = { votes: VoteRepository; models: ModelReadRepository };
/** Runs `fn` with repositories bound to a single DB transaction. */
export type TransactionRunner = <T>(fn: (repos: Repos) => Promise<T>) => Promise<T>;

export class VoteModel {
  constructor(
    private readonly votes: VoteRepository,
    private readonly models: ModelReadRepository,
    private readonly runInTransaction?: TransactionRunner
  ) {}

  async execute(input: {
    id: string; judgeId: string; modelId: string; rank: VoteRank;
    /** Authorization hook (judge assignment). Return false => 403. */
    authorize?: (model: { modelId: string; categoryId: string }) => Promise<boolean>;
  }) {
    const run = this.runInTransaction ?? ((fn) => fn({ votes: this.votes, models: this.models }));
    return await run(async ({ votes, models }) => {
      // lock: true => the category row is share-locked, so a concurrent closeCategory (FOR UPDATE) serializes with the vote
      const model = await models.getModelCategory(input.modelId, { lock: true });
      if (!model) throw new NotFoundError("Model not found");
      if (input.authorize && !(await input.authorize(model))) throw new ForbiddenError("Judge is not assigned to this category");
      if (model.categoryStatus === "closed") throw new CategoryClosedError("Category is closed");

      const latest = await votes.findLatestByJudgeAndModel(input.judgeId, input.modelId);
      const vote = new Vote(input.id, input.judgeId, input.modelId, input.rank);
      await votes.add(vote);
      return { voteId: vote.id, updated: Boolean(latest) };
    });
  }
}
