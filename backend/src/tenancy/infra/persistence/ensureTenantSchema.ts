import { Pool } from "pg";
import { getTenantDbConfigFromEnv } from "../tenantDbFactory";
import { logger } from "../../../shared/infra/logger/logger";

const REGISTRATIONS_UNIQUE_INDEX = "ux_registrations_user_event_model";
const NIL_UUID = "00000000-0000-0000-0000-000000000000";

/**
 * Creates the uniqueness guard on registrations (user, event, model-or-nil) ONLY when the table has
 * no duplicates; otherwise it logs a warning and leaves dedup to the enrollment code
 * (advisory lock + conditional insert). Returns what happened, for tests/observability.
 */
export async function ensureRegistrationsUniqueIndex(
  pool: { query: (sql: string) => Promise<{ rows: any[] }> },
  log: { warn: (obj: any, msg?: string) => void; info: (obj: any, msg?: string) => void } = logger
): Promise<"skipped-no-table" | "exists" | "created" | "duplicates"> {
  const t = await pool.query(`SELECT to_regclass('public.registrations') AS t, to_regclass('public.${REGISTRATIONS_UNIQUE_INDEX}') AS i`);
  if (!t.rows[0]?.t) return "skipped-no-table";
  if (t.rows[0]?.i) return "exists";
  const dup = await pool.query(`
    SELECT COALESCE(SUM(c - 1), 0)::int AS duplicate_rows
    FROM (
      SELECT COUNT(*) AS c
      FROM registrations
      GROUP BY user_id, event_id, COALESCE(model_id, '${NIL_UUID}'::uuid)
      HAVING COUNT(*) > 1
    ) d
  `);
  const duplicateRows = Number(dup.rows[0]?.duplicate_rows ?? 0);
  if (duplicateRows > 0) {
    log.warn(
      { duplicateRows, index: REGISTRATIONS_UNIQUE_INDEX },
      `registrations contains ${duplicateRows} duplicate row(s) (same user, event, model): unique index NOT created. Remove the duplicates manually and restart to create it; meanwhile enrollment deduplicates in code.`
    );
    return "duplicates";
  }
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS ${REGISTRATIONS_UNIQUE_INDEX}
    ON registrations (user_id, event_id, COALESCE(model_id, '${NIL_UUID}'::uuid))
  `);
  log.info({ index: REGISTRATIONS_UNIQUE_INDEX }, "registrations unique index created");
  return "created";
}

/**
 * Constant key for the schema-maintenance advisory lock. Arbitrary but fixed (ASCII "MSSA" + "SCHM"),
 * shared by every replica so only one at a time runs the startup maintenance (repair UPDATEs, DDL).
 */
export const SCHEMA_MAINTENANCE_LOCK_KEY = "5062000001234567";

/** Secondary (non-unique) indexes for FK-like lookup columns. Names match schema.ts. */
export const PERFORMANCE_INDEXES: ReadonlyArray<{ name: string; table: string; column: string }> = [
  { name: "ix_registrations_user_id", table: "registrations", column: "user_id" },
  { name: "ix_registrations_event_id", table: "registrations", column: "event_id" },
  { name: "ix_registrations_model_id", table: "registrations", column: "model_id" },
  { name: "ix_models_category_id", table: "models", column: "category_id" },
  { name: "ix_models_user_id", table: "models", column: "user_id" },
  { name: "ix_categories_event_id", table: "categories", column: "event_id" },
  { name: "ix_model_images_model_id", table: "model_images", column: "model_id" },
  { name: "ix_model_team_members_model_id", table: "model_team_members", column: "model_id" },
  { name: "ix_team_mates_team_id", table: "team_mates", column: "team_id" },
  { name: "ix_special_mentions_event_id", table: "special_mentions", column: "event_id" },
  { name: "ix_payments_registration_id", table: "payments", column: "registration_id" }
];

/** Idempotent; skips tables that do not exist (guarded with to_regclass). */
export function buildPerformanceIndexStatements(): string[] {
  return PERFORMANCE_INDEXES.map(
    ({ name, table, column }) => `
      DO $$
      BEGIN
        IF to_regclass('public.${table}') IS NOT NULL THEN
          CREATE INDEX IF NOT EXISTS ${name} ON ${table} (${column});
        END IF;
      END $$;
    `
  );
}

export async function ensureTenantSchema() {
  const cfg = getTenantDbConfigFromEnv();
  // Single dedicated connection: advisory locks are per-session, so lock/maintenance/unlock must share one client.
  const pool = new Pool({ ...cfg, max: 1 });
  let locked = false;
  try {
    await pool.query("SELECT pg_advisory_lock($1::bigint)", [SCHEMA_MAINTENANCE_LOCK_KEY]);
    locked = true;
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

    // Deterministic "latest vote": monotonic tiebreaker. Votes stay append-only (no unique constraint).
    // ADD COLUMN ... bigserial on an existing table rewrites it once (fills existing rows from the
    // sequence); IF NOT EXISTS makes it idempotent and safe if several instances start concurrently.
    // Guarded by an explicit existence check (like categories.seq_id) so no orphan sequence is created.
    await pool.query(`
      DO $$
      BEGIN
        IF to_regclass('public.votes') IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'votes' AND column_name = 'seq'
        ) THEN
          ALTER TABLE votes ADD COLUMN IF NOT EXISTS seq bigserial;
        END IF;
      END $$;
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
    await pool.query(`
      ALTER TABLE IF EXISTS models
        ADD COLUMN IF NOT EXISTS notes text,
        ADD COLUMN IF NOT EXISTS internal_notes text;
    `);
    await pool.query(`
      ALTER TABLE IF EXISTS user_profiles
        ADD COLUMN IF NOT EXISTS instagram text,
        ADD COLUMN IF NOT EXISTS facebook text,
        ADD COLUMN IF NOT EXISTS website text;
    `);
    await pool.query(`
      ALTER TABLE IF EXISTS user_profiles
        ADD COLUMN IF NOT EXISTS patreon text,
        ADD COLUMN IF NOT EXISTS pinterest text,
        ADD COLUMN IF NOT EXISTS tiktok text,
        ADD COLUMN IF NOT EXISTS country text,
        ADD COLUMN IF NOT EXISTS public_profile boolean NOT NULL DEFAULT false;
    `);
    await pool.query(`
      ALTER TABLE IF EXISTS registrations
        ADD COLUMN IF NOT EXISTS absent boolean NOT NULL DEFAULT false;
    `);
    await pool.query(`
      ALTER TABLE IF EXISTS levels
        ADD COLUMN IF NOT EXISTS free_to_enter boolean NOT NULL DEFAULT false;
    `);
    await pool.query(`
      ALTER TABLE IF EXISTS categories
        ADD COLUMN IF NOT EXISTS class_number text,
        ADD COLUMN IF NOT EXISTS level_id uuid,
        ADD COLUMN IF NOT EXISTS class_group text,
        ADD COLUMN IF NOT EXISTS presentation_order integer,
        ADD COLUMN IF NOT EXISTS out_of_competition boolean NOT NULL DEFAULT false;
    `);
    // Backfill display_number from code for models that have code but no display_number
    await pool.query(`
      UPDATE models SET display_number = code
      WHERE display_number IS NULL AND code IS NOT NULL;
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

    // idempotent backfills: columns added after initial table creation
    await pool.query(`ALTER TABLE teams ADD COLUMN IF NOT EXISTS display_number text`);
    await pool.query(`ALTER TABLE teams ADD COLUMN IF NOT EXISTS category_id uuid`);
    await pool.query(`ALTER TABLE teams ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now()`);
    await pool.query(`ALTER TABLE teams ADD COLUMN IF NOT EXISTS user_id uuid`);
    // owner_id = old name for user_id; drop NOT NULL so inserts don't fail
    await pool.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_catalog.pg_attribute a
          JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
          WHERE c.relname = 'teams' AND a.attname = 'owner_id'
            AND a.attnum > 0 AND NOT a.attisdropped AND a.attnotnull
        ) THEN
          ALTER TABLE teams ALTER COLUMN owner_id DROP NOT NULL;
        END IF;
      END $$
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

    await ensureRegistrationsUniqueIndex(pool);

    for (const stmt of buildPerformanceIndexStatements()) await pool.query(stmt);
  } finally {
    try {
      if (locked) await pool.query("SELECT pg_advisory_unlock($1::bigint)", [SCHEMA_MAINTENANCE_LOCK_KEY]);
    } finally {
      await pool.end();
    }
  }
}
