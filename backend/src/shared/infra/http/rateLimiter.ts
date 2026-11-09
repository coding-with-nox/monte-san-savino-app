/**
 * In-memory sliding-window rate limiter with exponential backoff.
 *
 * LIMITATION: state lives in the memory of this process only. It is NOT shared
 * between replicas (each pod/instance counts separately, so the effective limit is
 * max * replicas) and it is lost on restart. For a hard global limit use an edge
 * rate limiter (ingress / reverse proxy) or a shared store.
 */
export type RateLimiterOptions = {
  max: number;
  windowMs: number;
  /** First lock-out duration after exceeding the limit; doubles at every further violation. */
  baseBackoffMs?: number;
  maxBackoffMs?: number;
  maxKeys?: number;
  now?: () => number;
};

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterSeconds: number };

type Entry = { hits: number[]; violations: number; blockedUntil: number };

export class SlidingWindowRateLimiter {
  private readonly entries = new Map<string, Entry>();
  private readonly baseBackoffMs: number;
  private readonly maxBackoffMs: number;
  private readonly maxKeys: number;
  private readonly now: () => number;

  constructor(private readonly opts: RateLimiterOptions) {
    this.baseBackoffMs = opts.baseBackoffMs ?? 30_000;
    this.maxBackoffMs = opts.maxBackoffMs ?? 60 * 60_000;
    this.maxKeys = opts.maxKeys ?? 10_000;
    this.now = opts.now ?? Date.now;
  }

  /** Registers an attempt for `key` and tells whether it may proceed. */
  hit(key: string): RateLimitResult {
    const now = this.now();
    this.sweepIfNeeded(now);
    let e = this.entries.get(key);
    if (!e) {
      e = { hits: [], violations: 0, blockedUntil: 0 };
      this.entries.set(key, e);
    }
    if (e.blockedUntil > now) return { allowed: false, retryAfterSeconds: Math.ceil((e.blockedUntil - now) / 1000) };
    const windowStart = now - this.opts.windowMs;
    e.hits = e.hits.filter((t) => t > windowStart);
    if (e.hits.length === 0 && e.blockedUntil <= windowStart) e.violations = 0;
    if (e.hits.length >= this.opts.max) {
      const backoff = Math.min(this.baseBackoffMs * 2 ** e.violations, this.maxBackoffMs);
      e.violations += 1;
      // Never unblock before the oldest hit leaves the window.
      const windowFree = e.hits[0]! + this.opts.windowMs;
      e.blockedUntil = Math.max(now + backoff, Math.min(windowFree, now + this.maxBackoffMs));
      return { allowed: false, retryAfterSeconds: Math.ceil((e.blockedUntil - now) / 1000) };
    }
    e.hits.push(now);
    return { allowed: true };
  }

  private sweepIfNeeded(now: number) {
    if (this.entries.size < this.maxKeys) return;
    const windowStart = now - this.opts.windowMs;
    for (const [k, e] of this.entries) {
      if (e.blockedUntil <= now && (e.hits.length === 0 || e.hits[e.hits.length - 1]! <= windowStart)) this.entries.delete(k);
    }
    // Still full: drop oldest insertions to bound memory.
    while (this.entries.size >= this.maxKeys) {
      const first = this.entries.keys().next().value;
      if (first === undefined) break;
      this.entries.delete(first);
    }
  }
}

function positiveNumber(v: string | undefined, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Client IP: X-Forwarded-For (first hop) only when TRUST_PROXY=true, else the socket address. */
export function clientIp(headers: Record<string, string | undefined>, socketIp: string | undefined, env: NodeJS.ProcessEnv = process.env): string {
  if (env.TRUST_PROXY === "true") {
    const xff = headers["x-forwarded-for"]?.split(",")[0]?.trim();
    if (xff) return xff;
  }
  return socketIp ?? "unknown";
}

export function rateLimiterFromEnv(env: NodeJS.ProcessEnv = process.env, now?: () => number): SlidingWindowRateLimiter | null {
  if (env.RATE_LIMIT_ENABLED === "false") return null;
  return new SlidingWindowRateLimiter({
    max: positiveNumber(env.RATE_LIMIT_MAX, 10),
    windowMs: positiveNumber(env.RATE_LIMIT_WINDOW_SECONDS, 15 * 60) * 1000,
    baseBackoffMs: positiveNumber(env.RATE_LIMIT_BACKOFF_SECONDS, 30) * 1000,
    now
  });
}
