import { describe, it, expect } from "bun:test";
import { VoteDisplay } from "../VoteDisplay";
import { CategoryClosedError } from "../../domain/errors";

function setup(status: Record<string, string>) {
  const added: any[] = [];
  const repos: any = {
    votes: { findLatestByJudgeAndModel: async () => null, add: async (v: any) => { added.push(v); } },
    models: { getModelCategory: async (modelId: string) => ({ modelId, categoryId: modelId, categoryStatus: status[modelId] }) }
  };
  return { added, useCase: new VoteDisplay((fn) => fn(repos)) };
}

describe("VoteDisplay", () => {
  it("votes every open model and reports closed ones", async () => {
    const { added, useCase } = setup({ a: "open", b: "closed", c: "open" });
    const out = await useCase.execute({ judgeId: "j", modelIds: ["c", "b", "a"], rank: 3 });
    expect(added.map((v) => [v.modelId, v.rank])).toEqual([["a", 3], ["c", 3]]);
    expect(out.skippedClosedModelIds).toEqual(["b"]);
  });

  it("fails when every category is closed", async () => {
    const { useCase } = setup({ a: "closed" });
    await expect(useCase.execute({ judgeId: "j", modelIds: ["a"], rank: 1 })).rejects.toBeInstanceOf(CategoryClosedError);
  });
});
