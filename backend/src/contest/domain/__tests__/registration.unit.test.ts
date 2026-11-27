import { describe, it, expect } from "bun:test";
import {
  parseDefaultPublicPage, parseRegistrationStatus, publicRegistration, registrationSettingError
} from "../registration";
import { planEnrollment, type EnrollmentContext } from "../enrollment";

describe("registration status", () => {
  it("defaults to open; only open, openday and closed are valid", () => {
    expect(parseRegistrationStatus(undefined)).toBe("open");
    expect(parseRegistrationStatus("")).toBe("open");
    expect(parseRegistrationStatus("nope")).toBe("open");
    expect(parseRegistrationStatus("closed")).toBe("closed");
    expect(parseRegistrationStatus("openday")).toBe("openday");
  });

  it("PUT validation rejects unknown statuses and public pages", () => {
    expect(registrationSettingError([["registrationStatus", "closed"]])).toBeNull();
    expect(registrationSettingError([["registrationStatus", "Closed"]])).toContain("registrationStatus");
    expect(registrationSettingError([["defaultPublicPage", "register"]])).toBeNull();
    expect(registrationSettingError([["defaultPublicPage", "home"]])).toContain("defaultPublicPage");
    expect(registrationSettingError([["appTheme", "dark"]])).toBeNull();
  });
});

describe("public registration (GET /public/registration)", () => {
  it("defaultPublicPage parses to login unless register", () => {
    expect(parseDefaultPublicPage(undefined)).toBe("login");
    expect(parseDefaultPublicPage("register")).toBe("register");
    expect(parseDefaultPublicPage("other")).toBe("login");
  });

  it("defaultPage is register for openday or when the setting says register", () => {
    expect(publicRegistration("openday", "login")).toEqual({ status: "openday", defaultPage: "register" });
    expect(publicRegistration("open", "register")).toEqual({ status: "open", defaultPage: "register" });
    expect(publicRegistration("open", "login")).toEqual({ status: "open", defaultPage: "login" });
    expect(publicRegistration("closed", "login")).toEqual({ status: "closed", defaultPage: "login" });
  });
});

describe("planEnrollment with registration closed", () => {
  const base = (over: Partial<EnrollmentContext> = {}): EnrollmentContext => ({
    userId: "u1", role: "user", eventId: "e1",
    event: { id: "e1", status: "accepted" },
    category: { id: "c1", eventId: "e1", status: "open" },
    model: { id: "m1", userId: "u1", categoryId: "c1" },
    requested: { modelId: "m1", categoryId: "c1" },
    windowClosed: false,
    registrationClosed: true,
    ...over
  });

  it("refuses a non-privileged user with REGISTRATION_CLOSED (403)", () => {
    try { planEnrollment(base()); throw new Error("expected failure"); }
    catch (e: any) { expect(e.status).toBe(403); expect(e.code).toBe("REGISTRATION_CLOSED"); }
  });

  it("managers and admins are not refused", () => {
    expect(planEnrollment(base({ role: "manager" })).modelId).toBe("m1");
    expect(planEnrollment(base({ role: "admin" })).modelId).toBe("m1");
  });

  it("open registration does not refuse", () => {
    expect(planEnrollment(base({ registrationClosed: false })).modelId).toBe("m1");
  });
});
