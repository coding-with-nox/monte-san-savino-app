import { describe, it, expect } from "bun:test";
import { VoteModel } from "../VoteModel";
import { RequestModelImageUpload } from "../RequestModelImageUpload";
import { Vote } from "../../domain/Vote";
import { CategoryClosedError, ForbiddenError, NotFoundError } from "../../domain/errors";

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
    await expect(uc.execute(input)).rejects.toBeInstanceOf(NotFoundError);
    expect(added).toHaveLength(0);
  });
  it("throws when category is closed", async () => {
    const { uc, added } = setup({ modelId: "m", categoryId: "c", categoryStatus: "closed" });
    await expect(uc.execute(input)).rejects.toThrow("Category is closed");
    await expect(uc.execute(input)).rejects.toBeInstanceOf(CategoryClosedError);
    expect(added).toHaveLength(0);
  });
});

describe("VoteModel authorization and transaction", () => {
  const open = { modelId: "m", categoryId: "c", categoryStatus: "open" };
  it("403 and no persistence when the judge is not authorized", async () => {
    const { uc, added } = setup(open);
    await expect(uc.execute({ ...input, authorize: async () => false })).rejects.toBeInstanceOf(ForbiddenError);
    expect(added).toHaveLength(0);
  });
  it("runs lookup + findLatest + add inside the transaction runner and locks the category", async () => {
    const events: string[] = [];
    const votes: any = { findLatestByJudgeAndModel: async () => { events.push("latest"); return null; }, add: async () => { events.push("add"); } };
    const models: any = { getModelCategory: async (_id: string, o: any) => { events.push(`model:lock=${o?.lock}`); return open; } };
    const uc = new VoteModel(votes, models, async (fn) => { events.push("begin"); const r = await fn({ votes, models }); events.push("commit"); return r; });
    await uc.execute(input);
    expect(events).toEqual(["begin", "model:lock=true", "latest", "add", "commit"]);
  });
});

describe("RequestModelImageUpload", () => {
  it("requests an upload url under models/<id>/<random>.<ext>", async () => {
    let seen: any;
    const storage = { getUploadUrl: async (i: any) => { seen = i; return { uploadUrl: "u", publicUrl: "p" }; } };
    const r = await new RequestModelImageUpload(storage).execute({ modelId: "123e4567-e89b-12d3-a456-426614174000", contentType: "image/png" });
    expect(seen.key).toMatch(/^models\/123e4567-e89b-12d3-a456-426614174000\/[0-9a-f-]{36}\.png$/);
    expect(seen.contentType).toBe("image/png");
    expect(r).toEqual({ uploadUrl: "u", publicUrl: "p" });
  });
});
