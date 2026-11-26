import { VoteModel, type TransactionRunner } from "./VoteModel";
import type { VoteRank } from "../domain/Vote";
import { CategoryClosedError } from "../domain/errors";

/** Applies one rank to every model of a display, atomically. Models of closed categories are skipped. */
export class VoteDisplay {
  constructor(
    private readonly runInTransaction: TransactionRunner,
    private readonly newId: () => string = () => crypto.randomUUID()
  ) {}

  async execute(input: {
    judgeId: string; modelIds: string[]; rank: VoteRank;
    authorize?: (model: { modelId: string; categoryId: string }) => Promise<boolean>;
  }) {
    return await this.runInTransaction(async ({ votes, models }) => {
      const vote = new VoteModel(votes, models);
      const applied: { modelId: string; voteId: string; updated: boolean }[] = [];
      const skippedClosedModelIds: string[] = [];
      for (const modelId of [...input.modelIds].sort()) {
        try {
          const result = await vote.execute({
            id: this.newId(), judgeId: input.judgeId, modelId, rank: input.rank, authorize: input.authorize
          });
          applied.push({ modelId, ...result });
        } catch (err) {
          // Raised before any write, so the transaction stays usable.
          if (!(err instanceof CategoryClosedError)) throw err;
          skippedClosedModelIds.push(modelId);
        }
      }
      if (!applied.length) throw new CategoryClosedError("All categories of this display are closed");
      return { votes: applied, skippedClosedModelIds };
    });
  }
}
