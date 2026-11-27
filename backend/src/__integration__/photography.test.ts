import { describe, it, expect, beforeEach, afterAll } from "bun:test";
import { eq } from "drizzle-orm";
import { createCategory, createEvent, createLevel, createUser, request, resetDb } from "./fixtures";
import { getTestDb } from "./testDb";
import { awardsTable, categoriesTable, modelsTable } from "../contest/infra/persistence/schema";

describe("integration photography list", () => {
  let admin: Awaited<ReturnType<typeof createUser>>;
  let eventId: string;
  let classA: string;
  let classB: string;
  let levelId: string;
  let code: number;

  beforeEach(async () => {
    await resetDb();
    await getTestDb().delete(awardsTable);
    admin = await createUser("admin");
    eventId = await createEvent("Fotografia");
    levelId = await createLevel();
    code = 0;
    // Two closed classes in presentation order; one open class that must never show up.
    classA = await createCategory(eventId, "Classe A", "closed");
    classB = await createCategory(eventId, "Classe B", "closed");
    await getTestDb().update(categoriesTable).set({ classNumber: "1", presentationOrder: 1 }).where(eq(categoriesTable.id, classA as any));
    await getTestDb().update(categoriesTable).set({ classNumber: "2", presentationOrder: 2 }).where(eq(categoriesTable.id, classB as any));
    const open = await createCategory(eventId, "Aperta");
    await getTestDb().update(categoriesTable).set({ classNumber: "3", presentationOrder: 3 }).where(eq(categoriesTable.id, open as any));
  });
  afterAll(resetDb);

  async function model(categoryId: string, displayNumber: number, owner: { id: string }, medalLabel: string, medalRank: number) {
    const id = crypto.randomUUID();
    code += 1;
    await getTestDb().insert(modelsTable).values({ id, userId: owner.id, categoryId, levelId, name: `Pezzo ${code}`, code, displayNumber });
    await getTestDb().insert(awardsTable).values({
      id: crypto.randomUUID(), categoryId, modelId: id, totalScore: 0, medalLabel, medalRank, source: "aggregate"
    });
    return id;
  }

  // Participants: each owns the models below; their email is the exhibitor name printed on the list.
  async function setup() {
    const gold1 = await createUser();
    const bronze2 = await createUser();
    const gold3 = await createUser();
    const gold4 = await createUser();
    await model(classA, 1, gold1, "Gold", 4);
    await model(classA, 2, bronze2, "Bronze", 2);
    // Whole display in class B: two models of display 5, both gold.
    await model(classB, 5, gold3, "Gold", 4);
    await model(classB, 5, gold3, "Gold", 4);
    await model(classB, 6, gold4, "Gold", 4);
    return { gold1, bronze2, gold3, gold4 };
  }

  const page = () => request("GET", `/exports/events/${eventId}/photography`, admin.token);

  it("lists the gold models of closed classes in class order then display order, by default", async () => {
    const { gold1, bronze2, gold3, gold4 } = await setup();

    const res = await page();
    expect(res.status).toBe(200);
    expect(res.text).toContain(gold1.email);
    expect(res.text).toContain(gold3.email);
    expect(res.text).toContain(gold4.email);
    expect(res.text).not.toContain(bronze2.email);
    expect(res.text).toContain("Intero display");
    expect(res.text.indexOf(gold1.email)).toBeLessThan(res.text.indexOf(gold3.email));
    expect(res.text.indexOf(gold3.email)).toBeLessThan(res.text.indexOf(gold4.email));
    expect(res.text).toContain(String(gold1.seqId).padStart(4, "0"));
    expect(res.text).not.toContain("Aperta");
  });

  it("minPhotoMedalRank setting lowers or raises the cut-off", async () => {
    const { bronze2 } = await setup();

    expect((await request("PUT", "/admin/settings", admin.token, { minPhotoMedalRank: "2" })).status).toBe(200);
    expect((await page()).text).toContain(bronze2.email);

    expect((await request("PUT", "/admin/settings", admin.token, { minPhotoMedalRank: "5" })).status).toBe(200);
    const none = await page();
    expect(none.text).not.toContain(bronze2.email);
    expect(none.text).toContain("Nessun modello premiato");
  });

  it("rejects an invalid minPhotoMedalRank and absenceRegisterEnabled (422)", async () => {
    expect((await request("PUT", "/admin/settings", admin.token, { minPhotoMedalRank: "11" })).status).toBe(422);
    expect((await request("PUT", "/admin/settings", admin.token, { minPhotoMedalRank: "-1" })).status).toBe(422);
    expect((await request("PUT", "/admin/settings", admin.token, { absenceRegisterEnabled: "maybe" })).status).toBe(422);
    expect((await request("PUT", "/admin/settings", admin.token, { absenceRegisterEnabled: "true" })).status).toBe(200);
  });

  it("excel export: XLSX (zip) of the same list", async () => {
    await setup();
    const res = await request("GET", `/exports/events/${eventId}/photography/excel`, admin.token);
    expect(res.status).toBe(200);
    expect(res.text.startsWith("PK")).toBe(true);
  });

  it("404 for an unknown event, 422 for an invalid one, 403 below manager", async () => {
    const unknown = crypto.randomUUID();
    expect((await request("GET", `/exports/events/${unknown}/photography`, admin.token)).status).toBe(404);
    expect((await request("GET", `/exports/events/nope/photography`, admin.token)).status).toBe(422);
    const user = await createUser("user");
    expect((await request("GET", `/exports/events/${eventId}/photography`, user.token)).status).toBe(403);
  });
});
