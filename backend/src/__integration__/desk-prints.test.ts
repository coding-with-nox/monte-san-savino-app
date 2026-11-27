import { describe, it, expect, beforeEach, afterAll } from "bun:test";
import { createCategory, createEvent, createLevel, createUser, request, resetDb } from "./fixtures";
import { getTestDb } from "./testDb";
import { modelsTable, registrationsTable } from "../contest/infra/persistence/schema";

describe("integration desk batch prints", () => {
  let manager: Awaited<ReturnType<typeof createUser>>;
  let staff: Awaited<ReturnType<typeof createUser>>;
  let eventId: string;
  let categoryId: string;
  let levelId: string;
  let code: number;
  let p1: Awaited<ReturnType<typeof createUser>>;
  let p2: Awaited<ReturnType<typeof createUser>>;
  let p3: Awaited<ReturnType<typeof createUser>>;

  beforeEach(async () => {
    await resetDb();
    code = 0;
    manager = await createUser("manager");
    staff = await createUser("staff");
    eventId = await createEvent("Stampe desk");
    categoryId = await createCategory(eventId, "Classe stampe");
    levelId = await createLevel();
    // Created in order: participant numbers (seq_id) are increasing.
    p1 = await participant("Primo");
    p2 = await participant("Secondo");
    p3 = await participant("Terzo");
  });
  afterAll(resetDb);

  async function participant(name: string) {
    const user = await createUser();
    code += 1;
    const modelId = crypto.randomUUID();
    await getTestDb().insert(modelsTable).values({
      id: modelId, userId: user.id, categoryId, levelId, name: `${name} ${code}`, code, displayNumber: code
    });
    await getTestDb().insert(registrationsTable).values({
      id: crypto.randomUUID(), userId: user.id, eventId, modelId, categoryId, status: "registered", checkedIn: false, absent: false
    });
    return user;
  }

  const q = (extra: Record<string, string | number> = {}) => {
    const params = new URLSearchParams(Object.entries(extra).map(([k, v]) => [k, String(v)]));
    const s = params.toString();
    return s ? `?${s}` : "";
  };
  const base = (path: string) => `/exports/events/${eventId}/desk/${path}`;

  it("stats count participants, models, labels and pages without bounds", async () => {
    const res = await request("GET", base("stats"), manager.token);
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ participants: 3, models: 3, labels: 3, listPages: 3, envelopes: 3 });
  });

  it("from/to are inclusive participant numbers; a missing bound is open", async () => {
    const range = await request("GET", base("stats") + q({ from: p2.seqId, to: p3.seqId }), manager.token);
    expect(range.json).toEqual({ participants: 2, models: 2, labels: 2, listPages: 2, envelopes: 2 });

    const openEnd = await request("GET", base("stats") + q({ from: p3.seqId }), manager.token);
    expect(openEnd.json.participants).toBe(1);

    const openStart = await request("GET", base("stats") + q({ to: p1.seqId }), manager.token);
    expect(openStart.json.participants).toBe(1);
  });

  it("labels JSON (DYMO) returns the rows of the range, in participant order", async () => {
    const res = await request("GET", base("labels/data") + q({ from: p2.seqId, to: p3.seqId }), manager.token);
    expect(res.status).toBe(200);
    expect(res.json).toHaveLength(2);
    expect(res.json.map((r: any) => r.nomeModello)).toEqual(["Secondo 2", "Terzo 3"]);
    expect(res.json[0]).toMatchObject({ utente: p2.email, qrPayload: expect.stringMatching(/^model:/) });
    expect(res.json[0].codice).toMatch(/^M\d+-\d{4}-2$/);
    expect(res.json[0].qr.startsWith("data:image/png")).toBe(true);
  });

  it("labels HTML: one label per model of the range", async () => {
    const res = await request("GET", base("labels") + q({ from: p2.seqId, to: p3.seqId }), manager.token);
    expect(res.status).toBe(200);
    expect(res.text).toContain("Secondo 2");
    expect(res.text).toContain("Terzo 3");
    expect(res.text).not.toContain("Primo 1");
    expect(res.text.split('class="qr"').length - 1).toBe(2);
  });

  it("lists HTML: one page per participant with the participant number and their models", async () => {
    const res = await request("GET", base("lists") + q({ from: p1.seqId, to: p2.seqId }), manager.token);
    expect(res.status).toBe(200);
    expect(res.text).toContain("Controlla le tue iscrizioni");
    expect(res.text.split('class="desk-page"').length - 1).toBe(2);
    expect(res.text).toContain(String(p1.seqId).padStart(4, "0"));
    expect(res.text).toContain("Primo 1");
    expect(res.text).not.toContain("Terzo 3");
  });

  it("envelopes HTML: 220 x 110 mm, one envelope per participant of the range", async () => {
    const res = await request("GET", base("envelopes") + q({ from: p2.seqId }), manager.token);
    expect(res.status).toBe(200);
    expect(res.text).toContain("220mm 110mm");
    expect(res.text.split('<section class="envelope">').length - 1).toBe(2);
    expect(res.text).toContain(p3.email);
    expect(res.text).not.toContain(p1.email);
  });

  it("422 for from > to, non-integer bounds, or an invalid event id", async () => {
    expect((await request("GET", base("stats") + q({ from: p3.seqId, to: p1.seqId }), manager.token)).status).toBe(422);
    expect((await request("GET", base("labels") + q({ from: "abc" }), manager.token)).status).toBe(422);
    expect((await request("GET", base("lists") + q({ to: -1 }), manager.token)).status).toBe(422);
    expect((await request("GET", `/exports/events/not-a-uuid/desk/envelopes`, manager.token)).status).toBe(422);
  });

  it("manager and above only", async () => {
    expect((await request("GET", base("stats"), staff.token)).status).toBe(403);
    expect((await request("GET", base("labels/data"), staff.token)).status).toBe(403);
  });
});
