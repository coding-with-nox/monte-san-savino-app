import { describe, it, expect, beforeEach, afterAll } from "bun:test";
import { createCategory, createEvent, createLevel, createUser, request, resetDb } from "./fixtures";
import { getTestDb } from "./testDb";
import { modelsTable, registrationsTable } from "../contest/infra/persistence/schema";
import { userProfilesTable } from "../identity/infra/persistence/schema";

// Second part of the security review: NEW-04 (uuid), NEW-05 (socials), NEW-06 (print headers).
describe("integration security hardening (review part 2)", () => {
  let manager: Awaited<ReturnType<typeof createUser>>;
  let eventId: string;

  beforeEach(async () => {
    await resetDb();
    manager = await createUser("manager");
    eventId = await createEvent();
  });
  afterAll(resetDb);

  it("answers 422, not a database error, for ids that are not uuids", async () => {
    const paths = [
      "/awards/events/abc",
      "/awards/monitoring/abc",
      "/awards/categories/abc/review",
      "/exports/enrollments?eventId=abc",
      "/exports/models?categoryId=abc",
      "/exports/users/by-event/excel?eventId=abc",
      "/exports/users/by-event/pdf?eventId=abc"
    ];
    for (const path of paths) {
      const res = await request("GET", path, manager.token);
      expect({ path, status: res.status }).toEqual({ path, status: 422 });
      expect(res.text).not.toContain("invalid input syntax");
    }
    const patch = await request("PATCH", "/awards/abc", manager.token, { medalRank: 1 });
    expect(patch.status).toBe(422);
  });

  it("prints carry a CSP that only allows the print script, and nosniff", async () => {
    const res = await request("GET", `/exports/events/${eventId}/judge-sheets`, manager.token);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-security-policy")).toContain("script-src 'sha256-");
    expect(res.headers.get("content-security-policy")).toContain("default-src 'none'");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("exports social links only for participants with a public profile", async () => {
    const categoryId = await createCategory(eventId);
    const levelId = await createLevel();
    const db = getTestDb();
    let code = 0;
    for (const [handle, publicProfile] of [["visible_handle", true], ["hidden_handle", false]] as const) {
      const owner = await createUser();
      await db.insert(userProfilesTable).values({ userId: owner.id, firstName: handle, instagram: handle, publicProfile } as any);
      const modelId = crypto.randomUUID();
      await db.insert(modelsTable).values({ id: modelId, userId: owner.id, categoryId, levelId, name: "M", code: ++code });
      await db.insert(registrationsTable).values({ id: crypto.randomUUID(), userId: owner.id, eventId, modelId, categoryId, status: "registered" });
    }
    const pdf = await request("GET", `/exports/users/by-event/pdf?eventId=${eventId}`, manager.token);
    expect(pdf.status).toBe(200);
    expect(pdf.text).toContain("instagram.com/visible_handle");
    expect(pdf.text).not.toContain("instagram.com/hidden_handle");
  });
});
