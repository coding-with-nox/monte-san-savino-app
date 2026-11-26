// fixtures must be imported first: it loads testApp, which sets the env (PG_DB=tenant_db_test, JWT_SECRET).
import { createCategory, createEvent, createLevel, createMemberRole, createUser, member, request, resetDb } from "./fixtures";
import { getTestDb } from "./testDb";
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "bun:test";
import { eq } from "drizzle-orm";
import { usersTable, userProfilesTable } from "../identity/infra/persistence/schema";
import { eventCampaignsTable, modelsTable, registrationsTable, settingsTable } from "../contest/infra/persistence/schema";

type TestUser = Awaited<ReturnType<typeof createUser>>;

const VISIBILITY = "/admin/settings/section-visibility";

/** Grants/revokes permissions through the API, as the admin UI does. */
async function setPermissions(admin: TestUser, permissions: Record<string, string[]>) {
  const res = await request("PUT", VISIBILITY, admin.token, { visibility: {}, permissions });
  expect(res.status).toBe(200);
  return res;
}

const clearSettings = () => getTestDb().delete(settingsTable);

describe("integration role permissions (enrollOnBehalf)", () => {
  let admin: TestUser;
  let manager: TestUser;
  let user: TestUser;

  const myPermissions = async (who: TestUser) =>
    (await request("GET", "/settings/section-visibility", who.token)).json.permissions;

  beforeAll(async () => {
    await resetDb();
    admin = await createUser("admin");
    manager = await createUser("manager");
    user = await createUser("user");
  });
  beforeEach(async () => { await clearSettings(); });
  afterAll(resetDb);

  it("defaults: admin and manager have it, every other role does not", async () => {
    const res = await request("GET", VISIBILITY, admin.token);
    expect(res.status).toBe(200);
    expect(res.json.availablePermissions).toEqual(["enrollOnBehalf"]);
    expect(res.json.permissions).toEqual({
      user: [], staff: [], judge: [], jury_president: [], manager: ["enrollOnBehalf"], admin: ["enrollOnBehalf"]
    });
    expect(await myPermissions(admin)).toEqual(["enrollOnBehalf"]);
    expect(await myPermissions(manager)).toEqual(["enrollOnBehalf"]);
    expect(await myPermissions(user)).toEqual([]);
  });

  it("PUT merges the given roles only, ignores unknown keys and forces admin", async () => {
    const first = await setPermissions(admin, { staff: ["enrollOnBehalf", "nope"], admin: [], ghost: ["enrollOnBehalf"] });
    expect(first.json.permissions.staff).toEqual(["enrollOnBehalf"]);
    expect(first.json.permissions.manager).toEqual(["enrollOnBehalf"]);
    expect(first.json.permissions.admin).toEqual(["enrollOnBehalf"]);
    expect(first.json.permissions.ghost).toBeUndefined();

    // A second partial PUT keeps what was stored before.
    const second = await setPermissions(admin, { manager: [] });
    expect(second.json.permissions).toMatchObject({ staff: ["enrollOnBehalf"], manager: [], user: [] });

    const stored = await request("GET", VISIBILITY, admin.token);
    expect(stored.json.permissions).toEqual(second.json.permissions);
    expect(await myPermissions(manager)).toEqual([]);
    expect(await myPermissions(admin)).toEqual(["enrollOnBehalf"]);
  });

  it("PUT without permissions leaves them untouched", async () => {
    await setPermissions(admin, { user: ["enrollOnBehalf"] });
    const res = await request("PUT", VISIBILITY, admin.token, { visibility: {} });
    expect(res.status).toBe(200);
    expect(res.json.permissions.user).toEqual(["enrollOnBehalf"]);
    expect(await myPermissions(user)).toEqual(["enrollOnBehalf"]);
  });

  it("only the admin can change permissions", async () => {
    const res = await request("PUT", VISIBILITY, manager.token, { visibility: {}, permissions: { user: ["enrollOnBehalf"] } });
    expect(res.status).toBe(403);
    expect(await myPermissions(user)).toEqual([]);
  });
});

