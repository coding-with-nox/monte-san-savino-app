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

    // Remove old team tables
    await pool.query(`DROP TABLE IF EXISTS team_members CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS team_roles CASCADE;`);

    // Add levels table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS levels (
        id uuid PRIMARY KEY,
        name text NOT NULL,
        sort_order integer
      );
    `);

    // Add member_roles table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS member_roles (
        id uuid PRIMARY KEY,
        name text NOT NULL
      );
    `);

    // Add model_team_members table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS model_team_members (
        id uuid PRIMARY KEY,
        model_id uuid NOT NULL,
        name text NOT NULL,
        surname text NOT NULL,
        role text NOT NULL
      );
    `);

    // Add seqId to categories
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'categories'
            AND column_name = 'seq_id'
        ) THEN
          ALTER TABLE categories ADD COLUMN seq_id serial NOT NULL;
        END IF;
      END $$;
    `);

    // Add levelId, displayNumber, isTeam to models; remove teamId
    await pool.query(`
      ALTER TABLE IF EXISTS models
        ADD COLUMN IF NOT EXISTS level_id uuid,
        ADD COLUMN IF NOT EXISTS display_number integer,
        ADD COLUMN IF NOT EXISTS is_team boolean NOT NULL DEFAULT false;
    `);
    // Add email to model_team_members
    await pool.query(`
      ALTER TABLE model_team_members ADD COLUMN IF NOT EXISTS email text;
    `);

    // Remove stale role names and insert correct ones idempotently (atomic)
    await pool.query('BEGIN');
    try {
      await pool.query(`
        DELETE FROM member_roles WHERE name IN ('Pilota', 'Co-pilota', 'Meccanico', 'Navigatore');
      `);
      await pool.query(`
        INSERT INTO member_roles (id, name)
        SELECT gen_random_uuid(), name
        FROM (VALUES ('Scultore'), ('Pittore'), ('Concept Artist'), ('Art Director')) AS t(name)
        WHERE NOT EXISTS (SELECT 1 FROM member_roles WHERE member_roles.name = t.name);
      `);
      await pool.query('COMMIT');
    } catch (err) {
      await pool.query('ROLLBACK');
      throw err;
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS teams (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL,
        name text NOT NULL,
        display_number text NOT NULL,
        category_id uuid NOT NULL,
        created_at timestamptz DEFAULT now()
      )
    `);

    // idempotent backfill: table may have been created before display_number was added
    await pool.query(`
      ALTER TABLE teams ADD COLUMN IF NOT EXISTS display_number text
    `);

    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS ux_teams_display_number ON teams (display_number)
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS team_mates (
        id uuid PRIMARY KEY,
        team_id uuid NOT NULL,
        name text NOT NULL,
        surname text NOT NULL,
        role text NOT NULL,
        email text
      )
    `);

    await pool.query(`
      ALTER TABLE models ADD COLUMN IF NOT EXISTS team_id uuid
    `);

    // Add award_brackets table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS award_brackets (
        id uuid PRIMARY KEY,
        event_id uuid NOT NULL,
        medal_label text NOT NULL,
        medal_rank integer NOT NULL,
        low_limit integer NOT NULL,
        high_limit integer NOT NULL,
        created_at timestamptz DEFAULT now()
      )
    `);

    // Add judge_completions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS judge_completions (
        id uuid PRIMARY KEY,
        judge_id uuid NOT NULL,
        category_id uuid NOT NULL,
        completed_at timestamptz DEFAULT now()
      )
    `);
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS ux_judge_completions ON judge_completions (judge_id, category_id)
    `);

    // Add awards table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS awards (
        id uuid PRIMARY KEY,
        category_id uuid NOT NULL,
        model_id uuid NOT NULL,
        total_score integer NOT NULL,
        medal_label text NOT NULL,
        medal_rank integer NOT NULL,
        source text NOT NULL DEFAULT 'aggregate',
        frozen_at timestamptz DEFAULT now()
      )
    `);
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS ux_awards_category_model ON awards (category_id, model_id)
    `);
  } finally {
    await pool.end();
  }
}
