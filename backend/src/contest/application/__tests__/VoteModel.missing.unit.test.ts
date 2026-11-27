import { describe, it, expect } from "bun:test";
import { VoteModel } from "../VoteModel";

const votesRepo = { findLatestByJudgeAndModel: async () => null, add: async () => {} } as any;
const modelsRepo = (missing: boolean) => ({
  getModelCategory: async () => ({ modelId: "m1", categoryId: "c1", categoryStatus: "open", missing })
}) as any;

describe("VoteModel and missing models", () => {
  it("a missing model is unknown to the judge: 404, no vote written", async () => {
    let written = false;
    const votes = { ...votesRepo, add: async () => { written = true; } };
    const err: any = await new VoteModel(votes, modelsRepo(true))
      .execute({ id: "v1", judgeId: "j1", modelId: "m1", rank: 3 as const })
      .catch((e) => e);
    expect(err.status).toBe(404);
    expect(written).toBe(false);
  });

  it("a model that is not missing is voted as before", async () => {
    const res = await new VoteModel(votesRepo, modelsRepo(false)).execute({ id: "v1", judgeId: "j1", modelId: "m1", rank: 3 as const });
    expect(res).toEqual({ voteId: "v1", updated: false });
  });
});
