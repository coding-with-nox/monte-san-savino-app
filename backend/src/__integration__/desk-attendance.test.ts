import { describe, it, expect, beforeEach, afterAll } from "bun:test";
import { createCategory, createEvent, createLevel, createUser, request, resetDb } from "./fixtures";
import { getTestDb } from "./testDb";
import { modelsTable, registrationsTable } from "../contest/infra/persistence/schema";
import { eq } from "drizzle-orm";

describe("integration desk attendance (staff)", () => {
  let staff: Awaited<ReturnType<typeof createUser>>;
  let eventId: string;
  let otherEventId: string;
  let categoryId: string;
  let levelId: string;
  let code: number;

  beforeEach(async () => {
    await resetDb();
    staff = await createUser("staff");
    eventId = await createEvent("Desk");
    otherEventId = await createEvent("Altro evento");
    categoryId = await createCategory(eventId, "Classe desk");
    levelId = await createLevel();
    code = 0;
  });
  afterAll(resetDb);

  async function model(userId: string, displayNumber: number) {
    const id = crypto.randomUUID();
    code += 1;
    await getTestDb().insert(modelsTable).values({ id, userId, categoryId, levelId, name: `Modello ${code}`, code, displayNumber });
    return id;
  }

  async function register(userId: string, modelId: string | null, evt = eventId, checkedIn = false) {
    const id = crypto.randomUUID();
    await getTestDb().insert(registrationsTable).values({
      id, userId, eventId: evt, modelId, categoryId, status: "registered", checkedIn, absent: !checkedIn
    });
    return id;
  }

  const registrationsOf = async (userId: string) =>
    getTestDb().select().from(registrationsTable).where(eq(registrationsTable.userId, userId as any));

  const lookup = (number: string | number, evt = eventId, token = staff.token) =>
    request("GET", `/staff/events/${evt}/participants/${number}`, token);
  const setPresence = (number: string | number, present: unknown) =>
    request("POST", `/staff/events/${eventId}/participants/${number}/presence`, staff.token, { present });
  const attendance = (evt = eventId) => request("GET", `/staff/events/${evt}/attendance`, staff.token);

  it("looks a participant up by number with the models enrolled in the event", async () => {
    const p = await createUser();
    const m = await model(p.id, 3);
    await register(p.id, m);

    const res = await lookup(p.seqId);
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ userId: p.id, participantNumber: p.seqId, name: p.email, present: false });
    expect(res.json.models).toEqual([{
      id: m, name: `Modello ${code}`, code: expect.stringMatching(/^M\d+-0003-\d+$/), categoryName: "Classe desk", displayNumber: 3
    }]);
  });

  it("404 when the user has no registration in that event, or the number is unknown", async () => {
    const p = await createUser();
    await register(p.id, await model(p.id, 1), otherEventId);

    expect((await lookup(p.seqId)).status).toBe(404);
    expect((await lookup(999999999)).status).toBe(404);
  });

  it("422 for a non-numeric number or an invalid event id; 403 below staff", async () => {
    expect((await lookup("abc")).status).toBe(422);
    expect((await lookup(1, "not-a-uuid")).status).toBe(422);
    const user = await createUser("user");
    expect((await lookup(1, eventId, user.token)).status).toBe(403);
  });

  it("presence sets check-in and absent on every registration of the participant in the event", async () => {
    const p = await createUser();
    const r1 = await register(p.id, await model(p.id, 1));
    const r2 = await register(p.id, await model(p.id, 2));
    const other = await register(p.id, null, otherEventId);

    const on = await setPresence(p.seqId, true);
    expect(on.status).toBe(200);
    expect(on.json).toMatchObject({ userId: p.id, participantNumber: p.seqId, present: true, updated: 2 });
    const afterOn = await registrationsOf(p.id);
    const inEvent = afterOn.filter((r) => r.eventId === eventId);
    expect(inEvent.map((r) => r.id).sort()).toEqual([r1, r2].sort());
    expect(inEvent.every((r) => r.checkedIn && !r.absent)).toBe(true);
    expect(afterOn.find((r) => r.id === other)).toMatchObject({ checkedIn: false });
    expect((await lookup(p.seqId)).json.present).toBe(true);

    const off = await setPresence(p.seqId, false);
    expect(off.json).toMatchObject({ present: false, updated: 2 });
    const afterOff = (await registrationsOf(p.id)).filter((r) => r.eventId === eventId);
    expect(afterOff.every((r) => !r.checkedIn && r.absent)).toBe(true);
    expect((await lookup(p.seqId)).json.present).toBe(false);
  });

  it("presence: 422 for a non-boolean body, 404 for unknown participant or not registered in the event", async () => {
    const p = await createUser();
    await register(p.id, await model(p.id, 1), otherEventId);

    expect((await setPresence(p.seqId, "yes")).status).toBe(422);
    expect((await setPresence(p.seqId, true)).status).toBe(404);
    expect((await setPresence(999999999, true)).status).toBe(404);
  });

  it("attendance counts distinct registered and present participants of the event", async () => {
    const p1 = await createUser();
    const p2 = await createUser();
    await register(p1.id, await model(p1.id, 1));
    await register(p1.id, await model(p1.id, 2));
    await register(p2.id, await model(p2.id, 3));
    await register(p1.id, null, otherEventId, true);

    expect((await attendance()).json).toEqual({ registeredParticipants: 2, presentParticipants: 0 });
    await setPresence(p1.seqId, true);
    expect((await attendance()).json).toEqual({ registeredParticipants: 2, presentParticipants: 1 });
    expect((await attendance(otherEventId)).json).toEqual({ registeredParticipants: 1, presentParticipants: 1 });
  });

  it("keeps the single-enrollment check-in endpoint working", async () => {
    const p = await createUser();
    const enrollmentId = await register(p.id, await model(p.id, 1));

    const res = await request("POST", `/staff/checkin/${enrollmentId}`, staff.token);
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ checkedIn: true });
    expect((await attendance()).json.presentParticipants).toBe(1);
  });
});
