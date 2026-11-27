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
    // Still full: drop the oldest keys that are not locked out, so a flood of new keys cannot
    // erase an active lock-out (SEC-04). Locked keys go last, only to bound memory.
    for (const [k, e] of this.entries) {
      if (this.entries.size < this.maxKeys) break;
      if (e.blockedUntil <= now) this.entries.delete(k);
    }
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

/**
 * Client IP. With TRUST_PROXY=true (the backend is reachable only through our proxy) it is the last
 * X-Forwarded-For entry, the one written by that proxy: the earlier entries come from the client and
 * can be forged (SEC-17). Otherwise the socket address.
 */
export function clientIp(headers: Record<string, string | undefined>, socketIp: string | undefined, env: NodeJS.ProcessEnv = process.env): string {
  if (env.TRUST_PROXY === "true") {
    const xff = headers["x-forwarded-for"]?.split(",").map((h) => h.trim()).filter(Boolean).pop();
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

/** Limit per client IP on all the endpoints of a guard, whatever the key (password spraying, SEC-04). */
export function ipRateLimiterFromEnv(env: NodeJS.ProcessEnv = process.env, now?: () => number): SlidingWindowRateLimiter | null {
  if (env.RATE_LIMIT_ENABLED === "false") return null;
  return new SlidingWindowRateLimiter({
    max: positiveNumber(env.RATE_LIMIT_IP_MAX, 50),
    windowMs: positiveNumber(env.RATE_LIMIT_WINDOW_SECONDS, 15 * 60) * 1000,
    baseBackoffMs: positiveNumber(env.RATE_LIMIT_BACKOFF_SECONDS, 30) * 1000,
    now
  });
}

/**
 * beforeHandle guard factory, two buckets per guard: client IP alone (all keys together) and client
 * IP plus `keyOf(body)`. Keying by IP too means an attacker cannot lock an account out from their own
 * address. The limiters are built on first use (env read then); `reset` rebuilds them (tests).
 */
export function createRateLimitGuard(keyOf: (body: any) => string, limits: { max?: number; ipMax?: number } = {}) {
  let limiter: SlidingWindowRateLimiter | null | undefined;
  let ipLimiter: SlidingWindowRateLimiter | null | undefined;
  let clock: (() => number) | undefined;
  const guard = ({ body, request, server, set }: any) => {
    // Fixed limits of this guard win over the env defaults (still off with RATE_LIMIT_ENABLED=false).
    const env = { ...process.env, ...(limits.max ? { RATE_LIMIT_MAX: String(limits.max) } : {}), ...(limits.ipMax ? { RATE_LIMIT_IP_MAX: String(limits.ipMax) } : {}) };
    if (limiter === undefined) limiter = rateLimiterFromEnv(env, clock);
    if (ipLimiter === undefined) ipLimiter = ipRateLimiterFromEnv(env, clock);
    if (!limiter || !ipLimiter) return;
    const headers = { "x-forwarded-for": request.headers.get("x-forwarded-for") ?? undefined };
    const ip = clientIp(headers, server?.requestIP?.(request)?.address);
    const perIp = ipLimiter.hit(ip);
    const r = perIp.allowed ? limiter.hit(`${ip}|${keyOf(body)}`) : perIp;
    if (!r.allowed) {
      set.status = 429;
      set.headers["retry-after"] = String(r.retryAfterSeconds);
      return { error: "Too many attempts, try again later" };
    }
  };
  guard.reset = (now?: () => number) => { limiter = undefined; ipLimiter = undefined; clock = now; };
  return guard;
}
