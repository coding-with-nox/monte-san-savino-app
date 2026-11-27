// fixtures must be imported first: it loads testApp, which sets the env (PG_DB=tenant_db_test, JWT_SECRET).
import { createCategory, createEvent, createLevel, createUser, request, resetDb } from "./fixtures";
import { buildTestApp, postJson } from "./testApp";
import { getTestDb } from "./testDb";
import { describe, it, expect, beforeEach } from "bun:test";
import { usersTable } from "../identity/infra/persistence/schema";
import { settingsTable } from "../contest/infra/persistence/schema";

type TestUser = Awaited<ReturnType<typeof createUser>>;

const app = buildTestApp();
const REGISTER_BODY = (email: string) => ({ email, password: "password123", privacyAccepted: true, privacyVersion: "2026-11-27" });

const setSetting = (key: string, value: string) =>
  getTestDb().insert(settingsTable).values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value, updatedAt: new Date() } });

describe("integration registration status (registrationStatus)", () => {
  let admin: TestUser;
  let manager: TestUser;
  let user: TestUser;
  let eventId: string;
  let categoryId: string;
  let levelId: string;

  beforeEach(async () => {
    await resetDb();
    admin = await createUser("admin");
    manager = await createUser("manager");
    user = await createUser("user");
    eventId = await createEvent("Registration test");
    categoryId = await createCategory(eventId, "Categoria");
    levelId = await createLevel("Open");
  });

  describe("closed", () => {
    beforeEach(async () => {
      await setSetting("registrationStatus", "closed");
    });

    it("POST /auth/register answers 403 REGISTRATION_CLOSED and creates no account", async () => {
      const res = await postJson(app, "/auth/register", REGISTER_BODY("closed-reg@example.com"));
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: "Registration is closed", code: "REGISTRATION_CLOSED" });
      const rows = await getTestDb().select().from(usersTable);
      expect(rows.some((r) => r.email === "closed-reg@example.com")).toBe(false);
    });

    it("a non-privileged user cannot create a model (403 REGISTRATION_CLOSED)", async () => {
      const res = await request("POST", "/models", user.token, { name: "Late model", categoryId, levelId });
      expect(res.status).toBe(403);
      expect(res.json).toEqual({ error: "Registration is closed", code: "REGISTRATION_CLOSED" });
    });

    it("a manager can still create a model (200)", async () => {
      const res = await request("POST", "/models", manager.token, { name: "Manager model", categoryId, levelId });
      expect(res.status).toBe(200);
      expect(typeof res.json.id).toBe("string");
    });

    it("a non-privileged user cannot edit an existing model (403), while it is open", async () => {
      await setSetting("registrationStatus", "open");
      const created = await request("POST", "/models", user.token, { name: "Before closing", categoryId, levelId });
      expect(created.status).toBe(200);
      await setSetting("registrationStatus", "closed");

      const res = await request("PUT", `/models/${created.json.id}`, user.token, { name: "Renamed" });
      expect(res.status).toBe(403);
      expect(res.json.code).toBe("REGISTRATION_CLOSED");
    });

    it("a non-privileged user cannot enroll in the event (403 REGISTRATION_CLOSED), a manager can", async () => {
      const refused = await request("POST", `/events/${eventId}/enroll`, user.token, {});
      expect(refused.status).toBe(403);
      expect(refused.json.code).toBe("REGISTRATION_CLOSED");

      const allowed = await request("POST", `/events/${eventId}/enroll`, manager.token, {});
      expect(allowed.status).toBe(200);
      expect(allowed.json.status).toBe("accepted");
    });

    it("the closed status is not an error for the public endpoint", async () => {
      const res = await request("GET", "/public/registration");
      expect(res.status).toBe(200);
      expect(res.json.status).toBe("closed");
    });
  });

  describe("open and openday", () => {
    it("open (default): registration, model create and event enrollment work for a user", async () => {
      const register = await postJson(app, "/auth/register", REGISTER_BODY("open-reg@example.com"));
      expect(register.status).toBe(200);
      const model = await request("POST", "/models", user.token, { name: "Open model", categoryId, levelId });
      expect(model.status).toBe(200);
      const enrolled = await request("POST", `/events/${eventId}/enroll`, user.token, {});
      expect(enrolled.status).toBe(200);
    });

    it("openday behaves like open", async () => {
      await setSetting("registrationStatus", "openday");
      const register = await postJson(app, "/auth/register", REGISTER_BODY("openday-reg@example.com"));
      expect(register.status).toBe(200);
      const model = await request("POST", "/models", user.token, { name: "Openday model", categoryId, levelId });
      expect(model.status).toBe(200);
    });
  });

  describe("settings validation and public endpoint", () => {
    it("PUT /admin/settings refuses an unknown registrationStatus or defaultPublicPage (422)", async () => {
      const badStatus = await request("PUT", "/admin/settings", admin.token, { registrationStatus: "maybe" });
      expect(badStatus.status).toBe(422);
      const badPage = await request("PUT", "/admin/settings", admin.token, { defaultPublicPage: "home" });
      expect(badPage.status).toBe(422);
      const ok = await request("PUT", "/admin/settings", admin.token, { registrationStatus: "closed", defaultPublicPage: "register" });
      expect(ok.status).toBe(200);
    });

    it("GET /settings exposes the defaults", async () => {
      const res = await request("GET", "/settings", user.token);
      expect(res.json).toMatchObject({
        registrationStatus: "open", defaultPublicPage: "login", lockLevelToFirstSelection: "false", levelUpWarning: "false"
      });
    });

    it("GET /public/registration needs no auth and derives defaultPage", async () => {
      const defaults = await request("GET", "/public/registration");
      expect(defaults.status).toBe(200);
      expect(defaults.json).toEqual({ status: "open", defaultPage: "login", turnstileSiteKey: null });

      await setSetting("defaultPublicPage", "register");
      expect((await request("GET", "/public/registration")).json).toEqual({ status: "open", defaultPage: "register", turnstileSiteKey: null });
    });

    it("openday always opens on the register page", async () => {
      await setSetting("registrationStatus", "openday");
      expect((await request("GET", "/public/registration")).json).toEqual({ status: "openday", defaultPage: "register", turnstileSiteKey: null });
    });
  });
});
