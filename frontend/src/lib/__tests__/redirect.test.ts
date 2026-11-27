import { describe, it, expect } from "vitest";
import { loginPathFor, safeNextPath } from "../redirect";

describe("safeNextPath", () => {
  it("accepts in-app paths with their query string", () => {
    expect(safeNextPath("/judge?eventId=e1&categoryId=c1")).toBe("/judge?eventId=e1&categoryId=c1");
    expect(safeNextPath("/")).toBe("/");
  });

  it.each([
    null,
    undefined,
    "",
    "judge",
    "https://evil.com",
    "//evil.com",
    "/\\evil.com",
    "/\t/evil.com",
    "/judge\n",
    "/login?next=/judge",
    "/login",
  ])("rejects %j", (value) => {
    expect(safeNextPath(value)).toBeNull();
  });
});

describe("loginPathFor", () => {
  it("keeps the requested page so that login can send the user back to it", () => {
    const target = loginPathFor("/judge", "?eventId=e1&categoryId=c1");
    expect(target).toBe("/login?next=" + encodeURIComponent("/judge?eventId=e1&categoryId=c1"));
    const next = new URLSearchParams(target.split("?")[1]).get("next");
    expect(safeNextPath(next)).toBe("/judge?eventId=e1&categoryId=c1");
  });

  it("uses the plain login route for the home page", () => {
    expect(loginPathFor("/", "")).toBe("/login");
  });
});
