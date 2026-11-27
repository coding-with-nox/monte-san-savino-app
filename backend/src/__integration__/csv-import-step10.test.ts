// fixtures must be imported first: it loads testApp, which sets the env (PG_DB=tenant_db_test, JWT_SECRET).
import { createEvent, createLevel, createUser, resetDb } from "./fixtures";
import { buildTestApp } from "./testApp";
import { getTestDb } from "./testDb";
import { describe, it, expect, beforeEach } from "bun:test";
import { eq } from "drizzle-orm";
import { usersTable } from "../identity/infra/persistence/schema";
import {
  awardBracketsTable, categoriesTable, honorAssignmentsTable, honorsTable, judgeAssignmentsTable, modelsTable, votesTable
} from "../contest/infra/persistence/schema";

type TestUser = Awaited<ReturnType<typeof createUser>>;

const app = buildTestApp();
const LONG = 20_000;

/** Sends a raw CSV body (text/csv) to an event-scoped import, as the Catalog tab does. */
async function importCsv(path: string, csv: string, opts: { token: string; eventId: string | null }) {
  const query = opts.eventId === null ? "" : `?eventId=${opts.eventId}`;
  const res = await app.handle(new Request(`http://localhost${path}${query}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${opts.token}`, "Content-Type": "text/csv" },
    body: csv
  }));
  return { status: res.status, json: (await res.json()) as any };
}

/** Class with a class number (createCategory does not set it). */
async function createClass(eventId: string, name: string, classNumber: string) {
  const id = crypto.randomUUID();
  await getTestDb().insert(categoriesTable).values({ id, eventId, name, status: "open", classNumber });
  return id;
}

async function createModel(categoryId: string, userId: string, levelId: string, code: number) {
  const id = crypto.randomUUID();
  await getTestDb().insert(modelsTable).values({ id, userId, categoryId, levelId, name: `Model ${code}`, code, displayNumber: 1 });
  return id;
}

const brackets = (eventId: string) =>
  getTestDb().select().from(awardBracketsTable).where(eq(awardBracketsTable.eventId, eventId));
const honors = (eventId: string) =>
  getTestDb().select().from(honorsTable).where(eq(honorsTable.eventId, eventId));
const assignments = (eventId: string) =>
  getTestDb().select().from(judgeAssignmentsTable).where(eq(judgeAssignmentsTable.eventId, eventId));

