import { describe, it, expect } from "bun:test";
import { Email } from "../Email";

describe("Email.unit.create", () => {
  it("accepts a valid email and lowercases it", () => {
    const email = Email.create("User@Example.COM");
    expect(email.value).toBe("user@example.com");
  });

  it("trims leading and trailing whitespace", () => {
    const email = Email.create("  hello@world.io  ");
    expect(email.value).toBe("hello@world.io");
  });

  it("throws 'Invalid email' when @ is missing", () => {
    expect(() => Email.create("notanemail")).toThrow("Invalid email");
  });

  it("throws 'Invalid email' when input contains spaces after trim fails regex", () => {
    expect(() => Email.create("bad email@domain.com")).toThrow("Invalid email");
  });

  it("throws 'Invalid email' for empty string", () => {
    expect(() => Email.create("")).toThrow("Invalid email");
  });
});
