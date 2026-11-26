import { describe, it, expect, beforeEach, afterAll } from "bun:test";
import { eq } from "drizzle-orm";
import { createCategory, createEvent, createLevel, createUser, request, resetDb } from "./fixtures";
import { getTestDb } from "./testDb";
import { awardsTable, categoriesTable, judgeAssignmentsTable, modelsTable, votesTable } from "../contest/infra/persistence/schema";

describe("integration judging step 2: multi-class, own models, stand-ins, reconciliation", () => {
  let manager: Awaited<ReturnType<typeof createUser>>;
  let eventId: string;
  let c1: string;
  let c2: string;
  let levelId: string;
  let code: number;

  beforeEach(async () => {
    await resetDb();
    await getTestDb().delete(awardsTable);
    manager = await createUser("manager");
    eventId = await createEvent("Giudizi step 2");
    c1 = await createCategory(eventId, "C1");
    c2 = await createCategory(eventId, "C2");
    levelId = await createLevel("Master");
    code = 0;
  });
  afterAll(resetDb);

  async function model(categoryId: string, ownerId: string, displayNumber: number) {
    const id = crypto.randomUUID();
    await getTestDb().insert(modelsTable).values({ id, userId: ownerId, categoryId, levelId, name: `M${++code}`, code, displayNumber });
    return id;
  }

  /** Admin assignment; categoryId / standingIn omitted when undefined. */
  const assign = (judgeId: string, categoryId?: string, standingIn?: boolean) =>
    request("POST", "/admin/judges/assignments", manager.token, { eventId, judgeId, categoryId, standingIn });

  const voteModel = (token: string, modelId: string, rank = 3) => request("POST", "/judge/vote", token, { modelId, rank });
  const voteDisplay = (token: string, displayNumber: number, rank = 3) =>
    request("POST", "/judge/displays/vote", token, { eventId, displayNumber, rank });
  const complete = (token: string, categoryId: string) => request("POST", `/judge/categories/${categoryId}/complete`, token);
  const completion = (token: string, categoryId: string) => request("GET", `/judge/categories/${categoryId}/completion`, token);
  const modelIds = (res: { json: any }) => res.json.map((m: any) => m.id).sort();

  const votedBy = async (judgeId: string) =>
    (await getTestDb().select({ modelId: votesTable.modelId }).from(votesTable).where(eq(votesTable.judgeId, judgeId))).map((v) => v.modelId).sort();

  it("multi-class: one row per category, exact duplicates 409, stand-in flag validated and toggled by PATCH", async () => {
    const judge = await createUser("judge");
    const first = await assign(judge.id, c1);
    expect(first.status).toBe(200);
    expect(first.json.standingIn).toBe(false);
    expect((await assign(judge.id, c2)).status).toBe(200);
    expect((await assign(judge.id, c1)).status).toBe(409);
    expect((await assign(judge.id, undefined)).status).toBe(200); // whole event: another key

    const standin = await createUser("judge");
    expect((await assign(standin.id, undefined, true)).status).toBe(422); // stand-in needs a category
    const s = await assign(standin.id, c1, true);
    expect(s.status).toBe(200);
    expect(s.json.standingIn).toBe(true);
    expect((await assign(standin.id, c1, true)).status).toBe(409);

    const standingInOf = async (assignmentId: string) => {
      const [row] = await getTestDb().select({ standingIn: judgeAssignmentsTable.standingIn }).from(judgeAssignmentsTable)
        .where(eq(judgeAssignmentsTable.id, assignmentId));
      return row.standingIn;
    };
    const path = `/admin/judges/assignments/${first.json.id}`;
    const body = { eventId, judgeId: judge.id, categoryId: c1 };
    expect((await request("PATCH", path, manager.token, { ...body, standingIn: true })).status).toBe(200);
    expect(await standingInOf(first.json.id)).toBe(true);
    expect((await request("PATCH", path, manager.token, body)).status).toBe(200); // flag not sent: unchanged
    expect(await standingInOf(first.json.id)).toBe(true);
    expect((await request("PATCH", path, manager.token, { eventId, judgeId: judge.id, standingIn: true })).status).toBe(422);
    expect((await request("PATCH", path, manager.token, { ...body, standingIn: false })).status).toBe(200);
    expect(await standingInOf(first.json.id)).toBe(false);
    expect((await request("PATCH", path, manager.token, { ...body, categoryId: c2 })).status).toBe(409);

    // the judge is one event, even with several category rows in it
    const events = await request("GET", "/judge/events", judge.token);
    expect(events.json).toHaveLength(1);
  });

  it("a judge never sees or votes his own models (403 OWN_MODEL); display vote skips them", async () => {
    const judge = await createUser("judge");
    await assign(judge.id, undefined);
    const other = await createUser();
    const own1 = await model(c1, judge.id, 1);
    const theirs1 = await model(c1, other.id, 1);
    await model(c2, judge.id, 2);

    expect(modelIds(await request("GET", `/judge/models?eventId=${eventId}`, judge.token))).toEqual([theirs1]);
    const displays = await request("GET", `/judge/displays?eventId=${eventId}`, judge.token);
    expect(displays.json.map((d: any) => d.displayNumber)).toEqual([1]);
    expect(displays.json[0]).toMatchObject({ categoryId: c1 });
    expect(modelIds({ json: displays.json[0].models })).toEqual([theirs1]);

    const detail = await request("GET", `/judge/models/${own1}`, judge.token);
    expect(detail.status).toBe(403);
    expect(detail.json.code).toBe("OWN_MODEL");

    const single = await voteModel(judge.token, own1);
    expect(single.status).toBe(403);
    expect(single.json.code).toBe("OWN_MODEL");

    const onlyOwn = await voteDisplay(judge.token, 2);
    expect(onlyOwn.status).toBe(403);
    expect(onlyOwn.json.code).toBe("OWN_MODEL");

    const mixed = await voteDisplay(judge.token, 1);
    expect(mixed.status).toBe(200);
    expect(mixed.json.votes.map((v: any) => v.modelId)).toEqual([theirs1]);
    expect(await votedBy(judge.id)).toEqual([theirs1]);
  });

  it("stand-in sees and votes only models of regular judges of the category; completes on what it is expected to vote", async () => {
    const r1 = await createUser("judge");
    const r2 = await createUser("judge");
    const s = await createUser("judge");
    await assign(r1.id, c1);
    await assign(r2.id, c1);
    await assign(s.id, c1, true);
    const other = await createUser();
    const mU = await model(c1, other.id, 1); // owned by a plain user
    const mR1 = await model(c1, r1.id, 2); // owned by regular judge r1

    expect(modelIds(await request("GET", `/judge/models?categoryId=${c1}`, s.token))).toEqual([mR1]);
    expect(modelIds(await request("GET", `/judge/models?categoryId=${c1}`, r1.token))).toEqual([mU]);
    const outside = await voteModel(s.token, mU);
    expect(outside.status).toBe(403);
    expect((await voteModel(s.token, mR1)).status).toBe(200);
    expect((await voteModel(r1.token, mR1)).json.code).toBe("OWN_MODEL");

    // r1 is expected on mU only (not on his own mR1): completing before that vote is refused
    const early = await complete(r1.token, c1);
    expect(early.status).toBe(409);
    expect(early.json).toMatchObject({ code: "INCOMPLETE_VOTES", missingModelIds: [mU] });
    expect((await voteModel(r1.token, mU)).status).toBe(200);
    expect((await voteModel(r2.token, mU)).status).toBe(200);
    expect((await voteModel(r2.token, mR1)).status).toBe(200);

    const r1Done = await complete(r1.token, c1);
    expect(r1Done.json).toMatchObject({ phase: "judging", allDone: false, totalJudges: 3, completedJudges: 1 });
    // the stand-in has no expected vote on mU: completing after mR1 alone is enough
    expect((await complete(s.token, c1)).status).toBe(200);
    const last = await complete(r2.token, c1);
    expect(last.json).toMatchObject({ phase: "closed", allDone: true, completedJudges: 3 });

    const state = await completion(r2.token, c1);
    expect(state.json).toMatchObject({ status: "closed", phase: "closed", allDone: true });

    const awards = await request("GET", `/awards/events/${eventId}`, manager.token);
    const byModel = new Map<string, any>(awards.json.map((r: any) => [r.modelId, r]));
    // mU: r1 + r2 (3,3) scaled to N=3; mR1: r2 + stand-in (3,3)
    expect(byModel.get(mU)).toMatchObject({ totalScore: 9, issues: [] });
    expect(byModel.get(mR1)).toMatchObject({ totalScore: 9, issues: [] });
  });

  it("discordant votes after all judges completed: stays open in reconciliation, a fixing vote closes it", async () => {
    const judges = [await createUser("judge"), await createUser("judge"), await createUser("judge")];
    for (const j of judges) await assign(j.id, c1);
    const owner = await createUser();
    const m1 = await model(c1, owner.id, 1);
    const m2 = await model(c1, owner.id, 2);

    // m1 gets 4, 4, 1 (spread 3 > maxDelta 2): discordant. m2 gets 3, 3, 3.
    expect((await voteModel(judges[0].token, m1, 4)).status).toBe(200);
    const partial = await request("GET", `/judge/displays?categoryId=${c1}`, judges[0].token);
    expect(partial.json.find((d: any) => d.displayNumber === 1)).toMatchObject({ judged: true, issues: [] });
    expect(partial.json.find((d: any) => d.displayNumber === 2)).toMatchObject({ judged: false, issues: [] });

    await voteModel(judges[1].token, m1, 4);
    await voteModel(judges[2].token, m1, 1);
    for (const j of judges) await voteModel(j.token, m2, 3);

    expect((await complete(judges[0].token, c1)).json).toMatchObject({ phase: "judging", allDone: false, completedJudges: 1, totalJudges: 3 });
    expect((await complete(judges[1].token, c1)).json).toMatchObject({ phase: "judging", allDone: false, completedJudges: 2 });
    const reconciling = await complete(judges[2].token, c1);
    expect(reconciling.status).toBe(200);
    expect(reconciling.json).toMatchObject({ phase: "reconciliation", allDone: true, completedJudges: 3, discordantModelIds: [m1] });

    const [row] = await getTestDb().select({ status: categoriesTable.status }).from(categoriesTable).where(eq(categoriesTable.id, c1));
    expect(row.status).toBe("open");
    const state = await completion(judges[0].token, c1);
    expect(state.json).toMatchObject({ status: "open", phase: "reconciliation", allDone: true, discordantModelIds: [m1] });

    const displays = await request("GET", `/judge/displays?categoryId=${c1}`, judges[0].token);
    expect(displays.json.find((d: any) => d.displayNumber === 1).issues).toEqual(["DISCORDANT_VOTES"]);
    expect(displays.json.find((d: any) => d.displayNumber === 2).issues).toEqual([]);

    // judge 2 corrects his vote through a display vote: no discordance left, the category closes
    const fix = await voteDisplay(judges[2].token, 1, 3);
    expect(fix.status).toBe(200);
    const closed = await completion(judges[0].token, c1);
    expect(closed.json).toMatchObject({ status: "closed", phase: "closed", allDone: true });
    expect(closed.json.discordantModelIds).toBeUndefined();
    const [after] = await getTestDb().select({ status: categoriesTable.status }).from(categoriesTable).where(eq(categoriesTable.id, c1));
    expect(after.status).toBe("closed");
  });
});