describe("integration CSV imports step 10 (medals, honors, jury)", () => {
  let manager: TestUser;
  let plain: TestUser;
  let judge: TestUser;
  let judge2: TestUser;
  let juryPresident: TestUser;
  let event: string;
  let otherEvent: string;
  let catA: string;
  let catB: string;
  let level: string;
  let modelA: string;
  let honorBop: string;

  // Shared data: created in beforeEach only (the `it` bodies perform the actions under test).
  beforeEach(async () => {
    await resetDb();
    await getTestDb().delete(honorAssignmentsTable);
    await getTestDb().delete(honorsTable);
    await getTestDb().delete(awardBracketsTable);
    manager = await createUser("manager");
    plain = await createUser("user");
    judge = await createUser("judge");
    judge2 = await createUser("judge");
    juryPresident = await createUser("jury_president");

    event = await createEvent("MSS");
    otherEvent = await createEvent("Other");
    catA = await createClass(event, "Class A", "12");
    catB = await createClass(event, "Class B", "13");
    level = await createLevel("Standard");
    modelA = await createModel(catA, plain.id, level, 201);

    await getTestDb().insert(awardBracketsTable).values([
      { id: crypto.randomUUID(), eventId: event, medalLabel: "Old", medalRank: 1, lowLimit: 1, highLimit: 2 },
      { id: crypto.randomUUID(), eventId: otherEvent, medalLabel: "Elsewhere", medalRank: 2, lowLimit: 3, highLimit: 4 }
    ]);
    honorBop = crypto.randomUUID();
    await getTestDb().insert(honorsTable).values([
      { id: honorBop, eventId: event, code: "bop", name: "Old name", sortOrder: 1 },
      { id: crypto.randomUUID(), eventId: event, code: "keep", name: "Never deleted", sortOrder: 7 }
    ]);
  });

  describe("POST /admin/import/medals", () => {
    const PATH = "/admin/import/medals";

    it("replaces the brackets of the event only (in one transaction)", async () => {
      const res = await importCsv(PATH, "Medal,Value,Low Limit,High Limit\nBronze,2,5,7\nGold,4,11,12", { token: manager.token, eventId: event });
      expect(res.status).toBe(200);
      expect(res.json).toEqual({ imported: 2, errors: [] });
      const rows = await brackets(event);
      expect(rows.map((r) => [r.medalLabel, r.medalRank, r.lowLimit, r.highLimit]).sort()).toEqual([
        ["Bronze", 2, 5, 7],
        ["Gold", 4, 11, 12]
      ]);
      expect((await brackets(otherEvent)).map((r) => r.medalLabel)).toEqual(["Elsewhere"]);
    }, LONG);

    it("is all-or-nothing: a bracket rule violation answers 422 with the line and changes nothing", async () => {
      const res = await importCsv(PATH, "Bronze,2,5,7\nGold,4,12,11\nSilver,3,8,10", { token: manager.token, eventId: event });
      expect(res.status).toBe(422);
      expect(res.json.imported).toBe(0);
      expect(res.json.errors).toEqual([expect.objectContaining({ line: 2, message: expect.stringContaining("lowLimit") })]);
      expect((await brackets(event)).map((r) => r.medalLabel)).toEqual(["Old"]);
    }, LONG);

    it("rejects a duplicate Value and a Value above the medal rank limit", async () => {
      const res = await importCsv(PATH, "Bronze,2,5,7\nBronze bis,2,8,9\nGold,11,11,12", { token: manager.token, eventId: event });
      expect(res.status).toBe(422);
      expect(res.json.errors).toEqual([
        { line: 2, message: "Duplicate Value 2 in file" },
        expect.objectContaining({ line: 3, message: expect.stringContaining("medalRank") })
      ]);
      expect((await brackets(event)).map((r) => r.medalLabel)).toEqual(["Old"]);
    }, LONG);

    it("refuses an empty file (422, nothing changed), needs a valid known event and a manager", async () => {
      const empty = await importCsv(PATH, "Medal,Value,Low Limit,High Limit\n", { token: manager.token, eventId: event });
      expect(empty.status).toBe(422);
      expect(empty.json.errors).toEqual([{ line: 0, message: "No rows to import" }]);

      const noEvent = await importCsv(PATH, "Bronze,2,5,7", { token: manager.token, eventId: null });
      expect(noEvent.status).toBe(422);
      const unknown = await importCsv(PATH, "Bronze,2,5,7", { token: manager.token, eventId: crypto.randomUUID() });
      expect(unknown.status).toBe(404);

      const forbidden = await importCsv(PATH, "Bronze,2,5,7", { token: plain.token, eventId: event });
      expect(forbidden.status).toBe(403);
      expect((await brackets(event)).map((r) => r.medalLabel)).toEqual(["Old"]);
    }, LONG);
  });

  describe("POST /admin/import/honors", () => {
    const PATH = "/admin/import/honors";

    it("inserts new codes and updates name/order of existing ones (matched case-insensitively), never deletes", async () => {
      const res = await importCsv(PATH, "Code,Name,Order\nBOP,Best Of Painter Plus,5\nbos,Best Of Show\nbs,Best Of Sculpture,9", { token: manager.token, eventId: event });
      expect(res.status).toBe(200);
      expect(res.json).toEqual({ imported: 3, errors: [] });
      const rows = await honors(event);
      expect(rows.map((h) => [h.code, h.name, h.sortOrder]).sort()).toEqual([
        ["bop", "Best Of Painter Plus", 5],
        ["bos", "Best Of Show", 8], // no order in the file: after the last sort order of the event (7)
        ["bs", "Best Of Sculpture", 9],
        ["keep", "Never deleted", 7]
      ]);
      expect(rows.find((h) => h.id === honorBop)?.code).toBe("bop");
    }, LONG);

    it("is all-or-nothing: a too long code, a too long name or a bad order answers 422 and nothing is written", async () => {
      const longCode = "x".repeat(21);
      const longName = "n".repeat(121);
      const res = await importCsv(PATH, `new1,Fine\n${longCode},Too long code\nnew2,${longName}\nnew3,Fine,x`, { token: manager.token, eventId: event });
      expect(res.status).toBe(422);
      expect(res.json.imported).toBe(0);
      expect(res.json.errors.map((e: { line: number }) => e.line)).toEqual([2, 3, 4]);
      expect((await honors(event)).map((h) => h.code).sort()).toEqual(["bop", "keep"]);
    }, LONG);

    it("rejects a code repeated in the file and requires a manager", async () => {
      const dup = await importCsv(PATH, "a1,One\nA1,Two", { token: manager.token, eventId: event });
      expect(dup.status).toBe(422);
      expect(dup.json.errors).toEqual([{ line: 2, message: 'Duplicate code "A1" in file' }]);
      const forbidden = await importCsv(PATH, "a1,One", { token: judge.token, eventId: event });
      expect(forbidden.status).toBe(403);
      expect((await honors(event)).length).toBe(2);
    }, LONG);
  });

  describe("POST /admin/import/jury", () => {
    const PATH = "/admin/import/jury";
    const HEADER = "Judge Email,Class Number,Stand-in\n";

    it("replaces the assignments of the event (stand-in, whole-event, jury president accepted)", async () => {
      await getTestDb().insert(judgeAssignmentsTable).values([
        { id: crypto.randomUUID(), eventId: event, judgeId: judge.id, categoryId: null, standingIn: false },
        { id: crypto.randomUUID(), eventId: event, judgeId: judge2.id, categoryId: catB, standingIn: false }
      ]);
      const csv = `${HEADER}${judge.email},12,yes\n${judge2.email},,\n${juryPresident.email},13,0`;
      const res = await importCsv(PATH, csv, { token: manager.token, eventId: event });
      expect(res.status).toBe(200);
      expect(res.json).toEqual({ imported: 3, errors: [] });
      const rows = await assignments(event);
      expect(rows.map((a) => [a.judgeId, a.categoryId, a.standingIn]).sort()).toEqual([
        [judge.id, catA, true],
        [judge2.id, null, false],
        [juryPresident.id, catB, false]
      ].sort());
    }, LONG);

    it("is all-or-nothing: unknown email, wrong role, unknown class or stand-in without class answer 422 and change nothing", async () => {
      await getTestDb().insert(judgeAssignmentsTable).values({ id: crypto.randomUUID(), eventId: event, judgeId: judge2.id, categoryId: null, standingIn: false });
      const csv = `${HEADER}${judge.email},12,0\nnobody@example.com,12,0\n${plain.email},12,0\n${judge2.email},99,0\n${judge2.email},,1`;
      const res = await importCsv(PATH, csv, { token: manager.token, eventId: event });
      expect(res.status).toBe(422);
      expect(res.json.imported).toBe(0);
      expect(res.json.errors).toEqual([
        { line: 3, message: "No user with email nobody@example.com" },
        { line: 4, message: `${plain.email} is not a judge (role must be judge or higher)` },
        { line: 5, message: 'Unknown Class Number "99" in this event' },
        { line: 6, message: "Stand-in requires a Class Number" }
      ]);
      const rows = await assignments(event);
      expect(rows.map((a) => [a.judgeId, a.categoryId])).toEqual([[judge2.id, null]]);
    }, LONG);

    it("refuses to remove a class assignment whose judge already voted in that class (422 naming judge and class)", async () => {
      await getTestDb().insert(judgeAssignmentsTable).values([
        { id: crypto.randomUUID(), eventId: event, judgeId: judge.id, categoryId: catA, standingIn: false },
        { id: crypto.randomUUID(), eventId: event, judgeId: judge2.id, categoryId: catB, standingIn: false }
      ]);
      await getTestDb().insert(votesTable).values({ id: crypto.randomUUID(), judgeId: judge.id, modelId: modelA, rank: 1 });
      // The file drops judge (class 12, already voted) and keeps judge2 only.
      const res = await importCsv(PATH, `${HEADER}${judge2.email},13,0`, { token: manager.token, eventId: event });
      expect(res.status).toBe(422);
      expect(res.json.imported).toBe(0);
      expect(res.json.errors).toEqual([
        { line: 0, message: `Judge ${judge.email} has already voted in class 12 (Class A): the assignment cannot be removed` }
      ]);
      const rows = await assignments(event);
      expect(rows.map((a) => [a.judgeId, a.categoryId]).sort()).toEqual([
        [judge.id, catA],
        [judge2.id, catB]
      ].sort());
    }, LONG);

    it("refuses to remove a whole-event assignment when the judge voted in any class of the event", async () => {
      await getTestDb().insert(judgeAssignmentsTable).values({ id: crypto.randomUUID(), eventId: event, judgeId: judge.id, categoryId: null, standingIn: false });
      await getTestDb().insert(votesTable).values({ id: crypto.randomUUID(), judgeId: judge.id, modelId: modelA, rank: 2 });
      const res = await importCsv(PATH, `${HEADER}${judge2.email},,`, { token: manager.token, eventId: event });
      expect(res.status).toBe(422);
      expect(res.json.errors).toEqual([
        { line: 0, message: `Judge ${judge.email} has already voted in this event: the assignment cannot be removed` }
      ]);
      expect((await assignments(event)).map((a) => a.judgeId)).toEqual([judge.id]);
    }, LONG);

    it("allows removing judges without votes, keeps a judge with votes when the file keeps it, and never touches other events", async () => {
      await getTestDb().insert(judgeAssignmentsTable).values([
        { id: crypto.randomUUID(), eventId: event, judgeId: judge.id, categoryId: catA, standingIn: false },
        { id: crypto.randomUUID(), eventId: event, judgeId: judge2.id, categoryId: catB, standingIn: false },
        { id: crypto.randomUUID(), eventId: otherEvent, judgeId: judge2.id, categoryId: null, standingIn: false }
      ]);
      await getTestDb().insert(votesTable).values({ id: crypto.randomUUID(), judgeId: judge.id, modelId: modelA, rank: 1 });
      // judge2 (no votes) is removed from this event; judge (with votes) is kept in the same class.
      const res = await importCsv(PATH, `${HEADER}${judge.email},12,0`, { token: manager.token, eventId: event });
      expect(res.status).toBe(200);
      expect((await assignments(event)).map((a) => [a.judgeId, a.categoryId])).toEqual([[judge.id, catA]]);
      expect((await assignments(otherEvent)).map((a) => a.judgeId)).toEqual([judge2.id]);
    }, LONG);
  });

  it("does not write users: the imports only replace assignments, brackets and honors", async () => {
    const before = await getTestDb().select({ id: usersTable.id }).from(usersTable);
    await importCsv("/admin/import/jury", `Judge Email,Class Number,Stand-in\n${judge.email},12,0`, { token: manager.token, eventId: event });
    const after = await getTestDb().select({ id: usersTable.id }).from(usersTable);
    expect(after.length).toBe(before.length);
  }, LONG);
});
