import { describe, it, expect } from "bun:test";
import {
  findLevelLock, isSamePerson, isStandardGold, levelUpSettingError, matchesStandardGold, parseBooleanSetting
} from "../levelUp";

describe("findLevelLock (level lock rule)", () => {
  const OPEN = { levelId: "L-open", levelName: "Open" };
  const ALL = { levelId: "L-all", levelName: "All" };
  const STD = { levelId: "L-std", levelName: "Standard" };

  it("no own models in the event: nothing is locked", () => {
    expect(findLevelLock({ requestedLevelId: "L-std", requestedLevelName: "Standard", ownModels: [] })).toBeNull();
  });

  it("same level as an existing model: allowed", () => {
    expect(findLevelLock({ requestedLevelId: "L-std", requestedLevelName: "Standard", ownModels: [STD] })).toBeNull();
  });

  it("different level from an existing non-All model: locked to that level", () => {
    expect(findLevelLock({ requestedLevelId: "L-open", requestedLevelName: "Open", ownModels: [STD] }))
      .toEqual({ lockedLevelId: "L-std", lockedLevelName: "Standard" });
  });

  it("requesting All is never blocked", () => {
    expect(findLevelLock({ requestedLevelId: "L-all", requestedLevelName: "All", ownModels: [STD, OPEN] })).toBeNull();
  });

  it("requesting 'all' in any letter case is never blocked", () => {
    expect(findLevelLock({ requestedLevelId: "x", requestedLevelName: "  ALL ", ownModels: [STD] })).toBeNull();
  });

  it("existing All models never lock anything", () => {
    expect(findLevelLock({ requestedLevelId: "L-std", requestedLevelName: "Standard", ownModels: [ALL] })).toBeNull();
  });

  it("existing model with the All name in another case never locks", () => {
    expect(findLevelLock({
      requestedLevelId: "L-std", requestedLevelName: "Standard",
      ownModels: [{ levelId: "L-x", levelName: "aLl" }]
    })).toBeNull();
  });

  it("models whose level is unknown (no name / no id) are ignored", () => {
    expect(findLevelLock({
      requestedLevelId: "L-std", requestedLevelName: "Standard",
      ownModels: [{ levelId: "L-x", levelName: null }, { levelId: null, levelName: "Open" }]
    })).toBeNull();
  });

  it("an unknown requested level name is compared by id", () => {
    expect(findLevelLock({ requestedLevelId: "L-new", requestedLevelName: null, ownModels: [STD] }))
      .toEqual({ lockedLevelId: "L-std", lockedLevelName: "Standard" });
  });

  it("the first conflicting model decides the locked level (All models skipped)", () => {
    expect(findLevelLock({ requestedLevelId: "L-x", requestedLevelName: "Novice", ownModels: [ALL, OPEN, STD] }))
      .toEqual({ lockedLevelId: "L-open", lockedLevelName: "Open" });
  });
});

describe("isSamePerson (level-up matching)", () => {
  it("matches by email, case-insensitive, whatever the names", () => {
    expect(isSamePerson({ email: "Mario@Example.com", firstName: "A", lastName: "B" },
      { email: "mario@example.com", firstName: "X", lastName: "Y" })).toBe(true);
  });

  it("different emails on both sides never match, even with the same name", () => {
    expect(isSamePerson({ email: "a@x.it", firstName: "Mario", lastName: "Rossi" },
      { email: "b@x.it", firstName: "Mario", lastName: "Rossi" })).toBe(false);
  });

  it("falls back to first + last name when one side has no email", () => {
    expect(isSamePerson({ email: null, firstName: " mario ", lastName: "ROSSI" },
      { email: "m@x.it", firstName: "Mario", lastName: "Rossi" })).toBe(true); // person has no email: names decide
    expect(isSamePerson({ email: null, firstName: " mario ", lastName: "ROSSI" },
      { email: null, firstName: "Mario", lastName: "Rossi" })).toBe(true);
  });

  it("name match needs both first and last name", () => {
    expect(isSamePerson({ email: null, firstName: "Mario", lastName: null },
      { email: null, firstName: "Mario", lastName: null })).toBe(false);
    expect(isSamePerson({ email: null, firstName: "Mario", lastName: "Rossi" },
      { email: null, firstName: "Mario", lastName: "Bianchi" })).toBe(false);
  });

  it("collapses repeated inner spaces in names", () => {
    expect(isSamePerson({ firstName: "Anna  Maria", lastName: "Verdi" },
      { firstName: "anna maria", lastName: "VERDI" })).toBe(true);
  });
});

describe("matchesStandardGold (level-up)", () => {
  const gold = { email: "m@x.it", firstName: "Mario", lastName: "Rossi", levelName: "Standard", medalRank: 4 };

  it("Standard gold (rank 4) and above qualifies, case-insensitive level name", () => {
    expect(isStandardGold({ levelName: "STANDARD", medalRank: 4 })).toBe(true);
    expect(isStandardGold({ levelName: " standard ", medalRank: 7 })).toBe(true);
  });

  it("silver or lower, or another level, does not qualify", () => {
    expect(isStandardGold({ levelName: "Standard", medalRank: 3 })).toBe(false);
    expect(isStandardGold({ levelName: "Open", medalRank: 10 })).toBe(false);
  });

  it("matches a person against Standard golds only", () => {
    expect(matchesStandardGold({ email: "M@x.it" }, [gold])).toBe(true);
    expect(matchesStandardGold({ firstName: "mario", lastName: "rossi" }, [gold])).toBe(true);
    expect(matchesStandardGold({ email: "m@x.it" }, [{ ...gold, levelName: "Open" }])).toBe(false);
    expect(matchesStandardGold({ email: "m@x.it" }, [{ ...gold, medalRank: 3 }])).toBe(false);
    expect(matchesStandardGold({ email: "other@x.it", firstName: "Luca", lastName: "Neri" }, [gold])).toBe(false);
    expect(matchesStandardGold({ email: "m@x.it" }, [])).toBe(false);
  });
});

describe("level settings", () => {
  it("booleans are the strings true/false (anything else is false)", () => {
    expect(parseBooleanSetting("true")).toBe(true);
    expect(parseBooleanSetting("false")).toBe(false);
    expect(parseBooleanSetting("yes")).toBe(false);
    expect(parseBooleanSetting(undefined)).toBe(false);
  });

  it("PUT validation accepts only true/false for both level settings", () => {
    expect(levelUpSettingError([["lockLevelToFirstSelection", "true"], ["levelUpWarning", "false"]])).toBeNull();
    expect(levelUpSettingError([["lockLevelToFirstSelection", "1"]])).toContain("lockLevelToFirstSelection");
    expect(levelUpSettingError([["levelUpWarning", "TRUE"]])).toContain("levelUpWarning");
    expect(levelUpSettingError([["appTheme", "dark"]])).toBeNull();
  });
});
