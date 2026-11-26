import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { createCategory, createEvent, createLevel, createMemberRole, createUser, member, request, resetDb } from "./fixtures";

describe("integration team models (inline coauthors)", () => {
  let user: Awaited<ReturnType<typeof createUser>>;
  let categoryId: string;
  let levelId: string;
  let roleId: string;

  const createModel = (token: string, extra: Record<string, unknown> = {}) =>
    request("POST", "/models", token, { name: "Modello", categoryId, levelId, ...extra });

  beforeAll(async () => {
    await resetDb();
    user = await createUser();
    categoryId = await createCategory(await createEvent());
    levelId = await createLevel();
    roleId = await createMemberRole("Scultore");
  });
  afterAll(resetDb);

  it("assigns <participant number>T<n> codes, progressive per participant", async () => {
    const first = await createModel(user.token, { isTeam: true, teamMembers: [member(roleId)] });
    const individual = await createModel(user.token);
    const second = await createModel(user.token, { isTeam: true, teamMembers: [member(roleId)] });

    expect(first.status).toBe(200);
    expect(first.json.code).toBe(`${user.seqId}T1`);
    expect(individual.json.code).not.toContain("T");
    expect(second.json.code).toBe(`${user.seqId}T2`);

    const list = await request("GET", "/models", user.token);
    const team = list.json.find((m: any) => m.id === first.json.id);
    expect(team.teamCode).toBe(`${user.seqId}T1`);
    expect(team.code).toBe(`${user.seqId}T1`);
  });

  it("restarts the progressive for another participant", async () => {
    const other = await createUser();
    const res = await createModel(other.token, { isTeam: true, teamMembers: [member(roleId)] });
    expect(res.json.code).toBe(`${other.seqId}T1`);
  });

  it("stores coauthors with the role name resolved from roleId", async () => {
    const created = await createModel(user.token, {
      isTeam: true, teamMembers: [{ ...member(roleId, "Anna", "Verdi"), email: "anna@example.com" }]
    });
    const detail = await request("GET", `/models/${created.json.id}`, user.token);
    expect(detail.json.teamMembers).toHaveLength(1);
    expect(detail.json.teamMembers[0]).toMatchObject({
      name: "Anna", surname: "Verdi", role: "Scultore", roleId, email: "anna@example.com"
    });
  });

  it("422 when a team model has no coauthors or an unknown role", async () => {
    const empty = await createModel(user.token, { isTeam: true });
    expect(empty.status).toBe(422);
    expect(empty.json.code).toBe("TEAM_MEMBERS_REQUIRED");

    const badRole = await createModel(user.token, { isTeam: true, teamMembers: [member(crypto.randomUUID())] });
    expect(badRole.status).toBe(422);
    expect(badRole.json.code).toBe("INVALID_MEMBER_ROLE");
  });

  it("PUT turns a model into a team one (new code) and back (code and coauthors removed)", async () => {
    const owner = await createUser();
    const created = await createModel(owner.token);
    const id = created.json.id;

    await request("PUT", `/models/${id}`, owner.token, { isTeam: true, teamMembers: [member(roleId)] });
    let detail = await request("GET", `/models/${id}`, owner.token);
    expect(detail.json.model.teamCode).toBe(`${owner.seqId}T1`);
    expect(detail.json.teamMembers).toHaveLength(1);

    await request("PUT", `/models/${id}`, owner.token, { isTeam: false });
    detail = await request("GET", `/models/${id}`, owner.token);
    expect(detail.json.model.teamCode).toBeNull();
    expect(detail.json.teamMembers).toEqual([]);
  });
});
