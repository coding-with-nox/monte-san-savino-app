import { describe, it, expect } from "bun:test";
import { shouldSeedDemo } from "../seedPolicy";

describe("shouldSeedDemo (SEC-07)", () => {
  it("seeds only with SEED_DEMO=true outside production", () => {
    expect(shouldSeedDemo({ SEED_DEMO: "true", NODE_ENV: "development" })).toBe(true);
    expect(shouldSeedDemo({ SEED_DEMO: "true" })).toBe(true);
  });
  it("does not seed without the explicit flag, whatever NODE_ENV is", () => {
    expect(shouldSeedDemo({})).toBe(false);
    expect(shouldSeedDemo({ NODE_ENV: "development" })).toBe(false);
    expect(shouldSeedDemo({ SEED_DEMO: "1", NODE_ENV: "development" })).toBe(false);
  });
  it("never seeds in production, even with the flag", () => {
    expect(shouldSeedDemo({ SEED_DEMO: "true", NODE_ENV: "production" })).toBe(false);
  });
});
