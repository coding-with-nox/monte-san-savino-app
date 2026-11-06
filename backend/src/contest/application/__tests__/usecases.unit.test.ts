import { describe, it, expect } from "bun:test";
import { VoteModel } from "../VoteModel";
import { RequestModelImageUpload } from "../RequestModelImageUpload";
import { Vote } from "../../domain/Vote";

function setup(model: any, latest: Vote | null = null) {
  const added: Vote[] = [];
  const votes: any = { findLatestByJudgeAndModel: async () => latest, add: async (v: Vote) => { added.push(v); } };
  const models: any = { getModelCategory: async () => model };
  return { uc: new VoteModel(votes, models), added };
}
const input = { id: "v1", judgeId: "j", modelId: "m", rank: 2 as const };

describe("VoteModel", () => {
  it("adds a new vote (updated=false)", async () => {
    const { uc, added } = setup({ modelId: "m", categoryId: "c", categoryStatus: "open" });
    expect(await uc.execute(input)).toEqual({ voteId: "v1", updated: false });
    expect(added).toHaveLength(1);
    expect(added[0].rank).toBe(2);
  });
  it("flags update when a previous vote exists", async () => {
    const { uc } = setup({ modelId: "m", categoryId: "c", categoryStatus: "open" }, new Vote("old", "j", "m", 1));
    expect((await uc.execute(input)).updated).toBe(true);
  });
  it("throws when model missing, without persisting", async () => {
    const { uc, added } = setup(null);
    await expect(uc.execute(input)).rejects.toThrow("Model not found");
    expect(added).toHaveLength(0);
  });
  it("throws when category is closed", async () => {
    const { uc, added } = setup({ modelId: "m", categoryId: "c", categoryStatus: "closed" });
    await expect(uc.execute(input)).rejects.toThrow("Category is closed");
    expect(added).toHaveLength(0);
  });
});

describe("RequestModelImageUpload", () => {
  it("requests an upload url under models/<id>", async () => {
    let seen: any;
    const storage = { getUploadUrl: async (i: any) => { seen = i; return { uploadUrl: "u", publicUrl: "p" }; } };
    const r = await new RequestModelImageUpload(storage).execute({ modelId: "abc", contentType: "image/png" });
    expect(seen).toEqual({ key: "models/abc", contentType: "image/png" });
    expect(r).toEqual({ uploadUrl: "u", publicUrl: "p" });
  });
});
