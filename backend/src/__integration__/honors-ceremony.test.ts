import { describe, it, expect, beforeEach } from "bun:test";
import { eq } from "drizzle-orm";
import { createCategory, createEvent, createLevel, createUser, request, resetDb } from "./fixtures";
import { getTestDb } from "./testDb";
import {
  awardsTable, categoriesTable, honorAssignmentsTable, honorsTable, modelsTable, settingsTable
} from "../contest/infra/persistence/schema";
import { userProfilesTable } from "../identity/infra/persistence/schema";
import { MSS_HONOR_PRESET } from "../contest/domain/honors";

describe("integration honors (special awards) and ceremony, step 5", () => {
  let manager: Awaited<ReturnType<typeof createUser>>;
  let eventId: string;
  let levelId: string;
  let code = 0;

  beforeEach(async () => {
    await resetDb();
    const db = getTestDb();
    await db.delete(honorAssignmentsTable);
    await db.delete(honorsTable);
    await db.delete(awardsTable);
    manager = await createUser("manager");
    eventId = await createEvent("Premiazione");
    levelId = await createLevel("Master");
    code = 0;
  });

  async function model(categoryId: string, ownerId: string, displayNumber: number | null, name: string) {
    const id = crypto.randomUUID();
    code += 1;
    await getTestDb().insert(modelsTable).values({ id, userId: ownerId, categoryId, levelId, name, code, displayNumber });
    return id;
  }

  async function award(categoryId: string, modelId: string, medalLabel: string, medalRank: number) {
    await getTestDb().insert(awardsTable).values({
      id: crypto.randomUUID(), categoryId, modelId, totalScore: 0, medalLabel, medalRank, source: "aggregate"
    });
  }

  async function classInfo(categoryId: string, classNumber: string, presentationOrder: number | null) {
    await getTestDb().update(categoriesTable).set({ classNumber, presentationOrder }).where(eq(categoriesTable.id, categoryId as any));
  }

  async function createHonor(code: string, name: string, targetEventId = eventId) {
    return request("POST", "/admin/honors", manager.token, { eventId: targetEventId, code, name });
  }

  const honorList = (targetEventId = eventId) => request("GET", `/admin/honors?eventId=${targetEventId}`, manager.token);
  const assign = (honorId: string, body: unknown) => request("POST", `/admin/honors/${honorId}/assign`, manager.token, body);

  describe("catalogue CRUD", () => {
    it("creates, lists, updates and deletes an honor; duplicate codes are refused case-insensitively", async () => {
      const created = await createHonor("bop", "Best Of Painter");
      expect(created.status).toBe(200);
      const id = created.json.id as string;

      const dup = await createHonor("BOP", "Other");
      expect(dup.status).toBe(409);
      expect(dup.json.code).toBe("DUPLICATE_CODE");

      const list = await honorList();
      expect(list.status).toBe(200);
      expect(list.json).toHaveLength(1);
      expect(list.json[0]).toMatchObject({ id, code: "bop", name: "Best Of Painter", sortOrder: 1, assignment: null });

      const updated = await request("PUT", `/admin/honors/${id}`, manager.token, { name: "Best Painter" });
      expect(updated.status).toBe(200);
      expect(updated.json.name).toBe("Best Painter");

      const deleted = await request("DELETE", `/admin/honors/${id}`, manager.token);
      expect(deleted.status).toBe(200);
      expect((await honorList()).json).toHaveLength(0);
    });

    it("validates code and name length and the event", async () => {
      expect((await createHonor("", "x")).status).toBe(422);
      expect((await createHonor("a".repeat(21), "x")).status).toBe(422);
      expect((await createHonor("ok", "n".repeat(121))).status).toBe(422);
      expect((await createHonor("ok", "x", crypto.randomUUID())).status).toBe(404);
      expect((await request("GET", "/admin/honors", manager.token)).status).toBe(422);
    });

    it("refuses to delete an assigned honor (409) until the assignment is removed", async () => {
      const honorId = (await createHonor("bos", "Best Of Show")).json.id as string;
      const categoryId = await createCategory(eventId, "Pittura", "open");
      const owner = await createUser();
      await model(categoryId, owner.id, 4, "Cavaliere");

      expect((await assign(honorId, { categoryId, displayNumber: 4 })).status).toBe(200);
      const refused = await request("DELETE", `/admin/honors/${honorId}`, manager.token);
      expect(refused.status).toBe(409);
      expect(refused.json.code).toBe("HONOR_ASSIGNED");

      expect((await request("DELETE", `/admin/honors/${honorId}/assignment`, manager.token)).status).toBe(200);
      expect((await request("DELETE", `/admin/honors/${honorId}`, manager.token)).status).toBe(200);
    });
  });

  describe("preset", () => {
    it("inserts the MSS catalogue once, in catalogue order, and is idempotent", async () => {
      const first = await request("POST", "/admin/honors/preset", manager.token, { eventId });
      expect(first.status).toBe(200);
      expect(first.json.inserted).toBe(MSS_HONOR_PRESET.length);
      expect(first.json.honors.map((h: any) => h.code)).toEqual(MSS_HONOR_PRESET.map((p) => p.code));

      const second = await request("POST", "/admin/honors/preset", manager.token, { eventId });
      expect(second.json.inserted).toBe(0);
      expect((await honorList()).json).toHaveLength(MSS_HONOR_PRESET.length);
    });

    it("skips codes already present in the event", async () => {
      await createHonor("BOP", "Custom painter");
      const res = await request("POST", "/admin/honors/preset", manager.token, { eventId });
      expect(res.json.inserted).toBe(MSS_HONOR_PRESET.length - 1);
      const bop = (await honorList()).json.find((h: any) => h.code.toLowerCase() === "bop");
      expect(bop.name).toBe("Custom painter");
    });

    it("404 for an unknown event", async () => {
      const res = await request("POST", "/admin/honors/preset", manager.token, { eventId: crypto.randomUUID() });
      expect(res.status).toBe(404);
    });
  });

  describe("assignment", () => {
    let categoryId: string;
    let otherCategoryId: string;
    let m1: string;
    let m3: string;

    beforeEach(async () => {
      const owner = await createUser();
      categoryId = await createCategory(eventId, "Pittura", "open");
      // A class of another event: not a valid target for this event's honors.
      const otherEventId = await createEvent("Altro evento");
      otherCategoryId = await createCategory(otherEventId, "Altra", "open");
      m1 = await model(categoryId, owner.id, 4, "Cavaliere");
      await model(categoryId, owner.id, 4, "Fante");
      m3 = await model(categoryId, owner.id, 5, "Arciere");
    });

    it("assigns an honor to a whole display once (409 on the second try)", async () => {
      const honorId = (await createHonor("bos", "Best Of Show")).json.id as string;
      const res = await assign(honorId, { categoryId, displayNumber: 4 });
      expect(res.status).toBe(200);
      expect(res.json.assignment).toMatchObject({
        categoryId, categoryName: "Pittura", displayNumber: 4, modelId: null, wholeDisplay: true
      });

      const again = await assign(honorId, { categoryId, displayNumber: 4 });
      expect(again.status).toBe(409);
      expect(again.json.code).toBe("ALREADY_ASSIGNED");
    });

    it("assigns a single model of the display, with its name and code", async () => {
      const honorId = (await createHonor("bop", "Best Of Painter")).json.id as string;
      const res = await assign(honorId, { categoryId, displayNumber: 4, modelId: m1 });
      expect(res.status).toBe(200);
      expect(res.json.assignment).toMatchObject({ modelId: m1, modelName: "Cavaliere", wholeDisplay: false, displayNumber: 4 });
      expect(res.json.assignment.modelCode).toBeString();
    });

    it("422 for a display that does not exist in the category, 422 for a model outside the display", async () => {
      const honorId = (await createHonor("bos", "Best Of Show")).json.id as string;
      const noDisplay = await assign(honorId, { categoryId, displayNumber: 99 });
      expect(noDisplay.status).toBe(422);
      expect(noDisplay.json.code).toBe("DISPLAY_NOT_FOUND");

      const wrongModel = await assign(honorId, { categoryId, displayNumber: 4, modelId: m3 });
      expect(wrongModel.status).toBe(422);
      expect(wrongModel.json.code).toBe("MODEL_NOT_IN_DISPLAY");

      const wrongCategory = await assign(honorId, { categoryId: otherCategoryId, displayNumber: 4 });
      expect(wrongCategory.status).toBe(422);
      expect(wrongCategory.json.code).toBe("CATEGORY_NOT_IN_EVENT");
    });

    it("404 for an unknown model, and invalid uuids are refused", async () => {
      const honorId = (await createHonor("bos", "Best Of Show")).json.id as string;
      const unknown = await assign(honorId, { categoryId, displayNumber: 4, modelId: crypto.randomUUID() });
      expect(unknown.status).toBe(404);
      expect((await assign(honorId, { categoryId: "nope", displayNumber: 4 })).status).toBe(422);
      expect((await assign(crypto.randomUUID(), { categoryId, displayNumber: 4 })).status).toBe(404);
    });

    it("removes the assignment; a second removal is 404", async () => {
      const honorId = (await createHonor("bos", "Best Of Show")).json.id as string;
      await assign(honorId, { categoryId, displayNumber: 4 });
      expect((await request("DELETE", `/admin/honors/${honorId}/assignment`, manager.token)).status).toBe(200);
      expect((await request("DELETE", `/admin/honors/${honorId}/assignment`, manager.token)).status).toBe(404);
      expect((await honorList()).json[0].assignment).toBeNull();
    });
  });

  describe("ceremony data and prints", () => {
    let scultura: string;
    let pittura: string;
    let open: string;
    let noMedals: string;
    let busto: string;

    beforeEach(async () => {
      const luca = await createUser();
      const mario = await createUser();
      const anna = await createUser();
      await getTestDb().insert(userProfilesTable).values([
        { userId: luca.id, firstName: "Luca", lastName: "Neri" },
        { userId: mario.id, firstName: "Mario", lastName: "Rossi" },
        { userId: anna.id, firstName: "Anna", lastName: "Verdi" }
      ]);

      // Pittura (number 10, presented second): display 3 whole display Gold, display 4 Silver + Bronze.
      pittura = await createCategory(eventId, "Pittura", "closed");
      await classInfo(pittura, "10", 2);
      const p3a = await model(pittura, luca.id, 3, "Drago");
      const p3b = await model(pittura, luca.id, 3, "Ninfa");
      const p4a = await model(pittura, mario.id, 4, "Cavaliere");
      const p4b = await model(pittura, mario.id, 4, "Fante");
      await award(pittura, p3a, "Gold", 4);
      await award(pittura, p3b, "Gold", 4);
      await award(pittura, p4a, "Silver", 3);
      await award(pittura, p4b, "Bronze", 2);

      // Scultura (number 2, presented first): one Gold model.
      scultura = await createCategory(eventId, "Scultura", "closed");
      await classInfo(scultura, "2", 1);
      busto = await model(scultura, anna.id, 1, "Busto");
      await award(scultura, busto, "Gold", 4);

      // Open class with medals and a closed class with only None: neither is in the ceremony.
      open = await createCategory(eventId, "Aperta", "open");
      await classInfo(open, "1", 0);
      await award(open, await model(open, anna.id, 2, "Aperto"), "Gold", 4);
      noMedals = await createCategory(eventId, "Senza premi", "closed");
      await award(noMedals, await model(noMedals, anna.id, 3, "Nessuno"), "None", 0);
    });

    it("lists closed classes with medals by presentation order, then prizes by prize order and rank", async () => {
      const res = await request("GET", `/awards/events/${eventId}/ceremony`, manager.token);
      expect(res.status).toBe(200);
      expect(res.json.classes.map((c: any) => c.name)).toEqual(["Scultura", "Pittura"]);

      const pitturaClass = res.json.classes[1];
      expect(pitturaClass).toMatchObject({ categoryId: pittura, classNumber: "10", presentationOrder: 2 });
      // Default prize order: Highly Commended, Bronze, Silver, Gold.
      expect(pitturaClass.prizes.map((p: any) => p.medalLabel)).toEqual(["Bronze", "Silver", "Gold"]);
      expect(pitturaClass.prizes[2]).toMatchObject({ wholeDisplay: true, displayNumber: 3, modelName: null, modelCode: null, exhibitor: "Luca Neri" });
      expect(pitturaClass.prizes[0]).toMatchObject({ wholeDisplay: false, modelName: "Fante", exhibitor: "Mario Rossi", displayNumber: 4 });
    });

    it("follows a custom prize-order setting", async () => {
      await getTestDb().insert(settingsTable).values({ key: "prizeOrder", value: JSON.stringify(["Gold", "Silver", "Bronze"]) });
      const res = await request("GET", `/awards/events/${eventId}/ceremony`, manager.token);
      expect(res.json.classes[1].prizes.map((p: any) => p.medalLabel)).toEqual(["Gold", "Silver", "Bronze"]);
    });

    it("returns only assigned honors, in catalogue order", async () => {
      await request("POST", "/admin/honors/preset", manager.token, { eventId });
      const honors = (await honorList()).json as any[];
      const bos = honors.find((h) => h.code === "bos");
      const bop = honors.find((h) => h.code === "bop");
      await assign(bos.id, { categoryId: pittura, displayNumber: 3 });
      await assign(bop.id, { categoryId: scultura, displayNumber: 1, modelId: busto });

      const res = await request("GET", `/awards/events/${eventId}/ceremony`, manager.token);
      expect(res.json.honors.map((h: any) => h.code)).toEqual(["bop", "bos"]);
      expect(res.json.honors[0]).toMatchObject({ categoryName: "Scultura", exhibitor: "Anna Verdi", wholeDisplay: false, modelName: "Busto" });
      expect(res.json.honors[1]).toMatchObject({ categoryName: "Pittura", exhibitor: "Luca Neri", wholeDisplay: true, modelName: null });
    });

    it("ceremony is manager-only", async () => {
      const user = await createUser("user");
      expect((await request("GET", `/awards/events/${eventId}/ceremony`, user.token)).status).toBe(403);
    });

    it("prints medals and honors as html (200), with lang en", async () => {
      await request("POST", "/admin/honors/preset", manager.token, { eventId });
      const honors = (await honorList()).json as any[];
      await assign(honors.find((h) => h.code === "bos").id, { categoryId: pittura, displayNumber: 3 });

      const medals = await request("GET", `/exports/events/${eventId}/presentation-medals`, manager.token);
      expect(medals.status).toBe(200);
      expect(medals.text).toContain("<h2>Scultura</h2>");
      expect(medals.text.indexOf("Scultura")).toBeLessThan(medals.text.indexOf("Pittura"));
      expect(medals.text).not.toContain("Aperta");

      const medalsEn = await request("GET", `/exports/events/${eventId}/presentation-medals?lang=en`, manager.token);
      expect(medalsEn.status).toBe(200);
      expect(medalsEn.text).toContain('<html lang="en">');

      const honorsPrint = await request("GET", `/exports/events/${eventId}/presentation-honors`, manager.token);
      expect(honorsPrint.status).toBe(200);
      expect(honorsPrint.text).toContain("Best Of Show");

      expect((await request("GET", `/exports/events/${crypto.randomUUID()}/presentation-honors`, manager.token)).status).toBe(404);
      expect((await request("GET", "/exports/events/not-a-uuid/presentation-medals", manager.token)).status).toBe(422);
    });
  });
});
