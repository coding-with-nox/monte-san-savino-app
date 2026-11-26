import { describe, it, expect } from "bun:test";
import { DEFAULT_SECTION_VISIBILITY, findInvalidVisibilityEntry, parseSectionVisibility, SECTIONS } from "../sectionVisibility";

describe("sectionVisibility", () => {
  it("uses the defaults for missing or malformed settings", () => {
    for (const v of [undefined, "", "not json", "3"]) expect(parseSectionVisibility(v)).toEqual(DEFAULT_SECTION_VISIBILITY);
  });

  it("overrides only the configured roles and drops unknown sections", () => {
    const out = parseSectionVisibility(JSON.stringify({ jury_president: ["stats", "nope"], admin: [] }));
    expect(out.jury_president).toEqual(["stats"]);
    expect(out.user).toEqual(DEFAULT_SECTION_VISIBILITY.user);
    expect(out.admin).toEqual([...SECTIONS]);
  });

  it("gives jury_president dashboard and stats by default", () => {
    expect(DEFAULT_SECTION_VISIBILITY.jury_president).toContain("dashboard");
    expect(DEFAULT_SECTION_VISIBILITY.jury_president).toContain("stats");
  });

  it("detects unknown roles and sections", () => {
    expect(findInvalidVisibilityEntry({ judge: ["judge"] })).toBeNull();
    expect(findInvalidVisibilityEntry({ ghost: [] })).toBe("ghost");
    expect(findInvalidVisibilityEntry({ judge: ["x"] })).toBe("x");
  });
});
