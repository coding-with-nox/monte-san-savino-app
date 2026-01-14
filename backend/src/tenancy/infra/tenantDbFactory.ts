import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

const cache = new Map<string, ReturnType<typeof drizzle>>();
export function getTenantDb(cfg: { host: string; port: number; database: string; user: string; password: string }) {
  const key = `${cfg.host}:${cfg.port}/${cfg.database}/${cfg.user}`;
  if (!cache.has(key)) cache.set(key, drizzle(new Pool(cfg)));
  return cache.get(key)!;
}
