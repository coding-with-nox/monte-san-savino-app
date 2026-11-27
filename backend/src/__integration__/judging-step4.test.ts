import { describe, it, expect, beforeEach, afterAll } from "bun:test";
import { eq } from "drizzle-orm";
import { createCategory, createEvent, createLevel, createUser, request, resetDb } from "./fixtures";
import { getTestDb } from "./testDb";
import { awardBracketsTable, awardsTable, modelsTable, votesTable } from "../contest/infra/persistence/schema";
import { userProfilesTable } from "../identity/infra/persistence/schema";
import { MSS_AWARD_BRACKET_PRESET } from "../contest/domain/categoryClosure";

describe("integration judging step 4: head-judge overrides, review, missing models", () => {
  let manager: Awaited<ReturnType<typeof createUser>>;
  let president: Awaited<ReturnType<typeof createUser>>;
  let eventId: string;
  let c1: string;
  let c2: string;
  let levelId: string;
  let code: number;

  beforeEach(async () => {
    await resetDb();
    const db = getTestDb();
    await db.delete(awardsTable);
    await db.delete(awardBracketsTable);
    manager = await createUser("manager");
    president = await createUser("jury_president");
    eventId = await createEvent("Giudizi step 4");
    c1 = await createCategory(eventId, "C1");
    c2 = await createCategory(eventId, "C2");
    levelId = await createLevel("Master");
    await db.insert(awardBracketsTable).values(MSS_AWARD_BRACKET_PRESET.map((b) => ({ id: crypto.randomUUID(), eventId, ...b })));
    code = 0;
  });
  afterAll(resetDb);

  async function model(categoryId: string, ownerId: string, displayNumber: number) {
    const id = crypto.randomUUID();
    code += 1;
    await getTestDb().insert(modelsTable).values({ id, userId: ownerId, categoryId, levelId, name: `Modello ${code}`, code, displayNumber });
    return id;
  }

  const assign = (judgeId: string, categoryId: string) =>
    request("POST", "/admin/judges/assignments", manager.token, { eventId, judgeId, categoryId });
  const vote = (token: string, modelId: string, rank = 3) => request("POST", "/judge/vote", token, { modelId, rank });
  const complete = (token: string, categoryId: string) => request("POST", `/judge/categories/${categoryId}/complete`, token);
  const close = (categoryId: string) => request("PATCH", `/categories/${categoryId}/status`, manager.token, { status: "closed" });
  const events = () => request("GET", `/awards/events/${eventId}`, manager.token);
  const override = (token: string, awardId: string, body: unknown) => request("PATCH", `/awards/${awardId}`, token, body);
  const modelIds = (res: { json: any }) => res.json.map((m: any) => m.id).sort();

  /**
   * c1 closed by the manager with two judges. m1 (display 1): 4 and 1 => DISCORDANT_VOTES, total 8 = Silver.
   * m2 (display 2): one vote of two expected => PARTIAL_VOTES, total 9 = Silver.
   */
  async function closedClassWithIssues() {
    const j1 = await createUser("judge");
    const j2 = await createUser("judge");
    await assign(j1.id, c1);
    await assign(j2.id, c1);
    const owner = await createUser();
    const m1 = await model(c1, owner.id, 1);
    const m2 = await model(c1, owner.id, 2);
    expect((await vote(j1.token, m1, 4)).status).toBe(200);
    expect((await vote(j2.token, m1, 1)).status).toBe(200);
    expect((await vote(j1.token, m2, 3)).status).toBe(200);
    expect((await close(c1)).status).toBe(200);
    return { j1, j2, m1, m2 };
  }

  it("override by jury_president: ok, source override, note stored, issues cleared; visible in the ranking", async () => {
    const { m1, m2 } = await closedClassWithIssues();
    const before = (await events()).json;
    const row1 = before.find((r: any) => r.modelId === m1);
    expect(row1).toMatchObject({
      source: "aggregate", totalScore: 8, medalLabel: "Silver", medalRank: 3, issues: ["DISCORDANT_VOTES"],
      overrideNote: null, displayNumber: 1, categoryName: "C1", modelName: expect.any(String)
    });
    expect(row1.code).toMatch(/^M\d+-0001-\d+$/);
    expect(before.find((r: any) => r.modelId === m2)).toMatchObject({ source: "aggregate", issues: ["PARTIAL_VOTES"] });

    const res = await override(president.token, row1.id, { medalLabel: "Gold", medalRank: 4, note: "  Giudizio del presidente  " });
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ updated: true });

    const after = (await events()).json.find((r: any) => r.modelId === m1);
    expect(after).toMatchObject({ source: "override", medalLabel: "Gold", medalRank: 4, totalScore: 8, issues: [], overrideNote: "Giudizio del presidente" });
    const [row] = await getTestDb().select().from(awardsTable).where(eq(awardsTable.id, row1.id));
    expect(row.overriddenBy).toBe(president.id);
    expect(row.issues).toBeNull();
    // the other award is untouched
    expect((await events()).json.find((r: any) => r.modelId === m2)).toMatchObject({ source: "aggregate", issues: ["PARTIAL_VOTES"] });
  });

  it("override refused: 403 for a judge, 422 for a medal that is no bracket of the event or a long note, 409 on an open class", async () => {
    const { m1 } = await closedClassWithIssues();
    const awardId = (await events()).json.find((r: any) => r.modelId === m1).id as string;

    const judge = await createUser("judge");
    expect((await override(judge.token, awardId, { medalLabel: "Gold", medalRank: 4 })).status).toBe(403);

    for (const medal of [{ medalLabel: "Platinum", medalRank: 5 }, { medalLabel: "Gold", medalRank: 3 }, { medalLabel: "Gold", medalRank: 0 }]) {
      const r = await override(president.token, awardId, medal);
      expect(r.status).toBe(422);
      expect(r.json.code).toBe("INVALID_MEDAL");
    }
    expect((await override(president.token, awardId, { medalLabel: "Gold", medalRank: 4, note: "x".repeat(201) })).status).toBe(422);
    // None with rank 0 is always a valid medal
    expect((await override(president.token, awardId, { medalLabel: "None", medalRank: 0 })).status).toBe(200);

    // an award row of an open class (no award rows exist there in normal flows)
    const openAwardId = crypto.randomUUID();
    await getTestDb().insert(awardsTable).values({
      id: openAwardId, categoryId: c2, modelId: crypto.randomUUID(), totalScore: 0, medalLabel: "None", medalRank: 0, source: "aggregate"
    });
    const open = await override(president.token, openAwardId, { medalLabel: "Gold", medalRank: 4 });
    expect(open.status).toBe(409);
    expect(open.json.code).toBe("CATEGORY_NOT_CLOSED");
  });

  it("review of a closed class: contract shape, brackets, award, issues, source and the latest vote of each judge (name, rank)", async () => {
    const { j1, m1, m2 } = await closedClassWithIssues();
    await getTestDb().insert(userProfilesTable).values({ userId: j1.id, firstName: "Anna", lastName: "Verdi" });

    const res = await request("GET", `/awards/categories/${c1}/review`, president.token);
    expect(res.status).toBe(200);
    expect(Object.keys(res.json).sort()).toEqual(["brackets", "categoryId", "categoryName", "eventId", "rows"]);
    expect(res.json).toMatchObject({ categoryId: c1, categoryName: "C1", eventId });
    expect(res.json.brackets).toEqual(
      MSS_AWARD_BRACKET_PRESET.map(({ medalLabel, medalRank, lowLimit, highLimit }) => ({ medalLabel, medalRank, lowLimit, highLimit }))
        .sort((a, b) => a.medalRank - b.medalRank)
    );
    const [r1, r2] = res.json.rows;
    const r1AwardId = r1.award.id as string; // captured before the matchers below
    expect(r1).toMatchObject({
      modelId: m1, displayNumber: 1, name: expect.any(String), totalScore: 8, issues: ["DISCORDANT_VOTES"], source: "aggregate", overrideNote: null,
      award: { medalLabel: "Silver", medalRank: 3 }
    });
    expect(r1AwardId).toEqual(expect.any(String));
    expect(r1.code).toMatch(/^M\d+-0001-\d+$/);
    expect(r1.votes).toHaveLength(2);
    expect(r1.votes).toEqual(expect.arrayContaining([
      { judgeName: "Anna Verdi", rank: 4 },
      { judgeName: expect.stringMatching(/^Giudice/), rank: 1 }
    ]));
    expect(r2).toMatchObject({ modelId: m2, displayNumber: 2, totalScore: 9, issues: ["PARTIAL_VOTES"], award: { medalLabel: "Silver", medalRank: 3 } });
    expect(r2.votes).toEqual([{ judgeName: "Anna Verdi", rank: 3 }]);
    expect(JSON.stringify(res.json)).not.toContain("@example.com"); // no emails in the review

    // after an override the review shows source and note of the head judge
    expect((await override(president.token, r1AwardId, { medalLabel: "Gold", medalRank: 4, note: "Ritocco" })).status).toBe(200);
    const again = await request("GET", `/awards/categories/${c1}/review`, president.token);
    expect(again.json.rows[0]).toMatchObject({ source: "override", overrideNote: "Ritocco", award: { medalLabel: "Gold", medalRank: 4 } });

    // open class and judges: refused
    expect((await request("GET", `/awards/categories/${c2}/review`, president.token)).json.code).toBe("CATEGORY_NOT_CLOSED");
    expect((await request("GET", `/awards/categories/${c1}/review`, j1.token)).status).toBe(403);
  });

  it("missing models: hidden from judges, not expected for completion, no award row; closing ignores them", async () => {
    const jm1 = await createUser("judge");
    const jm2 = await createUser("judge");
    await assign(jm1.id, c2);
    await assign(jm2.id, c2);
    const owner = await createUser();
    const a = await model(c2, owner.id, 5);
    const b = await model(c2, owner.id, 6);
    expect((await vote(jm1.token, a, 2)).status).toBe(200);
    expect((await vote(jm1.token, b, 3)).status).toBe(200);
    expect((await vote(jm2.token, b, 3)).status).toBe(200);

    // Mark Missing (manager)
    const mark = await request("PATCH", `/admin/models/${a}/missing`, manager.token, { missing: true });
    expect(mark.status).toBe(200);
    expect(mark.json).toEqual({ updated: true, missing: true });
    const [aRow] = await getTestDb().select({ missing: modelsTable.missing }).from(modelsTable).where(eq(modelsTable.id, a));
    expect(aRow.missing).toBe(true);
    // the vote on it is kept
    expect(await getTestDb().select().from(votesTable).where(eq(votesTable.modelId, a))).toHaveLength(1);
    // the manager still sees it, flagged
    const adminList = await request("GET", `/admin/models?eventId=${eventId}`, manager.token);
    expect(adminList.json.find((m: any) => m.id === a)).toMatchObject({ missing: true });

    // judges: not in the lists, not in the displays, not votable
    expect(modelIds(await request("GET", `/judge/models?categoryId=${c2}`, jm1.token))).toEqual([b]);
    const displays = await request("GET", `/judge/displays?categoryId=${c2}`, jm1.token);
    expect(displays.json.map((d: any) => d.displayNumber)).toEqual([6]);
    expect((await request("GET", `/judge/models/${a}`, jm1.token)).json.model).toBeNull();
    expect((await vote(jm1.token, a, 1)).status).toBe(404);
    expect((await request("POST", "/judge/displays/vote", jm1.token, { eventId, displayNumber: 5, rank: 1 })).status).toBe(404);

    // monitoring counts only the judged models
    const monitoring = await request("GET", `/awards/monitoring/${eventId}`, president.token);
    expect(monitoring.json.find((r: any) => r.categoryId === c2)).toMatchObject({ totalModels: 1 });

    // completion: a is not expected, so jm2 needs only b; jm1 completes the class (judge path closes it)
    expect((await complete(jm2.token, c2)).json).toMatchObject({ phase: "judging", allDone: false, totalJudges: 2, completedJudges: 1 });
    expect((await complete(jm1.token, c2)).json).toMatchObject({ phase: "closed", allDone: true });

    // closing ignored a: its award row is absent from the ranking
    expect((await events()).json.map((r: any) => r.modelId)).toEqual([b]);
    // frozen class: no change of the missing flag any more
    const late = await request("PATCH", `/admin/models/${a}/missing`, manager.token, { missing: false });
    expect(late.status).toBe(409);
    expect(late.json.code).toBe("CATEGORY_CLOSED");
  });

  it("unmark restores the model with its votes and invalidates the judge completions of its class", async () => {
    const jA = await createUser("judge");
    const jB = await createUser("judge");
    await assign(jA.id, c2);
    await assign(jB.id, c2);
    const owner = await createUser();
    const x = await model(c2, owner.id, 7);
    const y = await model(c2, owner.id, 8);
    for (const m of [x, y]) {
      expect((await vote(jA.token, m, 2)).status).toBe(200);
      expect((await vote(jB.token, m, 3)).status).toBe(200);
    }
    expect((await complete(jA.token, c2)).json).toMatchObject({ phase: "judging", completedJudges: 1, totalJudges: 2 });

    expect((await request("PATCH", `/admin/models/${x}/missing`, manager.token, { missing: true })).status).toBe(200);
    const invalidated = await request("GET", `/judge/categories/${c2}/completion`, jA.token);
    expect(invalidated.json).toMatchObject({ completedJudges: 0, allDone: false });

    expect((await request("PATCH", `/admin/models/${x}/missing`, manager.token, { missing: false })).json).toEqual({ updated: true, missing: false });
    const restored = (await request("GET", `/judge/models?categoryId=${c2}`, jA.token)).json.find((m: any) => m.id === x);
    expect(restored).toMatchObject({ voteCount: 1, currentRank: 2 }); // the vote was kept
    expect((await complete(jA.token, c2)).json).toMatchObject({ phase: "judging", completedJudges: 1 });
  });
});
