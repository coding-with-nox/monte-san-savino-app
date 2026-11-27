// fixtures must be imported first: it loads testApp, which sets the env (PG_DB=tenant_db_test, JWT_SECRET).
import { createCategory, createEvent, createLevel, createUser, request, resetDb } from "./fixtures";
import { buildTestApp } from "./testApp";
import { getTestDb } from "./testDb";
import { describe, it, expect, beforeEach } from "bun:test";
import { userProfilesTable } from "../identity/infra/persistence/schema";
import { modelsTable, previousResultsTable, settingsTable } from "../contest/infra/persistence/schema";

type TestUser = Awaited<ReturnType<typeof createUser>>;

const app = buildTestApp();
const CSV_HEADER = "Email,First Name,Last Name,Level,Medal Rank,Year";
const LONG = 20_000;

const setSetting = (key: string, value: string) =>
  getTestDb().insert(settingsTable).values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value, updatedAt: new Date() } });

const insertModel = async (values: { userId: string; categoryId: string; levelId: string; name: string; code: number; displayNumber: number }) => {
  const id = crypto.randomUUID();
  await getTestDb().insert(modelsTable).values({ id, ...values });
  return id;
};

/** Sends a raw CSV body (text/csv), as the import UI does. */
async function importCsv(token: string, csv: string) {
  const res = await app.handle(new Request("http://localhost/admin/import/previous-results", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "text/csv" },
    body: csv
  }));
  return { status: res.status, json: await res.json() as any };
}

