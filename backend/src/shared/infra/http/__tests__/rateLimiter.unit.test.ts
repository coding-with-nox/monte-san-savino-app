import { describe, it, expect } from "bun:test";
import { SlidingWindowRateLimiter, clientIp, rateLimiterFromEnv } from "../rateLimiter";

function clock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: (ms: number) => { t += ms; } };
}

describe("SlidingWindowRateLimiter", () => {
  it("allows max hits then blocks with Retry-After", () => {
    const c = clock();
    const l = new SlidingWindowRateLimiter({ max: 3, windowMs: 60_000, baseBackoffMs: 10_000, now: c.now });
    for (let i = 0; i < 3; i++) expect(l.hit("k").allowed).toBe(true);
    const r = l.hit("k");
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.retryAfterSeconds).toBeGreaterThan(0);
  });
  it("keys are independent", () => {
    const c = clock();
    const l = new SlidingWindowRateLimiter({ max: 1, windowMs: 60_000, now: c.now });
    expect(l.hit("a").allowed).toBe(true);
    expect(l.hit("b").allowed).toBe(true);
    expect(l.hit("a").allowed).toBe(false);
  });
  it("recovers once the window has slid past", () => {
    const c = clock();
    const l = new SlidingWindowRateLimiter({ max: 2, windowMs: 60_000, baseBackoffMs: 1_000, now: c.now });
    l.hit("k"); l.hit("k");
    expect(l.hit("k").allowed).toBe(false);
    c.advance(61_000);
    expect(l.hit("k").allowed).toBe(true);
  });
  it("applies a sliding (not fixed) window", () => {
    const c = clock();
    const l = new SlidingWindowRateLimiter({ max: 2, windowMs: 60_000, now: c.now });
    l.hit("k"); c.advance(40_000); l.hit("k"); c.advance(25_000); // first hit expired, second still counts
    expect(l.hit("k").allowed).toBe(true);
    expect(l.hit("k").allowed).toBe(false);
  });
  it("backoff grows on repeated violations", () => {
    const c = clock();
    const l = new SlidingWindowRateLimiter({ max: 1, windowMs: 1_000, baseBackoffMs: 10_000, now: c.now });
    l.hit("k");
    const first = l.hit("k") as any;
    c.advance(first.retryAfterSeconds * 1000 + 1);
    expect(l.hit("k").allowed).toBe(true);
    const second = l.hit("k") as any;
    expect(second.retryAfterSeconds).toBeGreaterThan(first.retryAfterSeconds);
  });
  it("bounds memory", () => {
    const c = clock();
    const l = new SlidingWindowRateLimiter({ max: 1, windowMs: 60_000, maxKeys: 5, now: c.now });
    for (let i = 0; i < 50; i++) l.hit(`k${i}`);
    expect((l as any).entries.size).toBeLessThanOrEqual(5);
  });
});

describe("clientIp / rateLimiterFromEnv", () => {
  it("ignores X-Forwarded-For unless TRUST_PROXY=true", () => {
    const h = { "x-forwarded-for": "1.2.3.4, 5.6.7.8" };
    expect(clientIp(h, "9.9.9.9", {})).toBe("9.9.9.9");
    expect(clientIp(h, "9.9.9.9", { TRUST_PROXY: "true" })).toBe("1.2.3.4");
    expect(clientIp({}, undefined, {})).toBe("unknown");
  });
  it("can be disabled and reads params from env", () => {
    expect(rateLimiterFromEnv({ RATE_LIMIT_ENABLED: "false" })).toBeNull();
    const c = clock();
    const l = rateLimiterFromEnv({ RATE_LIMIT_MAX: "1" }, c.now)!;
    expect(l.hit("k").allowed).toBe(true);
    expect(l.hit("k").allowed).toBe(false);
  });
});
