import { describe, it, expect, beforeEach, afterAll } from "bun:test";
import { createCategory, createEvent, createLevel, createUser, request, resetDb } from "./fixtures";
import { getTestDb } from "./testDb";
import { judgeAssignmentsTable, modelsTable, votesTable } from "../contest/infra/persistence/schema";

describe("integration display voting", () => {
  let eventId: string;
  let openA: string;
  let openB: string;
  let closed: string;
  let levelId: string;
  let ownerId: string;
  let code: number;

  async function addModel(categoryId: string, displayNumber: number) {
    const id = crypto.randomUUID();
    await getTestDb().insert(modelsTable).values({
      id, userId: ownerId, categoryId, levelId, name: `M${++code}`, code, displayNumber
    });
    return id;
  }

  async function createJudge(categoryId: string | null = null) {
    const judge = await createUser("judge");
    await getTestDb().insert(judgeAssignmentsTable).values({ id: crypto.randomUUID(), eventId, judgeId: judge.id, categoryId });
    return judge;
  }

  const vote = (token: string, displayNumber: number, rank = 3) =>
    request("POST", "/judge/displays/vote", token, { eventId, displayNumber, rank });

  const votedModelIds = async () =>
    (await getTestDb().select({ modelId: votesTable.modelId }).from(votesTable)).map((v) => v.modelId).sort();

  beforeEach(async () => {
    await resetDb();
    code = 0;
    ownerId = (await createUser()).id;
    eventId = await createEvent();
    openA = await createCategory(eventId, "A");
    openB = await createCategory(eventId, "B");
    closed = await createCategory(eventId, "Chiusa", "closed");
    levelId = await createLevel();
  });
  afterAll(resetDb);

  it("lists displays with their models and votes all of them at once", async () => {
    const judge = await createJudge();
    const m1 = await addModel(openA, 1);
    const m2 = await addModel(openB, 1);
    await addModel(openA, 2);

    const before = await request("GET", `/judge/displays?eventId=${eventId}`, judge.token);
    expect(before.status).toBe(200);
    expect(before.json.map((d: any) => d.displayNumber)).toEqual([1, 2]);
    expect(before.json[0]).toMatchObject({ eventId, votable: true, currentRank: null });
    expect(before.json[0].models.map((m: any) => m.id).sort()).toEqual([m1, m2].sort());

    const res = await vote(judge.token, 1, 4);
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ eventId, displayNumber: 1, rank: 4, skippedClosedModelIds: [] });
    expect(res.json.votes.map((v: any) => v.updated)).toEqual([false, false]);
    expect(await votedModelIds()).toEqual([m1, m2].sort());

    const after = await request("GET", `/judge/displays?eventId=${eventId}`, judge.token);
    expect(after.json[0].currentRank).toBe(4);
    expect(after.json[1].currentRank).toBeNull();

    const again = await vote(judge.token, 1, 2);
    expect(again.json.votes.every((v: any) => v.updated)).toBe(true);
  });

  it("limits listing and voting to the categories assigned to the judge", async () => {
    const judge = await createJudge(openA);
    const m1 = await addModel(openA, 1);
    await addModel(openB, 1);
    await addModel(openB, 2);

    const list = await request("GET", `/judge/displays?eventId=${eventId}`, judge.token);
    expect(list.json).toHaveLength(1);
    expect(list.json[0].models.map((m: any) => m.id)).toEqual([m1]);

    expect((await vote(judge.token, 1)).status).toBe(200);
    expect(await votedModelIds()).toEqual([m1]);

    expect((await vote(judge.token, 2)).status).toBe(403);
    expect(await votedModelIds()).toEqual([m1]);
  });

  it("skips models of closed categories", async () => {
    const judge = await createJudge();
    const open = await addModel(openA, 1);
    const skipped = await addModel(closed, 1);

    const res = await vote(judge.token, 1);
    expect(res.status).toBe(200);
    expect(res.json.skippedClosedModelIds).toEqual([skipped]);
    expect(res.json.votes.map((v: any) => v.modelId)).toEqual([open]);
    expect(await votedModelIds()).toEqual([open]);
  });

  it("409 CATEGORY_CLOSED when every category of the display is closed", async () => {
    const judge = await createJudge();
    await addModel(closed, 1);

    const list = await request("GET", `/judge/displays?eventId=${eventId}`, judge.token);
    expect(list.json[0].votable).toBe(false);

    const res = await vote(judge.token, 1);
    expect(res.status).toBe(409);
    expect(res.json.code).toBe("CATEGORY_CLOSED");
    expect(await votedModelIds()).toEqual([]);
  });

  it("rejects unknown display, out-of-range rank and non-judges", async () => {
    const judge = await createJudge();
    await addModel(openA, 1);
    expect((await vote(judge.token, 99)).status).toBe(404);
    expect((await vote(judge.token, 1, 5)).status).toBe(422);
    const user = await createUser();
    expect((await vote(user.token, 1)).status).toBe(403);
    expect((await request("GET", "/judge/displays", user.token)).status).toBe(403);
  });
});
