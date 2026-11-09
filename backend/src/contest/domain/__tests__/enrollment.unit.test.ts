import { describe, it, expect } from "bun:test";
import { planEnrollment, type EnrollmentContext } from "../enrollment";
import { isEnrollmentClosed } from "../../infra/http/enrollment-guard";

const base = (over: Partial<EnrollmentContext> = {}): EnrollmentContext => ({
  userId: "u1", role: "user", eventId: "e1",
  event: { id: "e1", status: "accepted" },
  category: { id: "c1", eventId: "e1", status: "open" },
  model: { id: "m1", userId: "u1", categoryId: "c1" },
  requested: { modelId: "m1", categoryId: "c1" },
  windowClosed: false,
  ...over
});
const fails = (ctx: EnrollmentContext, status: number) => {
  try { planEnrollment(ctx); } catch (e: any) { expect(e.status).toBe(status); return; }
  throw new Error("expected failure");
};

describe("planEnrollment", () => {
  it("accepts own model and normalizes", () => {
    expect(planEnrollment(base())).toEqual({ ownerUserId: "u1", modelId: "m1", categoryId: "c1" });
  });
  it("fills categoryId from the model when omitted", () => {
    expect(planEnrollment(base({ requested: { modelId: "m1" } })).categoryId).toBe("c1");
  });
  it("event-only enrollment (no model, no category) still allowed", () => {
    expect(planEnrollment(base({ model: null, category: null, requested: {} }))).toEqual({ ownerUserId: "u1", modelId: null, categoryId: null });
  });
  it("404 on unknown event / model", () => {
    fails(base({ event: null }), 404);
    fails(base({ model: null }), 404);
  });
  it("404 (not 403) on someone else's model", () => {
    fails(base({ model: { id: "m1", userId: "other", categoryId: "c1" } }), 404);
  });
  it("manager may enroll any model; registration belongs to the model owner and ignores the window", () => {
    const p = planEnrollment(base({ role: "manager", windowClosed: true, model: { id: "m1", userId: "other", categoryId: "c1" } }));
    expect(p.ownerUserId).toBe("other");
  });
  it("422 when categoryId mismatches the model", () => {
    fails(base({ requested: { modelId: "m1", categoryId: "c2" } }), 422);
  });
  it("422 when category belongs to another event or does not exist", () => {
    fails(base({ category: { id: "c1", eventId: "e2", status: "open" } }), 422);
    fails(base({ category: null }), 422);
  });
  it("409 when category or event is closed", () => {
    fails(base({ category: { id: "c1", eventId: "e1", status: "closed" } }), 409);
    fails(base({ event: { id: "e1", status: "closed" } }), 409);
  });
  it("403 when the enrollment window is over (non managers)", () => {
    fails(base({ windowClosed: true }), 403);
  });
});

describe("isEnrollmentClosed", () => {
  const now = new Date("2026-06-10T12:00:00Z");
  it("past / future / date-only end-of-day / invalid / none", () => {
    expect(isEnrollmentClosed([{ enrollmentCloseDate: "2026-06-01" }], now)).toBe(true);
    expect(isEnrollmentClosed([{ enrollmentCloseDate: "2026-06-10" }], now)).toBe(false);
    expect(isEnrollmentClosed([{ enrollmentCloseDate: "2026-07-01" }], now)).toBe(false);
    expect(isEnrollmentClosed([{ enrollmentCloseDate: "garbage" }], now)).toBe(false);
    expect(isEnrollmentClosed([{ enrollmentCloseDate: null }], now)).toBe(false);
    expect(isEnrollmentClosed([], now)).toBe(false);
  });
});
