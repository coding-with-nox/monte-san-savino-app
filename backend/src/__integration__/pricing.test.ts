import { describe, it, expect, beforeEach, afterAll } from "bun:test";
import { createCategory, createEvent, createLevel, createMemberRole, createUser, member, request, resetDb } from "./fixtures";
import { getTestDb } from "./testDb";
import { modelsTable } from "../contest/infra/persistence/schema";

describe("integration enrollment pricing", () => {
  let user: Awaited<ReturnType<typeof createUser>>;
  let eventId: string;
  let categoryId: string;
  let paidLevel: string;
  let freeLevel: string;

  const createModel = (extra: Record<string, unknown> = {}) =>
    request("POST", "/models", user.token, { name: "Modello", categoryId, levelId: paidLevel, ...extra });

  beforeEach(async () => {
    await resetDb();
    user = await createUser();
    eventId = await createEvent("Evento prezzi");
    categoryId = await createCategory(eventId);
    paidLevel = await createLevel("Master");
    freeLevel = await createLevel("Juniores", true);
  });
  afterAll(resetDb);

  it("no models: zero total and no events", async () => {
    const res = await request("GET", "/pricing/me", user.token);
    expect(res.json).toEqual({ currency: "EUR", totalCents: 0, events: [] });
  });

  it("charges a single 25 EUR base fee however many models", async () => {
    await createModel();
    await createModel();
    await createModel();
    const res = await request("GET", `/pricing/me?eventId=${eventId}`, user.token);
    expect(res.json.totalCents).toBe(2500);
    expect(res.json.events[0]).toMatchObject({ eventId, baseFeeCents: 2500, modelCount: 3, paidModelCount: 3 });
  });

  it("adds each coauthor at the price of the role", async () => {
    const painter = await createMemberRole("Pittore", 1500);
    const director = await createMemberRole("Art Director", 2000);
    await createModel({ isTeam: true, teamMembers: [member(painter), member(director, "Luca", "Bianchi")] });
    const res = await request("GET", "/pricing/me", user.token);
    const event = res.json.events[0];
    expect(event.coauthorsTotalCents).toBe(3500);
    expect(event.totalCents).toBe(6000);
    expect(event.coauthorLines.map((l: any) => l.priceCents).sort()).toEqual([1500, 2000]);
  });

  it("free level: only free models cost nothing, coauthors included", async () => {
    const painter = await createMemberRole();
    await createModel({ levelId: freeLevel, isTeam: true, teamMembers: [member(painter)] });
    const res = await request("GET", "/pricing/me", user.token);
    expect(res.json.totalCents).toBe(0);
    expect(res.json.events[0]).toMatchObject({ baseFeeCents: 0, modelCount: 1, paidModelCount: 0, coauthorLines: [] });
    expect(res.json.events[0].freeModels).toHaveLength(1);
  });

  it("free and paid models together: base fee once", async () => {
    await createModel({ levelId: freeLevel });
    await createModel();
    const res = await request("GET", "/pricing/me", user.token);
    expect(res.json.totalCents).toBe(2500);
    expect(res.json.events[0]).toMatchObject({ modelCount: 2, paidModelCount: 1 });
  });

  it("keeps events separate and sums the grand total", async () => {
    await createModel();
    const secondEvent = await createEvent("Secondo");
    await createModel({ categoryId: await createCategory(secondEvent) });
    const all = await request("GET", "/pricing/me", user.token);
    expect(all.json.events).toHaveLength(2);
    expect(all.json.totalCents).toBe(5000);
    const one = await request("GET", `/pricing/me?eventId=${eventId}`, user.token);
    expect(one.json.totalCents).toBe(2500);
  });

  it("uses the baseFeeCents setting changed by an admin", async () => {
    const admin = await createUser("admin");
    expect((await request("PUT", "/admin/settings", admin.token, { baseFeeCents: "3000" })).status).toBe(200);
    expect((await request("PUT", "/admin/settings", admin.token, { baseFeeCents: "-1" })).status).toBe(422);
    await createModel();
    const res = await request("GET", "/pricing/me", user.token);
    expect(res.json.totalCents).toBe(3000);
  });

  it("GET /admin/pricing lists participants for managers only", async () => {
    const painter = await createMemberRole();
    await createModel({ isTeam: true, teamMembers: [member(painter)] });
    const manager = await createUser("manager");

    const res = await request("GET", `/admin/pricing?eventId=${eventId}`, manager.token);
    expect(res.status).toBe(200);
    expect(res.json.totalCents).toBe(4000);
    expect(res.json.entries).toHaveLength(1);
    expect(res.json.entries[0]).toMatchObject({
      userId: user.id, participantNumber: user.seqId, email: user.email, totalCents: 4000
    });

    const filtered = await request("GET", `/admin/pricing?userId=${manager.id}`, manager.token);
    expect(filtered.json.entries).toEqual([]);
    expect((await request("GET", "/admin/pricing", user.token)).status).toBe(403);
    expect((await request("GET", "/admin/pricing")).status).toBe(401);
  });

  it("allows 50 models per event and rejects the 51st", async () => {
    // 49 rows inserted directly, the 50th and 51st go through the API.
    await getTestDb().insert(modelsTable).values(
      Array.from({ length: 49 }, (_, i) => ({
        id: crypto.randomUUID(), userId: user.id, categoryId, levelId: paidLevel,
        name: `M${i}`, code: i + 1, displayNumber: 1
      }))
    );
    expect((await createModel()).status).toBe(200);

    const over = await createModel();
    expect(over.status).toBe(409);
    expect(over.json).toMatchObject({ code: "MODEL_LIMIT", limit: 50 });

    // The limit is per event.
    const otherCategory = await createCategory(await createEvent("Altro"));
    expect((await createModel({ categoryId: otherCategory })).status).toBe(200);

    const pricing = await request("GET", `/pricing/me?eventId=${eventId}`, user.token);
    expect(pricing.json.events[0]).toMatchObject({ modelCount: 50, totalCents: 2500 });
  });

  it("the printed model card contains the enrollment total", async () => {
    const painter = await createMemberRole();
    await createModel({ name: "Drago", isTeam: true, teamMembers: [member(painter)] });
    const res = await request("GET", `/exports/model-card/pdf?eventId=${eventId}`, user.token);
    expect(res.status).toBe(200);
    expect(res.text).toContain("Registration fee");
    expect(res.text).toMatch(/<th>Total<\/th><th class="amount">€ 40,00<\/th>/);
    expect(res.text).toContain(`${user.seqId}T1`);
  });
});
