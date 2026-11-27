import { describe, it, expect } from "bun:test";
import {
  absenceRegisterSettingError, excludeAbsentOwners, isOwnerPresent, parseAbsenceRegisterEnabled
} from "../absenceRegister";
import { judgeCanVote, type JudgeContext } from "../../infra/persistence/judgeAccess";

const EVENT = "e1";
const model = { categoryId: "c1", eventId: EVENT, userId: "owner" };

describe("absence register settings", () => {
  it("is on only for the exact value true", () => {
    expect(parseAbsenceRegisterEnabled("true")).toBe(true);
    expect(parseAbsenceRegisterEnabled("false")).toBe(false);
    expect(parseAbsenceRegisterEnabled(undefined)).toBe(false);
  });

  it("validates the value on PUT /admin/settings", () => {
    expect(absenceRegisterSettingError([["absenceRegisterEnabled", "true"]])).toBeNull();
    expect(absenceRegisterSettingError([["absenceRegisterEnabled", "false"]])).toBeNull();
    expect(absenceRegisterSettingError([["absenceRegisterEnabled", "yes"]])).not.toBeNull();
    expect(absenceRegisterSettingError([["absenceRegisterEnabled", "True"]])).not.toBeNull();
    expect(absenceRegisterSettingError([["other", "x"]])).toBeNull();
  });
});

describe("absence filtering", () => {
  const models = [{ id: "m1", ownerId: "present" }, { id: "m2", ownerId: "absent" }];

  it("keeps every model when the register is disabled (null)", () => {
    expect(excludeAbsentOwners(models, null)).toEqual(models);
    expect(isOwnerPresent(null, EVENT, "absent")).toBe(true);
  });

  it("drops the models of absent owners when enabled", () => {
    expect(excludeAbsentOwners(models, new Set(["present"]))).toEqual([{ id: "m1", ownerId: "present" }]);
    expect(excludeAbsentOwners(models, new Set<string>())).toEqual([]);
  });

  it("presence is per event", () => {
    const presence = new Map([["e1", new Set(["owner"])]]);
    expect(isOwnerPresent(presence, "e1", "owner")).toBe(true);
    expect(isOwnerPresent(presence, "e2", "owner")).toBe(false);
    expect(isOwnerPresent(presence, "e1", "nobody")).toBe(false);
  });
});

describe("judge visibility with the absence register", () => {
  const assignments = [{ judgeId: "judge", eventId: EVENT, categoryId: null, standingIn: false }];
  const ctx = (presence: JudgeContext["presence"]): JudgeContext => ({ judgeId: "judge", privileged: false, assignments, presence });

  it("a present owner's model is votable", () => {
    expect(judgeCanVote(ctx(new Map([[EVENT, new Set(["owner"])]])), model)).toBe(true);
  });

  it("an absent owner's model is not votable while the register is on", () => {
    expect(judgeCanVote(ctx(new Map([[EVENT, new Set<string>()]])), model)).toBe(false);
  });

  it("with the register off (presence null) nothing changes", () => {
    expect(judgeCanVote(ctx(null), model)).toBe(true);
  });

  it("managers and admins are never filtered", () => {
    const privileged: JudgeContext = { judgeId: "m", privileged: true, assignments: [], presence: new Map() };
    expect(judgeCanVote(privileged, model)).toBe(true);
  });
});
