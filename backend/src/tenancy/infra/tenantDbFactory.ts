import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { assertProductionSecrets } from "../../shared/infra/config/productionEnv";

const cache = new Map<string, ReturnType<typeof drizzle>>();

export type TenantDbConfig = {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
};

export type PoolTuning = { max: number; idleTimeoutMillis: number; connectionTimeoutMillis: number };

function positiveInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

/** Pool sizing from env: PG_POOL_MAX (10), PG_POOL_IDLE_TIMEOUT_MS (30000), PG_POOL_CONNECTION_TIMEOUT_MS (10000). Invalid values fall back to defaults. */
export function getPoolTuningFromEnv(env: NodeJS.ProcessEnv = process.env): PoolTuning {
  return {
    max: positiveInt(env.PG_POOL_MAX, 10),
    idleTimeoutMillis: positiveInt(env.PG_POOL_IDLE_TIMEOUT_MS, 30_000),
    connectionTimeoutMillis: positiveInt(env.PG_POOL_CONNECTION_TIMEOUT_MS, 10_000)
  };
}

export function getTenantDbConfigFromEnv(env: NodeJS.ProcessEnv = process.env): TenantDbConfig {
  // Dev-only fallbacks below; production must provide a non-default PG_PASSWORD.
  assertProductionSecrets(env, ["PG_PASSWORD"]);
  return {
    host: env.PG_HOST ?? "localhost",
    port: Number(env.PG_PORT ?? "5432"),
    database: env.PG_DB ?? "tenant_db_1",
    user: env.PG_USER ?? "postgres",
    password: env.PG_PASSWORD ?? "postgres"
  };
}

export function getTenantDb(cfg: TenantDbConfig) {
  const key = `${cfg.host}:${cfg.port}/${cfg.database}/${cfg.user}`;
  if (!cache.has(key)) cache.set(key, drizzle(new Pool({ ...cfg, ...getPoolTuningFromEnv() })));
  return cache.get(key)!;
}

export function getTenantDbFromEnv(env: NodeJS.ProcessEnv = process.env) {
  return getTenantDb(getTenantDbConfigFromEnv(env));
}