describe("integration GET /admin/users/enrollable", () => {
  let admin: TestUser;
  let manager: TestUser;
  let user: TestUser;
  const target = { id: crypto.randomUUID(), email: "zeta.cliente@example.com", seqId: 424242 };
  const inactiveId = crypto.randomUUID();

  const search = (who: TestUser, q?: string) =>
    request("GET", `/admin/users/enrollable${q === undefined ? "" : `?q=${encodeURIComponent(q)}`}`, who.token);
  const ids = (res: { json: any }) => res.json.map((r: any) => r.id);

  beforeAll(async () => {
    await resetDb();
    admin = await createUser("admin");
    manager = await createUser("manager");
    user = await createUser("user");
    await getTestDb().insert(usersTable).values([
      { id: target.id, email: target.email, role: "user", passwordHash: "unused", isActive: true, seqId: target.seqId },
      { id: inactiveId, email: "zeta.disattivo@example.com", role: "user", passwordHash: "unused", isActive: false }
    ]);
    await getTestDb().insert(userProfilesTable).values({ userId: target.id, firstName: "Ginevra", lastName: "Bianchi" });
  });
  afterAll(resetDb);

  it("401 without a token, 403 PERMISSION_DENIED without the permission", async () => {
    expect((await request("GET", "/admin/users/enrollable")).status).toBe(401);
    const res = await search(user);
    expect(res.status).toBe(403);
    expect(res.json.code).toBe("PERMISSION_DENIED");
  });

  it("follows the permission matrix and does not open the other /admin/users routes", async () => {
    await setPermissions(admin, { user: ["enrollOnBehalf"], manager: [] });
    try {
      expect((await search(user)).status).toBe(200);
      expect((await search(manager)).status).toBe(403);
      expect((await search(admin)).status).toBe(200);
      expect((await request("GET", "/admin/users", user.token)).status).toBe(403);
    } finally {
      await clearSettings();
    }
  });

  it("lists active users only, with the documented fields", async () => {
    const res = await search(manager);
    expect(res.status).toBe(200);
    expect(ids(res)).not.toContain(inactiveId);
    expect(res.json.find((r: any) => r.id === target.id)).toEqual({
      id: target.id, email: target.email, firstName: "Ginevra", lastName: "Bianchi", participantNumber: target.seqId
    });
  });

  it("filters by email, name in both orders and participant number", async () => {
    for (const q of ["zeta.cli", "ginevra bian", "bianchi gine", String(target.seqId)]) {
      expect(ids(await search(manager, q))).toEqual([target.id]);
    }
    expect(ids(await search(manager, "nessuno-cosi"))).toEqual([]);
  });

  it("treats LIKE wildcards literally", async () => {
    expect(ids(await search(manager, "%"))).toEqual([]);
    expect(ids(await search(manager, "zeta_cliente"))).toEqual([]);
  });

  it("does not fail on a number outside the integer range", async () => {
    const res = await search(manager, "99999999999999");
    expect(res.status).toBe(200);
    expect(res.json).toEqual([]);
  });
});

