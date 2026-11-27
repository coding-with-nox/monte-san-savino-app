import { describe, it, expect, beforeEach } from "bun:test";
import { createCategory, createEvent, createLevel, createUser, request, resetDb } from "./fixtures";
import { getTestDb } from "./testDb";
import { modelsTable } from "../contest/infra/persistence/schema";
import { userProfilesTable } from "../identity/infra/persistence/schema";

const LONG = 20_000;

describe("integration public socials", () => {
  let ids: {
    emptyEvent: string; openEvent: string; closedEvent: string;
    ownerIn: string; ownerOut: string;
  };
  let code = 0;

  async function addModel(userId: string, categoryId: string, name: string, displayNumber: number) {
    await getTestDb().insert(modelsTable).values({
      id: crypto.randomUUID(), userId, categoryId, levelId: await createLevel(), name, code: ++code, displayNumber
    });
  }

  beforeEach(async () => {
    await resetDb();
    code = 0;
    const ownerIn = await createUser("user");
    const ownerOut = await createUser("user");
    await getTestDb().insert(userProfilesTable).values([
      {
        userId: ownerIn.id, firstName: "Mario", lastName: "Rossi", country: "Italia", publicProfile: true,
        instagram: "mario.painter", website: "https://mario.example"
      },
      { userId: ownerOut.id, firstName: "Luigi", lastName: "Verdi", country: "Italia", publicProfile: false, instagram: "luigi" }
    ]);

    const emptyEvent = await createEvent("Senza classi");

    // Open event: one class still open, so the socials stay unavailable.
    const openEvent = await createEvent("Aperto");
    const openFantasy = await createCategory(openEvent, "Fantasy", "open");
    await createCategory(openEvent, "Sci-fi", "closed");
    await addModel(ownerIn.id, openFantasy, "Orco aperto", 5);

    // Closed event: every class closed. Display 3 has two models of an opted-in owner, display 4 an opted-out one.
    const closedEvent = await createEvent("Chiuso");
    const fantasy = await createCategory(closedEvent, "Fantasy", "closed");
    const scifi = await createCategory(closedEvent, "Sci-fi", "closed");
    await addModel(ownerIn.id, scifi, "Elfo", 3);
    await addModel(ownerIn.id, fantasy, "Mago", 3);
    await addModel(ownerOut.id, fantasy, "Drago", 4);

    ids = { emptyEvent, openEvent, closedEvent, ownerIn: ownerIn.id, ownerOut: ownerOut.id };
  });

  it("GET /public/socials/:eventId is unavailable without classes or while one class is open", async () => {
    expect((await request("GET", `/public/socials/${ids.emptyEvent}`)).json).toEqual({ available: false });
    expect((await request("GET", `/public/socials/${ids.openEvent}`)).json).toEqual({ available: false });
  }, LONG);

  it("GET /public/socials/:eventId is available once every class is closed", async () => {
    expect((await request("GET", `/public/socials/${ids.closedEvent}`)).json).toEqual({ available: true });
  }, LONG);

  it("answers 403 NOT_AVAILABLE_YET for a display while classes are still open", async () => {
    const res = await request("GET", `/public/socials/${ids.openEvent}/displays/5`);
    expect(res.status).toBe(403);
    expect(res.json.code).toBe("NOT_AVAILABLE_YET");
  }, LONG);

  it("answers 404 for a display that does not exist in the event", async () => {
    const res = await request("GET", `/public/socials/${ids.closedEvent}/displays/99`);
    expect(res.status).toBe(404);
  }, LONG);

  it("returns the display, its models and the exhibitor once the classes are closed", async () => {
    const res = await request("GET", `/public/socials/${ids.closedEvent}/displays/3`);
    expect(res.status).toBe(200);
    expect(res.json.displayNumber).toBe(3);
    expect(res.json.categoryName).toBe("Sci-fi");
    expect(res.json.models).toEqual(["Elfo", "Mago"]);
    expect(res.json.optedIn).toBe(true);
    expect(res.json.exhibitor.name).toBe("Mario Rossi");
    expect(res.json.exhibitor.country).toBe("Italia");
    expect(res.json.exhibitor.socials.instagram).toBe("mario.painter");
    expect(res.json.exhibitor.socials.website).toBe("https://mario.example");
    expect(res.json.exhibitor.socials.tiktok).toBeNull();
    expect(res.json.exhibitor.email).toBeUndefined();
  }, LONG);

  it("hides the exhibitor when the owner did not opt in", async () => {
    const res = await request("GET", `/public/socials/${ids.closedEvent}/displays/4`);
    expect(res.status).toBe(200);
    expect(res.json.models).toEqual(["Drago"]);
    expect(res.json.optedIn).toBe(false);
    expect("exhibitor" in res.json).toBe(false);
  }, LONG);

  it("rejects a malformed event id with 422", async () => {
    expect((await request("GET", "/public/socials/not-a-uuid")).status).toBe(422);
    expect((await request("GET", `/public/socials/${ids.closedEvent}/displays/abc`)).status).toBe(422);
  }, LONG);
});
