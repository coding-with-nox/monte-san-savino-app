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
    await pool.query(`
      ALTER TABLE IF EXISTS models
      ADD COLUMN IF NOT EXISTS description text;
    `);
    await pool.query(`
      ALTER TABLE IF EXISTS models
      ADD COLUMN IF NOT EXISTS code text;
    `);
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS ux_models_code
      ON models (code);
    `);
    await pool.query(`
      ALTER TABLE IF EXISTS registrations
      ALTER COLUMN status SET DEFAULT 'accepted';
    `);
    await pool.query(`
      ALTER TABLE IF EXISTS votes
      DROP CONSTRAINT IF EXISTS ux_votes_judge_model;
    `);
    await pool.query(`
      ALTER TABLE IF EXISTS votes
      DROP CONSTRAINT IF EXISTS votes_judge_id_model_id_key;
    `);
    await pool.query(`
      DROP INDEX IF EXISTS ux_votes_judge_model;
    `);
  } finally {
    await pool.end();
  }
}
