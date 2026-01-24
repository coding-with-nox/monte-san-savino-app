import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

const cache = new Map<string, ReturnType<typeof drizzle>>();

export type TenantDbConfig = {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
};

export function getTenantDbConfigFromEnv(env: NodeJS.ProcessEnv = process.env): TenantDbConfig {
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
  if (!cache.has(key)) cache.set(key, drizzle(new Pool(cfg)));
  return cache.get(key)!;
}

export function getTenantDbFromEnv(env: NodeJS.ProcessEnv = process.env) {
  return getTenantDb(getTenantDbConfigFromEnv(env));
}
