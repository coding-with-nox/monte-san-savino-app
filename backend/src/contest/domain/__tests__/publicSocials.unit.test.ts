import { describe, it, expect } from "bun:test";
import { socialsAvailable, publicDisplayView, type DisplayOwner } from "../publicSocials";

const socials = { instagram: "mario", facebook: null, website: "https://example.com", patreon: null, pinterest: null, tiktok: null };
const owner = (over: Partial<DisplayOwner> = {}): DisplayOwner => ({
  firstName: "Mario", lastName: "Rossi", country: "Italia", publicProfile: true, ...socials, ...over
});

describe("socialsAvailable", () => {
  it("is false without classes", () => {
    expect(socialsAvailable([])).toBe(false);
  });
  it("is true only when every class is closed", () => {
    expect(socialsAvailable(["closed", "closed"])).toBe(true);
    expect(socialsAvailable(["closed", "open"])).toBe(false);
    expect(socialsAvailable(["open"])).toBe(false);
  });
});

describe("publicDisplayView", () => {
  it("includes name, country and socials when the owner opted in", () => {
    const view = publicDisplayView({ displayNumber: 7, categoryName: "Fantasy", modelNames: ["Orco", "Elfo"], owner: owner() });
    expect(view).toEqual({
      displayNumber: 7,
      categoryName: "Fantasy",
      models: ["Orco", "Elfo"],
      optedIn: true,
      exhibitor: { name: "Mario Rossi", country: "Italia", socials }
    });
  });
  it("hides the exhibitor entirely when publicProfile is not true", () => {
    for (const publicProfile of [false, null]) {
      const view = publicDisplayView({ displayNumber: 7, categoryName: "Fantasy", modelNames: ["Orco"], owner: owner({ publicProfile }) });
      expect(view.optedIn).toBe(false);
      expect("exhibitor" in view).toBe(false);
    }
  });
  it("hides the exhibitor when the display has no owner profile", () => {
    const view = publicDisplayView({ displayNumber: 1, categoryName: "Base", modelNames: [], owner: null });
    expect(view.optedIn).toBe(false);
    expect("exhibitor" in view).toBe(false);
  });
  it("uses an empty name and null country when the profile has none", () => {
    const view = publicDisplayView({ displayNumber: 1, categoryName: "Base", modelNames: [], owner: owner({ firstName: null, lastName: null, country: null }) });
    expect(view.exhibitor).toEqual({ name: "", country: null, socials });
  });
});
