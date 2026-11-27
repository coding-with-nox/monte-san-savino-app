import { describe, it, expect, beforeEach, afterAll } from "bun:test";
import { createCategory, createEvent, createLevel, createUser, request, resetDb } from "./fixtures";
import { getTestDb } from "./testDb";
import { judgeAssignmentsTable, modelsTable, registrationsTable } from "../contest/infra/persistence/schema";

// SEC-02: the desk shows participant identities, so judges must not inherit the staff guard.
// SEC-03: judging is anonymous, so no judge API returns the owner of a model.
describe("integration security: desk roles and anonymous judging", () => {
  let eventId: string;
  let categoryId: string;
  let levelId: string;
  let ownerId: string;
  let modelId: string;
  let registrationId: string;

  beforeEach(async () => {
    await resetDb();
    ownerId = (await createUser()).id;
    eventId = await createEvent();
    categoryId = await createCategory(eventId, "Classe");
    levelId = await createLevel();
    modelId = crypto.randomUUID();
    await getTestDb().insert(modelsTable).values({ id: modelId, userId: ownerId, categoryId, levelId, name: "Tiger", code: 1, displayNumber: 1 });
    registrationId = crypto.randomUUID();
    await getTestDb().insert(registrationsTable).values({
      id: registrationId, userId: ownerId, eventId, modelId, categoryId, status: "registered", checkedIn: false, absent: true
    });
  });
  afterAll(resetDb);

  const deskCalls = (): [string, string, unknown?][] => [
    ["GET", `/staff/events/${eventId}/participants/1`],
    ["POST", `/staff/events/${eventId}/participants/1/presence`, { present: true }],
    ["GET", `/staff/events/${eventId}/attendance`],
    ["POST", `/staff/checkin/${registrationId}`]
  ];

  it("judges and the jury president get 403 on every desk route", async () => {
    for (const role of ["judge", "jury_president", "user"] as const) {
      const other = await createUser(role);
      for (const [method, path, body] of deskCalls()) {
        const res = await request(method, path, other.token, body);
        expect({ role, method, path, status: res.status }).toEqual({ role, method, path, status: 403 });
      }
    }
    const [row] = await getTestDb().select().from(registrationsTable);
    expect(row.checkedIn).toBe(false);
  });

  it("staff, manager and admin still reach the desk", async () => {
    for (const role of ["staff", "manager", "admin"] as const) {
      const desk = await createUser(role);
      const res = await request("GET", `/staff/events/${eventId}/attendance`, desk.token);
      expect({ role, status: res.status }).toEqual({ role, status: 200 });
    }
  });

  it("judge APIs never return the owner of a model", async () => {
    const judge = await createUser("judge");
    await getTestDb().insert(judgeAssignmentsTable).values({ id: crypto.randomUUID(), eventId, judgeId: judge.id, categoryId: null });

    const list = await request("GET", `/judge/models?eventId=${eventId}`, judge.token);
    expect(list.status).toBe(200);
    expect(list.json.length).toBe(1);
    expect(list.json[0]).not.toHaveProperty("userId");

    const detail = await request("GET", `/judge/models/${modelId}`, judge.token);
    expect(detail.status).toBe(200);
    expect(detail.json.model).not.toHaveProperty("userId");

    const displays = await request("GET", `/judge/displays?eventId=${eventId}`, judge.token);
    expect(displays.status).toBe(200);
    expect(JSON.stringify(displays.json)).not.toContain(ownerId);

    // The old participant lookup (name and surname of the exhibitor) no longer exists.
    const participant = await request("GET", `/judge/participants/${ownerId}`, judge.token);
    expect(participant.status).toBe(404);
  });
});
