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
      DO $$
      BEGIN
        IF to_regclass('public.models') IS NULL THEN
          RETURN;
        END IF;

        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'models'
            AND column_name = 'code'
        ) THEN
          ALTER TABLE models ADD COLUMN code integer;
        END IF;

        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'models'
            AND column_name = 'code'
            AND data_type <> 'integer'
        ) THEN
          DROP INDEX IF EXISTS ux_models_code;
          ALTER TABLE models
          ALTER COLUMN code TYPE integer
          USING NULLIF(substring(code::text FROM '([0-9]+)$'), '')::integer;
        END IF;

        UPDATE models
        SET code = NULL
        WHERE code IS NOT NULL
          AND code < 0;

        WITH base AS (
          SELECT COALESCE(MAX(code), 0) AS max_code
          FROM models
        ),
        missing AS (
          SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS rn
          FROM models
          WHERE code IS NULL
        )
        UPDATE models AS m
        SET code = base.max_code + missing.rn
        FROM base, missing
        WHERE m.id = missing.id;

        WITH ranked AS (
          SELECT
            id,
            code,
            ROW_NUMBER() OVER (PARTITION BY code ORDER BY id) AS dup_rn
          FROM models
          WHERE code IS NOT NULL
        ),
        duplicates AS (
          SELECT id, ROW_NUMBER() OVER (ORDER BY code, id) AS rn
          FROM ranked
          WHERE dup_rn > 1
        ),
        base AS (
          SELECT COALESCE(MAX(code), 0) AS max_code
          FROM models
        )
        UPDATE models AS m
        SET code = base.max_code + duplicates.rn
        FROM base, duplicates
        WHERE m.id = duplicates.id;

        CREATE UNIQUE INDEX IF NOT EXISTS ux_models_code
        ON models (code);
      END $$;
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