describe("integration level lock and level-up", () => {
  let admin: TestUser;
  let manager: TestUser;
  let mario: TestUser;
  let luca: TestUser;
  let anna: TestUser;
  let giulia: TestUser;
  let event1: string;
  let event2: string;
  let catStd: string;
  let catOpen: string;
  let catEvent2: string;
  let lvlStandard: string;
  let lvlOpen: string;
  let lvlAll: string;
  let lucaAllModelId: string;

  // Shared data: created in beforeEach only (the `it` bodies perform the actions under test).
  beforeEach(async () => {
    await resetDb();
    admin = await createUser("admin");
    manager = await createUser("manager");
    mario = await createUser("user");
    luca = await createUser("user");
    anna = await createUser("user");
    giulia = await createUser("user");

    await getTestDb().insert(userProfilesTable).values([
      { userId: mario.id, firstName: "Mario", lastName: "Rossi" },
      { userId: luca.id, firstName: "Luca", lastName: "Neri" },
      { userId: anna.id, firstName: "Anna", lastName: "Verdi" },
      { userId: giulia.id, firstName: "Giulia", lastName: "Bianchi" }
    ]);

    event1 = await createEvent("Event one");
    event2 = await createEvent("Event two");
    catStd = await createCategory(event1, "Standard class");
    catOpen = await createCategory(event1, "Open class");
    catEvent2 = await createCategory(event2, "Other class");
    lvlStandard = await createLevel("Standard");
    lvlOpen = await createLevel("Open");
    lvlAll = await createLevel("All");

    // Mario: Standard in event one. Luca: Standard and All in event one. Anna: Standard in event one.
    // Giulia: Open in event one, Standard in event two.
    await insertModel({ userId: mario.id, categoryId: catStd, levelId: lvlStandard, name: "Mario Std", code: 101, displayNumber: 1 });
    await insertModel({ userId: luca.id, categoryId: catStd, levelId: lvlStandard, name: "Luca Std", code: 102, displayNumber: 2 });
    lucaAllModelId = await insertModel({ userId: luca.id, categoryId: catStd, levelId: lvlAll, name: "Luca All", code: 103, displayNumber: 2 });
    await insertModel({ userId: anna.id, categoryId: catOpen, levelId: lvlStandard, name: "Anna Std", code: 104, displayNumber: 3 });
    await insertModel({ userId: giulia.id, categoryId: catOpen, levelId: lvlOpen, name: "Giulia Open", code: 105, displayNumber: 4 });
    await insertModel({ userId: giulia.id, categoryId: catEvent2, levelId: lvlStandard, name: "Giulia Std 2", code: 106, displayNumber: 4 });

    // Previous results: Mario Gold by email; Anna Gold by name (odd case, lower-case level); Luca Silver; Giulia Gold by email.
    await getTestDb().insert(previousResultsTable).values([
      { id: crypto.randomUUID(), email: mario.email, firstName: null, lastName: null, levelName: "Standard", medalRank: 4, year: 2024 },
      { id: crypto.randomUUID(), email: null, firstName: "anna", lastName: "VERDI", levelName: "standard", medalRank: 5, year: 2023 },
      { id: crypto.randomUUID(), email: null, firstName: "Luca", lastName: "Neri", levelName: "Standard", medalRank: 3, year: 2023 },
      { id: crypto.randomUUID(), email: giulia.email, firstName: null, lastName: null, levelName: "Standard", medalRank: 4, year: 2022 }
    ]);
  });

  describe("level lock (lockLevelToFirstSelection)", () => {
    beforeEach(async () => {
      await setSetting("lockLevelToFirstSelection", "true");
    });

    it("POST /models: a different non-All level than the first selection is refused (422 LEVEL_LOCKED)", async () => {
      const res = await request("POST", "/models", mario.token, { name: "Second", categoryId: catStd, levelId: lvlOpen });
      expect(res.status).toBe(422);
      expect(res.json).toMatchObject({ code: "LEVEL_LOCKED", lockedLevelId: lvlStandard, lockedLevelName: "Standard" });
    }, LONG);

    it("POST /models: the same level and All are allowed; another event is not locked", async () => {
      const same = await request("POST", "/models", mario.token, { name: "Same", categoryId: catStd, levelId: lvlStandard });
      expect(same.status).toBe(200);
      const all = await request("POST", "/models", mario.token, { name: "All", categoryId: catStd, levelId: lvlAll });
      expect(all.status).toBe(200);
      const otherEvent = await request("POST", "/models", mario.token, { name: "Other event", categoryId: catEvent2, levelId: lvlOpen });
      expect(otherEvent.status).toBe(200);
    }, LONG);

    it("POST /models on behalf of another participant is subject to the same rule (manager)", async () => {
      const res = await request("POST", "/models", manager.token, { name: "For Mario", categoryId: catStd, levelId: lvlOpen, userId: mario.id });
      expect(res.status).toBe(422);
      expect(res.json.code).toBe("LEVEL_LOCKED");
    }, LONG);

    it("PUT /models/:id: a level change to a locked level is refused; keeping the level is not", async () => {
      const refused = await request("PUT", `/models/${lucaAllModelId}`, luca.token, { levelId: lvlOpen });
      expect(refused.status).toBe(422);
      expect(refused.json).toMatchObject({ code: "LEVEL_LOCKED", lockedLevelId: lvlStandard, lockedLevelName: "Standard" });

      const sameLevel = await request("PUT", `/models/${lucaAllModelId}`, luca.token, { levelId: lvlAll, name: "Luca All v2" });
      expect(sameLevel.status).toBe(200);
      const renamed = await request("PUT", `/models/${lucaAllModelId}`, luca.token, { name: "Luca All v3" });
      expect(renamed.status).toBe(200);
    }, LONG);

    it("with the setting off nothing is locked", async () => {
      await setSetting("lockLevelToFirstSelection", "false");
      const res = await request("POST", "/models", mario.token, { name: "Open now", categoryId: catStd, levelId: lvlOpen });
      expect(res.status).toBe(200);
    });
  });

  describe("previous results import (manager)", () => {
    it("a user cannot import (403)", async () => {
      const res = await importCsv(mario.token, `${CSV_HEADER}\nx@example.com,X,Y,Standard,4,2025\n`);
      expect(res.status).toBe(403);
    });

    it("replaces all previous results and reports the imported count", async () => {
      const res = await importCsv(manager.token, [
        CSV_HEADER,
        "New@Example.com,Paolo,Gialli,Standard,4,2025",
        ",Sara,Blu,Open,3,",
      ].join("\n"));
      expect(res.status).toBe(200);
      expect(res.json).toEqual({ imported: 2, errors: [] });
      const rows = await getTestDb().select().from(previousResultsTable);
      expect(rows).toHaveLength(2);
      expect(rows.some((r) => r.email === "new@example.com")).toBe(true);
      expect(rows.some((r) => r.email === mario.email)).toBe(false);
    }, LONG);

    it("an invalid row refuses the whole file: nothing is replaced", async () => {
      const res = await importCsv(manager.token, [CSV_HEADER, "ok@example.com,A,B,Standard,4,", "bad@example.com,A,B,Standard,99,"].join("\n"));
      expect(res.status).toBe(422);
      expect(res.json.imported).toBe(0);
      expect(res.json.errors).toEqual([expect.objectContaining({ line: 3 })]);
      expect(await getTestDb().select().from(previousResultsTable)).toHaveLength(4);
    }, LONG);

    it("a file without rows is refused and changes nothing", async () => {
      const res = await importCsv(manager.token, `${CSV_HEADER}\n`);
      expect(res.status).toBe(422);
      expect(res.json.errors[0].message).toBe("No rows to import");
      expect(await getTestDb().select().from(previousResultsTable)).toHaveLength(4);
    });
  });

  describe("level-up report (manager)", () => {
    it("a user cannot read the report (403)", async () => {
      const res = await request("GET", `/admin/reports/level-up?eventId=${event1}`, mario.token);
      expect(res.status).toBe(403);
    });

    it("lists participants with a Standard model in the event who match a Standard gold", async () => {
      const res = await request("GET", `/admin/reports/level-up?eventId=${event1}`, manager.token);
      expect(res.status).toBe(200);
      // Luca (silver) and Giulia (no Standard model in event one) are excluded.
      expect(res.json.map((p: any) => p.name)).toEqual(["Mario Rossi", "Anna Verdi"]);
      const marioRow = res.json.find((p: any) => p.name === "Mario Rossi");
      expect(marioRow).toMatchObject({ participantNumber: mario.seqId, email: mario.email });
      expect(marioRow.models).toEqual([{ name: "Mario Std", code: expect.stringMatching(/-0001-101$/), categoryName: "Standard class" }]);
      const annaRow = res.json.find((p: any) => p.name === "Anna Verdi");
      expect(annaRow).toMatchObject({ participantNumber: anna.seqId, email: anna.email });
    }, LONG);

    it("is scoped to the event", async () => {
      const res = await request("GET", `/admin/reports/level-up?eventId=${event2}`, manager.token);
      expect(res.status).toBe(200);
      expect(res.json.map((p: any) => p.name)).toEqual(["Giulia Bianchi"]);
      expect(res.json[0].models.map((m: any) => m.name)).toEqual(["Giulia Std 2"]);
    });

    it("validates eventId (422) and the event (404)", async () => {
      expect((await request("GET", "/admin/reports/level-up?eventId=nope", manager.token)).status).toBe(422);
      expect((await request("GET", `/admin/reports/level-up?eventId=${crypto.randomUUID()}`, manager.token)).status).toBe(404);
    });

    it("the Excel export is an XLSX (zip) file", async () => {
      const res = await app.handle(new Request(`http://localhost/admin/reports/level-up/excel?eventId=${event1}`, {
        headers: { Authorization: `Bearer ${manager.token}` }
      }));
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("spreadsheetml");
      expect(res.headers.get("content-disposition")).toContain(`level-up-${event1}.xlsx`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      expect(String.fromCharCode(bytes[0], bytes[1])).toBe("PK");
    }, LONG);
  });

  describe("level-up warning for the user (levelUpWarning)", () => {
    beforeEach(async () => {
      await setSetting("levelUpWarning", "true");
    });

    it("warns a user who matches a Standard gold, by email or by name", async () => {
      const byEmail = await request("GET", `/users/me/level-up?eventId=${event1}`, mario.token);
      expect(byEmail.status).toBe(200);
      expect(byEmail.json).toEqual({ warn: true });
      const byName = await request("GET", `/users/me/level-up?eventId=${event1}`, anna.token);
      expect(byName.json).toEqual({ warn: true });
    }, LONG);

    it("does not warn a user with only a Silver Standard result", async () => {
      const res = await request("GET", `/users/me/level-up?eventId=${event1}`, luca.token);
      expect(res.json).toEqual({ warn: false });
    });

    it("never warns when the setting is off", async () => {
      await setSetting("levelUpWarning", "false");
      const res = await request("GET", `/users/me/level-up?eventId=${event1}`, mario.token);
      expect(res.json).toEqual({ warn: false });
    });

    it("validates eventId (422), the event (404) and the session (401)", async () => {
      expect((await request("GET", "/users/me/level-up?eventId=nope", mario.token)).status).toBe(422);
      expect((await request("GET", `/users/me/level-up?eventId=${crypto.randomUUID()}`, mario.token)).status).toBe(404);
      expect((await request("GET", `/users/me/level-up?eventId=${event1}`)).status).toBe(401);
    });
  });

  describe("settings", () => {
    it("PUT /admin/settings refuses non true/false values for the level settings (422)", async () => {
      const res = await request("PUT", "/admin/settings", admin.token, { levelUpWarning: "yes" });
      expect(res.status).toBe(422);
      const ok = await request("PUT", "/admin/settings", admin.token, { lockLevelToFirstSelection: "true", levelUpWarning: "false" });
      expect(ok.status).toBe(200);
    });
  });
});
