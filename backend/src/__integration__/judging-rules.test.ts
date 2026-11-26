import { describe, it, expect, beforeEach, afterAll } from "bun:test";
import { createCategory, createEvent, createLevel, createUser, request, resetDb } from "./fixtures";
import { getTestDb } from "./testDb";
import {
  awardBracketsTable, awardsTable, judgeAssignmentsTable, modelsTable, votesTable
} from "../contest/infra/persistence/schema";

describe("integration judging rules, award brackets and manual close", () => {
  let manager: Awaited<ReturnType<typeof createUser>>;
  let eventId: string;
  let categoryId: string;
  let levelId: string;

  beforeEach(async () => {
    await resetDb();
    const db = getTestDb();
    await db.delete(awardsTable);
    await db.delete(awardBracketsTable);
    manager = await createUser("manager");
    eventId = await createEvent("Evento giudizi");
    categoryId = await createCategory(eventId);
    levelId = await createLevel("Master");
  });
  afterAll(resetDb);

  /** Creates `count` models in the category and returns their ids. */
  async function createModels(count: number) {
    const rows = Array.from({ length: count }, (_, i) => ({
      id: crypto.randomUUID(), userId: manager.id, categoryId, levelId, name: `Modello ${i + 1}`, code: i + 1, displayNumber: i + 1
    }));
    await getTestDb().insert(modelsTable).values(rows);
    return rows.map((r) => r.id);
  }

  /** Assigns `count` judges to the category and returns their ids. */
  async function assignJudges(count: number) {
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      const judge = await createUser("judge");
      await getTestDb().insert(judgeAssignmentsTable).values({ id: crypto.randomUUID(), eventId, judgeId: judge.id, categoryId });
      ids.push(judge.id);
    }
    return ids;
  }

  async function vote(judgeId: string, modelId: string, rank: number) {
    await getTestDb().insert(votesTable).values({ id: crypto.randomUUID(), judgeId, modelId, rank });
  }

  it("manual close with missing votes succeeds, scores by the Emperor rule and flags issues", async () => {
    const [m1, m2, m3] = await createModels(3);
    const [j1, j2, j3] = await assignJudges(3);
    // m1: two of three judges (partial). m2: three judges, 4-4-1 (discordant). m3: no votes at all.
    await vote(j1, m1, 4);
    await vote(j2, m1, 4);
    await vote(j1, m2, 4);
    await vote(j2, m2, 4);
    await vote(j3, m2, 1);

    expect((await request("POST", "/admin/award-brackets/preset", manager.token, { eventId })).status).toBe(200);
    const close = await request("PATCH", `/categories/${categoryId}/status`, manager.token, { status: "closed" });
    expect(close.status).toBe(200);

    const awards = await request("GET", `/awards/events/${eventId}`, manager.token);
    expect(awards.status).toBe(200);
    const byModel = new Map<string, any>(awards.json.map((r: any) => [r.modelId, r]));
    expect(byModel.get(m1)).toMatchObject({ totalScore: 12, medalLabel: "Gold", source: "frozen", issues: ["PARTIAL_VOTES"] });
    expect(byModel.get(m2)).toMatchObject({ totalScore: 9, medalLabel: "Silver", issues: ["DISCORDANT_VOTES"] });
    expect(byModel.get(m3)).toMatchObject({ totalScore: 0, medalLabel: "None", issues: [] });
    for (const row of awards.json) expect(Array.isArray(row.issues)).toBe(true);
  });

  it("manual close still requires at least one assigned judge (409 NO_JUDGES)", async () => {
    await createModels(1);
    const res = await request("PATCH", `/categories/${categoryId}/status`, manager.token, { status: "closed" });
    expect(res.status).toBe(409);
    expect(res.json).toMatchObject({ code: "NO_JUDGES" });
  });

  it("POST /admin/award-brackets/preset replaces the event brackets with the MSS preset", async () => {
    await request("POST", "/admin/award-brackets", manager.token, {
      eventId, medalLabel: "Vecchio", medalRank: 9, lowLimit: 0, highLimit: 1
    });
    const first = await request("POST", "/admin/award-brackets/preset", manager.token, { eventId });
    expect(first.status).toBe(200);
    expect(first.json.map((b: any) => [b.medalRank, b.medalLabel, b.lowLimit, b.highLimit])).toEqual([
      [0, "None", 0, 0],
      [1, "Highly Commended", 1, 4],
      [2, "Bronze", 5, 7],
      [3, "Silver", 8, 10],
      [4, "Gold", 11, 12]
    ]);
    const again = await request("POST", "/admin/award-brackets/preset", manager.token, { eventId });
    expect(again.json).toHaveLength(5);
    const listed = await request("GET", `/admin/award-brackets?eventId=${eventId}`, manager.token);
    expect(listed.json.map((b: any) => b.medalLabel)).toEqual(["None", "Highly Commended", "Bronze", "Silver", "Gold"]);
  });

  it("POST /admin/award-brackets/preset returns 404 for a missing event", async () => {
    const res = await request("POST", "/admin/award-brackets/preset", manager.token, { eventId: crypto.randomUUID() });
    expect(res.status).toBe(404);
  });

  it("award brackets: create and update are validated (422) and merged with stored values", async () => {
    const created = await request("POST", "/admin/award-brackets", manager.token, {
      eventId, medalLabel: "Speciale", medalRank: 5, lowLimit: 0, highLimit: 3
    });
    expect(created.status).toBe(200);
    expect((await request("POST", "/admin/award-brackets", manager.token, {
      eventId, medalLabel: "Speciale", medalRank: 5, lowLimit: 4, highLimit: 3
    })).status).toBe(422);
    expect((await request("POST", "/admin/award-brackets", manager.token, {
      eventId, medalLabel: "", medalRank: 5, lowLimit: 0, highLimit: 3
    })).status).toBe(422);
    expect((await request("POST", "/admin/award-brackets", manager.token, {
      eventId, medalLabel: "Speciale", medalRank: 11, lowLimit: 0, highLimit: 3
    })).status).toBe(422);

    const path = `/admin/award-brackets/${created.json.id}`;
    const updated = await request("PUT", path, manager.token, { highLimit: 6 });
    expect(updated.status).toBe(200);
    expect(updated.json).toMatchObject({ id: created.json.id, medalLabel: "Speciale", medalRank: 5, lowLimit: 0, highLimit: 6 });
    expect((await request("PUT", path, manager.token, { lowLimit: 7 })).status).toBe(422);
    expect((await request("PUT", path, manager.token, { medalRank: -1 })).status).toBe(422);
    expect((await request("PUT", path, manager.token, { medalLabel: "x".repeat(41) })).status).toBe(422);
    expect((await request("PUT", `/admin/award-brackets/${crypto.randomUUID()}`, manager.token, { medalRank: 2 })).status).toBe(404);
  });

  it("settings: GET exposes the judging defaults; PUT validates them and is admin-only", async () => {
    const defaults = await request("GET", "/settings", manager.token);
    expect(defaults.json).toMatchObject({ maxVotesPerExhibitor: "3", maxVoteDifferent: "2" });

    const admin = await createUser("admin");
    expect((await request("PUT", "/admin/settings", admin.token, { maxVotesPerExhibitor: "11" })).status).toBe(422);
    expect((await request("PUT", "/admin/settings", admin.token, { maxVotesPerExhibitor: "0" })).status).toBe(422);
    expect((await request("PUT", "/admin/settings", admin.token, { maxVoteDifferent: "41" })).status).toBe(422);
    expect((await request("PUT", "/admin/settings", admin.token, { maxVoteDifferent: "-1" })).status).toBe(422);
    expect((await request("PUT", "/admin/settings", admin.token, { maxVotesPerExhibitor: "5", maxVoteDifferent: "0" })).status).toBe(200);
    const after = await request("GET", "/settings", manager.token);
    expect(after.json).toMatchObject({ maxVotesPerExhibitor: "5", maxVoteDifferent: "0" });
    expect((await request("PUT", "/admin/settings", manager.token, { maxVotesPerExhibitor: "2" })).status).toBe(403);
  });
});
