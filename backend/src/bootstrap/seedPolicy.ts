/**
 * Demo data (accounts with well-known passwords) is created only when asked for explicitly with
 * SEED_DEMO=true, and never in production. A missing or wrong NODE_ENV alone must not create them.
 */
export function shouldSeedDemo(env: Record<string, string | undefined> = process.env): boolean {
  return env.SEED_DEMO === "true" && env.NODE_ENV !== "production";
}
