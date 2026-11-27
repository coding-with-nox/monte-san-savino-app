import { describe, it, expect, beforeEach, afterAll } from "bun:test";
import { eq } from "drizzle-orm";
import { createCategory, createEvent, createLevel, createUser, request, resetDb } from "./fixtures";
import { getTestDb } from "./testDb";
import {
  awardBracketsTable, awardsTable, honorAssignmentsTable, honorsTable, modelsTable
} from "../contest/infra/persistence/schema";
import { userProfilesTable } from "../identity/infra/persistence/schema";
import { MSS_AWARD_BRACKET_PRESET } from "../contest/domain/categoryClosure";

const LIVE_TIMEOUT = 20_000;

describe("integration live statistics: awards live view and statistics overview", () => {
  let manager: Awaited<ReturnType<typeof createUser>>;
  let president: Awaited<ReturnType<typeof createUser>>;
  let judge1: Awaited<ReturnType<typeof createUser>>;
  let judge2: Awaited<ReturnType<typeof createUser>>;
  let exhibitor: Awaited<ReturnType<typeof createUser>>;
  let eventId: string;
  let c1: string; // open class: m1 (display 1), m3 (display 3)
  let c2: string; // closed class: m2 (display 2), one vote each of rank 1
  let m1: string;
  let m3: string;
  let m2: string;

  beforeEach(async () => {
    await resetDb();
    const db = getTestDb();
    await db.delete(awardsTable);
    await db.delete(awardBracketsTable);
    await db.delete(honorAssignmentsTable);
    await db.delete(honorsTable);

    manager = await createUser("manager");
    president = await createUser("jury_president");
    judge1 = await createUser("judge");
    judge2 = await createUser("judge");
    exhibitor = await createUser();
    eventId = await createEvent("Live stats");
    c1 = await createCategory(eventId, "C1");
    c2 = await createCategory(eventId, "C2");
    const levelId = await createLevel("Master");
    await db.insert(awardBracketsTable).values(MSS_AWARD_BRACKET_PRESET.map((b) => ({ id: crypto.randomUUID(), eventId, ...b })));
    await db.insert(userProfilesTable).values({ userId: exhibitor.id, firstName: "Anna", lastName: "Rossi" } as any);

    for (const categoryId of [c1, c2]) {
      for (const judge of [judge1, judge2]) {
        expect((await request("POST", "/admin/judges/assignments", manager.token, { eventId, judgeId: judge.id, categoryId })).status).toBe(200);
      }
    }

    const model = async (categoryId: string, displayNumber: number, code: number) => {
      const id = crypto.randomUUID();
      await db.insert(modelsTable).values({ id, userId: exhibitor.id, categoryId, levelId, name: `Modello ${code}`, code, displayNumber });
      return id;
    };
    m1 = await model(c1, 1, 101);
    m3 = await model(c1, 3, 103);
    m2 = await model(c2, 2, 102);

    // C1 (open): m1 4 + 1 => total 8 Silver, discordant; m3 only judge1 3 => projected 9 Silver.
    const vote = (token: string, modelId: string, rank: number) => request("POST", "/judge/vote", token, { modelId, rank });
    expect((await vote(judge1.token, m1, 4)).status).toBe(200);
    expect((await vote(judge2.token, m1, 1)).status).toBe(200);
    expect((await vote(judge1.token, m3, 3)).status).toBe(200);
    // C2 (closed by the manager): 1 + 1 => total 3 Highly Commended.
    expect((await vote(judge1.token, m2, 1)).status).toBe(200);
    expect((await vote(judge2.token, m2, 1)).status).toBe(200);
    expect((await request("PATCH", `/categories/${c2}/status`, manager.token, { status: "closed" })).status).toBe(200);

    // Special award on m2 (C2, display 2); the event has two honors in the catalogue.
    await db.insert(honorsTable).values([
      { id: crypto.randomUUID(), eventId, code: "bos", name: "Best Of Show", sortOrder: 1 },
      { id: crypto.randomUUID(), eventId, code: "bop", name: "Best Of Painter", sortOrder: 2 }
    ]);
    const [bos] = await db.select().from(honorsTable).where(eq(honorsTable.code, "bos"));
    await db.insert(honorAssignmentsTable).values({
      id: crypto.randomUUID(), honorId: bos.id, categoryId: c2, displayNumber: 2, modelId: m2, assignedBy: manager.id
    });
  });
  afterAll(resetDb);

  const live = (token: string) => request("GET", `/awards/events/${eventId}/live`, token);
  const overview = (token: string) => request("GET", `/admin/stats/overview?eventId=${eventId}`, token);
  const classOf = (json: any, categoryId: string) => json.classes.find((c: any) => c.categoryId === categoryId);

  it("live endpoint: judge is refused (403), jury_president gets the live view (200)", async () => {
    const forbidden = await live(judge1.token);
    expect(forbidden.status).toBe(403);

    const res = await live(president.token);
    expect(res.status).toBe(200);
    expect(typeof res.json.updatedAt).toBe("string");
    expect(res.json.classes.map((c: any) => c.categoryId)).toEqual([c1, c2]);
    expect(res.json.totals).toMatchObject({ classes: 2, closed: 1, models: 3, votesExpected: 6, votesCast: 5 });
  }, { timeout: LIVE_TIMEOUT });

  it("live endpoint: open class shows projected medals and progress, closed class shows frozen medals", async () => {
    const { json } = await live(president.token);

    expect(classOf(json, c1)).toMatchObject({
      name: "C1", phase: "judging", models: 2, votesExpected: 4, votesCast: 3, percent: 75,
      judgesTotal: 2, judgesCompleted: 0, discordant: 1, medals: { Silver: 2 }
    });
    expect(classOf(json, c2)).toMatchObject({
      phase: "closed", models: 1, votesExpected: 2, votesCast: 2, percent: 100, discordant: 0, medals: { "Highly Commended": 1 }
    });
    // the open class has no frozen awards: nothing persisted for it
    const frozenOpen = await getTestDb().select().from(awardsTable).where(eq(awardsTable.categoryId, c1));
    expect(frozenOpen).toEqual([]);
    expect(json.totals.medals).toEqual({ Silver: 2, "Highly Commended": 1 });
  }, { timeout: LIVE_TIMEOUT });

  it("live endpoint: a new vote changes the projected medals of the open class, the frozen ones do not move", async () => {
    expect((await request("POST", "/judge/vote", judge2.token, { modelId: m3, rank: 4 })).status).toBe(200);

    const { json } = await live(president.token);
    // m3 = round((3+4)*3/2) = round(10.5) = 11 => Gold (11-12), not discordant (4*2-7 = 1 <= 2); m1 stays Silver
    expect(classOf(json, c1)).toMatchObject({ medals: { Silver: 1, Gold: 1 }, percent: 100, discordant: 1 });
    expect(classOf(json, c2).medals).toEqual({ "Highly Commended": 1 });
  }, { timeout: LIVE_TIMEOUT });

  it("live endpoint: a head-judge override of a frozen award is reflected in the closed class medals", async () => {
    const [award] = await getTestDb().select().from(awardsTable).where(eq(awardsTable.categoryId, c2));
    const patch = await request("PATCH", `/awards/${award.id}`, president.token, { medalLabel: "Gold", medalRank: 4, note: "Override" });
    expect(patch.status).toBe(200);

    const { json } = await live(president.token);
    expect(classOf(json, c2).medals).toEqual({ Gold: 1 });
    expect(json.totals.medals).toEqual({ Silver: 2, Gold: 1 });
  }, { timeout: LIVE_TIMEOUT });

  it("overview: honors summary (catalogue, assigned, exhibitor and class of the assignment) and commended total", async () => {
    const res = await overview(president.token);
    expect(res.status).toBe(200);
    expect(res.json.honors).toEqual({
      total: 2,
      assigned: 1,
      list: [{ code: "bos", name: "Best Of Show", exhibitor: "Anna Rossi", categoryName: "C2", displayNumber: 2 }]
    });
    // the closed class C2 has one award with medalRank 1 (Highly Commended)
    expect(res.json.commendedTotal).toBe(1);
    // existing fields still there; zero-model users: every user of the event's models is excluded
    expect(res.json.usersByCountry).toBeDefined();
    expect(res.json.zeroModelUsers.count).toBe(res.json.zeroModelUsers.list.length);
    expect(res.json.zeroModelUsers.list.map((u: any) => u.userId)).not.toContain(exhibitor.id);
    expect(res.json.zeroModelUsers.list.every((u: any) => typeof u.userId === "string")).toBe(true);
  }, { timeout: LIVE_TIMEOUT });
});