describe("integration enrollment on behalf of another participant", () => {
  let admin: TestUser;
  let manager: TestUser;
  let owner: TestUser;
  let other: TestUser;
  let eventId: string;
  let categoryId: string;
  let levelId: string;
  let roleId: string;

  const createModel = (who: TestUser, extra: Record<string, unknown> = {}) =>
    request("POST", "/models", who.token, { name: "Modello", categoryId, levelId, ...extra });
  const enroll = (who: TestUser, modelId: string) =>
    request("POST", `/events/${eventId}/enroll`, who.token, { modelId });
  const modelRow = async (id: string) =>
    (await getTestDb().select().from(modelsTable).where(eq(modelsTable.id, id)))[0];

  beforeAll(async () => {
    await resetDb();
    admin = await createUser("admin");
    manager = await createUser("manager");
    owner = await createUser("user");
    other = await createUser("user");
    eventId = await createEvent();
    categoryId = await createCategory(eventId);
    levelId = await createLevel();
    roleId = await createMemberRole("Scultore", 1500);
  });
  afterAll(resetDb);

  it("403 PERMISSION_DENIED without the permission, and nothing is created", async () => {
    const res = await createModel(other, { userId: owner.id });
    expect(res.status).toBe(403);
    expect(res.json.code).toBe("PERMISSION_DENIED");
    expect((await request("GET", "/models", owner.token)).json).toEqual([]);
    expect((await request("GET", "/models", other.token)).json).toEqual([]);
  });

  it("accepts userId equal to the caller without any permission", async () => {
    const res = await createModel(other, { userId: other.id });
    expect(res.status).toBe(200);
    expect((await modelRow(res.json.id)).userId).toBe(other.id);
  });

  it("404 for an unknown or disabled owner, 422 for a non uuid", async () => {
    const unknown = await createModel(manager, { userId: crypto.randomUUID() });
    expect(unknown.status).toBe(404);
    expect(unknown.json.code).toBe("USER_NOT_FOUND");

    const disabled = await createUser("user");
    await getTestDb().update(usersTable).set({ isActive: false }).where(eq(usersTable.id, disabled.id));
    expect((await createModel(manager, { userId: disabled.id })).status).toBe(404);

    expect((await createModel(manager, { userId: "non-uuid" })).status).toBe(422);
  });

  it("assigns model, team code and fee to the owner", async () => {
    const created = await createModel(manager, {
      userId: owner.id, isTeam: true, teamMembers: [member(roleId, "Anna", "Verdi")]
    });
    expect(created.status).toBe(200);
    expect(created.json.code).toBe(`${owner.seqId}T1`);
    expect((await modelRow(created.json.id)).userId).toBe(owner.id);

    const ownerModels = await request("GET", "/models", owner.token);
    expect(ownerModels.json.map((m: any) => m.id)).toEqual([created.json.id]);
    expect((await request("GET", "/models", manager.token)).json).toEqual([]);

    const ownerPricing = await request("GET", `/pricing/me?eventId=${eventId}`, owner.token);
    expect(ownerPricing.json.events[0]).toMatchObject({ modelCount: 1, coauthorsTotalCents: 1500 });
    expect((await request("GET", `/pricing/me?eventId=${eventId}`, manager.token)).json.events).toEqual([]);

    // The next team code of the owner keeps counting, whoever creates the model.
    const own = await createModel(owner, { isTeam: true, teamMembers: [member(roleId)] });
    expect(own.json.code).toBe(`${owner.seqId}T2`);
  });

  it("applies the 50 models limit of the owner, not of the caller", async () => {
    const full = await createUser("user");
    await getTestDb().insert(modelsTable).values(Array.from({ length: 50 }, (_, i) => ({
      id: crypto.randomUUID(), userId: full.id, categoryId, levelId, name: `Pieno ${i}`
    })));
    const res = await createModel(manager, { userId: full.id });
    expect(res.status).toBe(409);
    expect(res.json).toMatchObject({ code: "MODEL_LIMIT", limit: 50 });

    // A caller at the limit can still enroll on behalf of someone with room.
    await getTestDb().insert(modelsTable).values(Array.from({ length: 50 }, (_, i) => ({
      id: crypto.randomUUID(), userId: admin.id, categoryId, levelId, name: `Admin ${i}`
    })));
    expect((await createModel(admin, { userId: other.id })).status).toBe(200);
  });

  it("enrolls another user's model in the event: the registration belongs to the owner", async () => {
    const created = await createModel(manager, { userId: owner.id });

    const denied = await enroll(other, created.json.id);
    expect(denied.status).toBe(404);

    const res = await enroll(manager, created.json.id);
    expect(res.status).toBe(200);
    const [row] = await getTestDb().select().from(registrationsTable).where(eq(registrationsTable.id, res.json.id));
    expect(row).toMatchObject({ userId: owner.id, eventId, modelId: created.json.id, categoryId });
    expect((await enroll(manager, created.json.id)).status).toBe(400);
  });

  it("lets a role below manager enroll on behalf once granted, but only inside the window", async () => {
    await setPermissions(admin, { user: ["enrollOnBehalf"] });
    try {
      const created = await createModel(other, { userId: owner.id });
      expect(created.status).toBe(200);
      expect((await modelRow(created.json.id)).userId).toBe(owner.id);
      const enrolled = await enroll(other, created.json.id);
      expect(enrolled.status).toBe(200);
      const [row] = await getTestDb().select().from(registrationsTable).where(eq(registrationsTable.id, enrolled.json.id));
      expect(row.userId).toBe(owner.id);

      // The permission does not unlock the owner-only routes of the model.
      expect((await request("DELETE", `/models/${created.json.id}`, other.token)).status).not.toBe(200);
      expect(await modelRow(created.json.id)).toBeDefined();

      const late = await createModel(manager, { userId: owner.id });
      await getTestDb().insert(eventCampaignsTable).values({
        id: crypto.randomUUID(), eventId, name: "Chiusa", enrollmentCloseDate: "2000-01-01"
      });
      expect((await createModel(other, { userId: owner.id })).status).toBe(403);
      const closed = await enroll(other, late.json.id);
      expect(closed.status).toBe(403);
      expect(closed.json.code).toBe("ENROLLMENT_CLOSED");
      expect((await enroll(manager, late.json.id)).status).toBe(200);
    } finally {
      await clearSettings();
      await getTestDb().delete(eventCampaignsTable);
    }
  });
});
