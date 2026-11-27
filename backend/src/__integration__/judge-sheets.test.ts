import { describe, it, expect, beforeEach, afterAll } from "bun:test";
import { createCategory, createEvent, createUser, request, resetDb } from "./fixtures";
import { getTestDb } from "./testDb";
import { judgeAssignmentsTable } from "../contest/infra/persistence/schema";
import { userProfilesTable } from "../identity/infra/persistence/schema";

describe("integration GET /exports/events/:eventId/judge-sheets", () => {
  let eventId: string;
  let pittura: string;
  let scultura: string;
  let manager: { token: string };
  let anna: { id: string; email: string };
  let bruno: { id: string; email: string };

  beforeEach(async () => {
    await resetDb();
    eventId = await createEvent("Fiera test");
    pittura = await createCategory(eventId, "Pittura");
    scultura = await createCategory(eventId, "Scultura");
    manager = await createUser("manager");
    anna = await createUser("judge");
    bruno = await createUser("judge");
    const db = getTestDb();
    await db.insert(userProfilesTable).values({ userId: anna.id, firstName: "Anna", lastName: "Verdi" });
    // Anna judges two classes, stand-in in Scultura; Bruno is assigned to the whole event.
    await db.insert(judgeAssignmentsTable).values([
      { id: crypto.randomUUID(), eventId, judgeId: anna.id, categoryId: scultura, standingIn: true },
      { id: crypto.randomUUID(), eventId, judgeId: anna.id, categoryId: pittura, standingIn: false },
      { id: crypto.randomUUID(), eventId, judgeId: bruno.id, categoryId: null, standingIn: false }
    ]);
  });
  afterAll(resetDb);

  it("401 without a token, 403 for a judge", async () => {
    expect((await request("GET", `/exports/events/${eventId}/judge-sheets`)).status).toBe(401);
    const judge = await createUser("judge");
    expect((await request("GET", `/exports/events/${eventId}/judge-sheets`, judge.token)).status).toBe(403);
  });

  it("422 for a malformed eventId, 404 for an unknown event", async () => {
    expect((await request("GET", "/exports/events/not-a-uuid/judge-sheets", manager.token)).status).toBe(422);
    const unknown = crypto.randomUUID();
    const res = await request("GET", `/exports/events/${unknown}/judge-sheets`, manager.token);
    expect(res.status).toBe(404);
    expect(res.json.error).toBe("Event not found");
  });

  it("200 printable HTML: one sheet per judge, classes, stand-in marker, app URL and class QR codes", async () => {
    const res = await request("GET", `/exports/events/${eventId}/judge-sheets`, manager.token);
    expect(res.status).toBe(200);
    expect(res.text).toContain("<html lang=\"it\">");
    expect(res.text.match(/<section class="judge-sheet">/g)).toHaveLength(2);
    expect(res.text).toContain("Anna Verdi");
    expect(res.text).toContain(anna.email);
    expect(res.text).toContain(bruno.email);
    expect(res.text.match(/\[Sostituto\]/g)).toHaveLength(1);
    expect(res.text).toContain("Accedi con la tua email e password: la sessione resta valida per 24 ore.");
    // one QR per class: the page opened for each class is encoded in its image alt text
    expect(res.text).toContain(`/judge?eventId=${eventId}&amp;categoryId=${scultura}`);
    expect(res.text).toContain(`/judge?eventId=${eventId}&amp;categoryId=${pittura}`);
    expect(res.text.match(/src="data:image\/png;base64,/g)?.length).toBe(4);
  });

  it("lang=en renders the English sheet", async () => {
    const res = await request("GET", `/exports/events/${eventId}/judge-sheets?lang=en`, manager.token);
    expect(res.status).toBe(200);
    expect(res.text).toContain("<html lang=\"en\">");
    expect(res.text).toContain("<h1>Judge sheet</h1>");
    expect(res.text.match(/\[Stand-in\]/g)).toHaveLength(1);
    expect(res.text).toContain("Log in with your email and password: the session stays valid for 24 hours.");
  });

  it("jury-qr of a class encodes the judge page of that class, not the jury: payload", async () => {
    const res = await request("GET", `/exports/classes/${scultura}/jury-qr`, manager.token);
    expect(res.status).toBe(200);
    expect(res.text).toContain(`/judge?eventId=${eventId}&amp;categoryId=${scultura}`);
    expect(res.text).not.toContain("jury:");
  });
});
