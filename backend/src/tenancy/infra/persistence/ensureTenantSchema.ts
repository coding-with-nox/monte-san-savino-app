import { Pool } from "pg";
import { getTenantDbConfigFromEnv } from "../tenantDbFactory";

export async function ensureTenantSchema() {
  const cfg = getTenantDbConfigFromEnv();
  const pool = new Pool(cfg);
  try {
    await pool.query(`
      ALTER TABLE IF EXISTS judge_assignments
      ADD COLUMN IF NOT EXISTS category_id uuid;
    `);
  } finally {
    await pool.end();
  }
}
