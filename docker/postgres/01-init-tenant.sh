#!/usr/bin/env bash
set -euo pipefail

TENANT_DB_NAME="${TENANT_DB_NAME:-tenant_db_1}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-postgres}"
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"

export PGPASSWORD="$POSTGRES_PASSWORD"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres <<SQL
SELECT 'CREATE DATABASE "${TENANT_DB_NAME}"'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${TENANT_DB_NAME}')\gexec
SQL

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$TENANT_DB_NAME" <<'SQL'
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE,
  role text NOT NULL,
  password_hash text NOT NULL,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id uuid PRIMARY KEY,
  first_name text,
  last_name text,
  phone text,
  city text,
  address text,
  emergency_contact text,
  avatar_url text
);

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS emergency_contact_name text;

CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  owner_id uuid NOT NULL
);

CREATE TABLE IF NOT EXISTS team_members (
  team_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_team_user
  ON team_members (team_id, user_id);

CREATE INDEX IF NOT EXISTS ix_team_members_user
  ON team_members (user_id);

CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  status text NOT NULL,
  start_date text,
  end_date text
);

CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY,
  event_id uuid NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'open'
);

ALTER TABLE categories ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open';

CREATE INDEX IF NOT EXISTS ix_categories_event
  ON categories (event_id);

CREATE TABLE IF NOT EXISTS registrations (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  event_id uuid NOT NULL,
  model_id uuid,
  category_id uuid,
  status text NOT NULL DEFAULT 'accepted',
  checked_in boolean NOT NULL DEFAULT false
);

ALTER TABLE registrations ADD COLUMN IF NOT EXISTS model_id uuid;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS category_id uuid;
ALTER TABLE registrations ALTER COLUMN status SET DEFAULT 'accepted';

CREATE UNIQUE INDEX IF NOT EXISTS ux_reg_user_event
  ON registrations (user_id, event_id);

CREATE INDEX IF NOT EXISTS ix_registrations_event
  ON registrations (event_id);

CREATE INDEX IF NOT EXISTS ix_registrations_user
  ON registrations (user_id);

CREATE TABLE IF NOT EXISTS models (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  team_id uuid,
  category_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  code integer,
  image_url text
);

ALTER TABLE models ADD COLUMN IF NOT EXISTS team_id uuid;
ALTER TABLE models ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE models ADD COLUMN IF NOT EXISTS code integer;

DO $$
BEGIN
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
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_models_code
  ON models (code);

CREATE INDEX IF NOT EXISTS ix_models_category
  ON models (category_id);

CREATE INDEX IF NOT EXISTS ix_models_user
  ON models (user_id);

CREATE TABLE IF NOT EXISTS model_images (
  id uuid PRIMARY KEY,
  model_id uuid NOT NULL,
  url text NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_model_images_model
  ON model_images (model_id);

CREATE TABLE IF NOT EXISTS votes (
  id uuid PRIMARY KEY,
  judge_id uuid NOT NULL,
  model_id uuid NOT NULL,
  rank integer NOT NULL,
  created_at timestamp DEFAULT now()
);

ALTER TABLE votes DROP CONSTRAINT IF EXISTS ux_votes_judge_model;
ALTER TABLE votes DROP CONSTRAINT IF EXISTS votes_judge_id_model_id_key;
DROP INDEX IF EXISTS ux_votes_judge_model;

CREATE INDEX IF NOT EXISTS ix_votes_judge_model
  ON votes (judge_id, model_id);

CREATE INDEX IF NOT EXISTS ix_votes_model
  ON votes (model_id);

CREATE INDEX IF NOT EXISTS ix_votes_model_created_at
  ON votes (model_id, created_at DESC);

CREATE TABLE IF NOT EXISTS judge_assignments (
  id uuid PRIMARY KEY,
  event_id uuid NOT NULL,
  judge_id uuid NOT NULL,
  category_id uuid
);

ALTER TABLE judge_assignments ADD COLUMN IF NOT EXISTS category_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS ux_judge_event
  ON judge_assignments (event_id, judge_id);

CREATE INDEX IF NOT EXISTS ix_judge_assignments_event
  ON judge_assignments (event_id);

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY,
  registration_id uuid NOT NULL,
  amount integer NOT NULL,
  status text NOT NULL,
  provider_ref text,
  created_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_payments_registration
  ON payments (registration_id);

CREATE TABLE IF NOT EXISTS sponsors (
  id uuid PRIMARY KEY,
  event_id uuid NOT NULL,
  name text NOT NULL,
  logo_url text,
  website_url text,
  description text,
  tier text NOT NULL DEFAULT 'bronze'
);

CREATE INDEX IF NOT EXISTS ix_sponsors_event
  ON sponsors (event_id);

CREATE TABLE IF NOT EXISTS special_mentions (
  id uuid PRIMARY KEY,
  event_id uuid NOT NULL,
  model_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  awarded_by uuid NOT NULL,
  created_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_special_mentions_event
  ON special_mentions (event_id);

CREATE TABLE IF NOT EXISTS modification_requests (
  id uuid PRIMARY KEY,
  model_id uuid NOT NULL,
  judge_id uuid NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_mod_requests_model
  ON modification_requests (model_id);

CREATE INDEX IF NOT EXISTS ix_mod_requests_judge
  ON modification_requests (judge_id);

CREATE TABLE IF NOT EXISTS settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamp DEFAULT now()
);
SQL
