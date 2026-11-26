import { describe, it, expect, beforeEach, afterAll } from "bun:test";
import { createCategory, createEvent, createUser, request, resetDb } from "./fixtures";

const DEFAULT_PRIZE_ORDER = ["Highly Commended", "Bronze", "Silver", "Gold"];

describe("integration jury_president, section visibility, prize order", () => {
  let president: Awaited<ReturnType<typeof createUser>>;
  let admin: Awaited<ReturnType<typeof createUser>>;
  let eventId: string;

  const monitoringEndpoints = () => [
    `/awards/monitoring/${eventId}`, "/admin/enrollments", "/admin/stats/overview"
  ];

  const setPresidentSections = (sections: string[]) =>
    request("PUT", "/admin/settings/section-visibility", admin.token, { visibility: { jury_president: sections } });

  beforeEach(async () => {
    await resetDb();
    president = await createUser("jury_president");
    admin = await createUser("admin");
    eventId = await createEvent();
    await createCategory(eventId);
  });
  afterAll(resetDb);

  describe("jury_president", () => {
    it("reads monitoring, enrollments and stats", async () => {
      for (const path of monitoringEndpoints()) {
        const res = await request("GET", path, president.token);
        expect({ path, status: res.status }).toEqual({ path, status: 200 });
      }
    });

    it("keeps judges and users out of the monitoring endpoints", async () => {
      for (const role of ["judge", "user"] as const) {
        const other = await createUser(role);
        for (const path of monitoringEndpoints()) {
          const res = await request("GET", path, other.token);
          expect({ role, path, status: res.status }).toEqual({ role, path, status: 403 });
        }
      }
    });

    it("is denied on manager and admin routes", async () => {
      const denied: [string, string, unknown?][] = [
        ["GET", "/admin/pricing"],
        ["GET", "/admin/users"],
        ["GET", "/admin/levels"],
        ["GET", "/admin/member-roles"],
        ["GET", "/events"],
        ["PATCH", `/admin/enrollments/${crypto.randomUUID()}/absent`, { absent: true }],
        ["GET", "/admin/settings/section-visibility"],
        ["PUT", "/admin/settings", { baseFeeCents: "1" }],
        ["PUT", "/admin/settings/prize-order", { order: ["Gold"] }],
        ["PUT", "/admin/settings/section-visibility", { visibility: { user: [] } }]
      ];
      for (const [method, path, body] of denied) {
        const res = await request(method, path, president.token, body);
        expect({ method, path, status: res.status }).toEqual({ method, path, status: 403 });
      }
      expect((await request("GET", "/public/events?status=all", president.token)).status).toBe(200);
    });

    it("gets 403 SECTION_HIDDEN when the admin hides the section", async () => {
      expect((await setPresidentSections(["judge"])).status).toBe(200);
      for (const path of monitoringEndpoints()) {
        const res = await request("GET", path, president.token);
        expect({ path, status: res.status, code: res.json?.code }).toEqual({ path, status: 403, code: "SECTION_HIDDEN" });
      }
      // Only jury_president is filtered server side.
      for (const path of monitoringEndpoints()) {
        expect((await request("GET", path, admin.token)).status).toBe(200);
      }

      await setPresidentSections(["stats"]);
      expect((await request("GET", "/admin/stats/overview", president.token)).status).toBe(200);
      expect((await request("GET", "/admin/enrollments", president.token)).status).toBe(403);
    });
  });

  describe("section visibility", () => {
    it("returns the default sections of the caller's role", async () => {
      const res = await request("GET", "/settings/section-visibility", president.token);
      expect(res.json.role).toBe("jury_president");
      expect(res.json.sections).toEqual(expect.arrayContaining(["dashboard", "stats", "judge"]));
      expect(res.json.sections).not.toContain("admin");
      expect((await request("GET", "/settings/section-visibility")).status).toBe(401);
    });

    it("admin reads the matrix and updates one role only", async () => {
      const before = await request("GET", "/admin/settings/section-visibility", admin.token);
      expect(before.json.roles).toContain("jury_president");
      expect(before.json.sections).toContain("stats");

      const put = await request("PUT", "/admin/settings/section-visibility", admin.token, {
        visibility: { user: ["models"], admin: [] }
      });
      expect(put.status).toBe(200);
      expect(put.json.visibility.user).toEqual(["models"]);
      expect([...put.json.visibility.staff].sort()).toEqual([...before.json.visibility.staff].sort());
      // admin always sees everything
      expect(put.json.visibility.admin).toEqual(before.json.sections);

      const user = await createUser();
      expect((await request("GET", "/settings/section-visibility", user.token)).json.sections).toEqual(["models"]);
    });

    it("422 on unknown role or section, 403 for non-admins", async () => {
      const put = (token: string, visibility: Record<string, string[]>) =>
        request("PUT", "/admin/settings/section-visibility", token, { visibility });
      expect((await put(admin.token, { ghost: ["models"] })).status).toBe(422);
      expect((await put(admin.token, { user: ["ghost"] })).status).toBe(422);
      const manager = await createUser("manager");
      expect((await put(manager.token, { user: [] })).status).toBe(403);
    });
  });

  describe("prize order", () => {
    it("returns the default order and persists the admin one", async () => {
      const user = await createUser();
      const get = () => request("GET", "/settings/prize-order", user.token);
      expect((await get()).json).toEqual({ order: DEFAULT_PRIZE_ORDER });

      const order = ["Gold", "Silver", "Bronze", "Highly Commended"];
      const put = await request("PUT", "/admin/settings/prize-order", admin.token, { order });
      expect(put.json).toEqual({ updated: true, order });
      expect((await get()).json).toEqual({ order });
    });

    it("validates the payload and requires admin", async () => {
      const put = (token: string, order: unknown) => request("PUT", "/admin/settings/prize-order", token, { order });
      expect((await put(admin.token, [])).status).toBe(422);
      expect((await put(admin.token, ["  "])).status).toBe(422);
      expect((await put(admin.token, "Gold")).status).toBe(422);
      const manager = await createUser("manager");
      expect((await put(manager.token, ["Gold"])).status).toBe(403);
      expect((await request("GET", "/settings/prize-order", admin.token)).json).toEqual({ order: DEFAULT_PRIZE_ORDER });
    });
  });
});
