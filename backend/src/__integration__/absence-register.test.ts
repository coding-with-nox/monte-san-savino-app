import { describe, it, expect, beforeEach, afterAll } from "bun:test";
import { createCategory, createEvent, createLevel, createUser, request, resetDb } from "./fixtures";
import { getTestDb } from "./testDb";
import { judgeAssignmentsTable, modelsTable, registrationsTable, settingsTable } from "../contest/infra/persistence/schema";

describe("integration absence register", () => {
  let eventId: string;
  let categoryId: string;
  let levelId: string;
  let judge: Awaited<ReturnType<typeof createUser>>;
  let staff: Awaited<ReturnType<typeof createUser>>;
  let present: Awaited<ReturnType<typeof createUser>>;
  let absent: Awaited<ReturnType<typeof createUser>>;
  let modelPresent: string;
  let modelAbsent: string;
  let code: number;

  beforeEach(async () => {
    await resetDb();
    code = 0;
    eventId = await createEvent("Assenze");
    categoryId = await createCategory(eventId, "Classe assenze");
    levelId = await createLevel();
    judge = await createUser("judge");
    staff = await createUser("staff");
    present = await createUser();
    absent = await createUser();
    // Event-wide judge: sees every class of the event.
    await getTestDb().insert(judgeAssignmentsTable).values({ id: crypto.randomUUID(), eventId, judgeId: judge.id, categoryId: null });
    modelPresent = await model(present.id, 1);
    modelAbsent = await model(absent.id, 2);
    await enroll(present.id, modelPresent, true);
    await enroll(absent.id, modelAbsent, false);
  });
  afterAll(resetDb);

  async function model(userId: string, displayNumber: number) {
    const id = crypto.randomUUID();
    code += 1;
    await getTestDb().insert(modelsTable).values({ id, userId, categoryId, levelId, name: `Modello ${code}`, code, displayNumber });
    return id;
  }

  async function enroll(userId: string, modelId: string, checkedIn: boolean) {
    await getTestDb().insert(registrationsTable).values({
      id: crypto.randomUUID(), userId, eventId, modelId, categoryId, status: "registered", checkedIn, absent: !checkedIn
    });
  }

  async function setRegister(value: "true" | "false") {
    await getTestDb().insert(settingsTable).values({ key: "absenceRegisterEnabled", value, updatedAt: new Date() });
  }

  const judgeModelIds = async () => {
    const res = await request("GET", `/judge/models?eventId=${eventId}`, judge.token);
    expect(res.status).toBe(200);
    return res.json.map((m: any) => m.id).sort();
  };
  const judgeDisplayNumbers = async () => {
    const res = await request("GET", `/judge/displays?eventId=${eventId}`, judge.token);
    expect(res.status).toBe(200);
    return res.json.map((d: any) => d.displayNumber);
  };
  const vote = (modelId: string) => request("POST", "/judge/vote", judge.token, { modelId, rank: 3 });
  const complete = () => request("POST", `/judge/categories/${categoryId}/complete`, judge.token);

  it("register off (default): judges see and need the models of absent owners too", async () => {
    expect(await judgeModelIds()).toEqual([modelPresent, modelAbsent].sort());
    expect(await judgeDisplayNumbers()).toEqual([1, 2]);

    const early = await complete();
    expect(early.status).toBe(409);
    expect(early.json).toMatchObject({ code: "INCOMPLETE_VOTES" });
  });

  it("register on: judges see and vote only the models of present owners", async () => {
    await setRegister("true");

    expect(await judgeModelIds()).toEqual([modelPresent]);
    expect(await judgeDisplayNumbers()).toEqual([1]);
    expect((await vote(modelAbsent)).status).toBe(403);
    expect((await vote(modelPresent)).status).toBe(200);
    expect((await request("GET", `/judge/models/${modelAbsent}`, judge.token)).status).toBe(403);
  });

  it("register on: completion ignores the models of absent owners (as missing models)", async () => {
    await setRegister("true");
    expect((await vote(modelPresent)).status).toBe(200);

    const res = await complete();
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ completed: true, allDone: true, phase: "closed" });
  });

  it("a desk check-in brings the owner back into the judging while the register is on", async () => {
    await setRegister("true");
    expect(await judgeModelIds()).toEqual([modelPresent]);

    const checkin = await request("POST", `/staff/events/${eventId}/participants/${absent.seqId}/presence`, staff.token, { present: true });
    expect(checkin.status).toBe(200);
    expect(await judgeModelIds()).toEqual([modelPresent, modelAbsent].sort());
    expect((await vote(modelAbsent)).status).toBe(200);
  });

  it("register explicitly off behaves like the default", async () => {
    await setRegister("false");
    expect(await judgeModelIds()).toEqual([modelPresent, modelAbsent].sort());
  });
});
