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
  name text NOT NULL
);

CREATE TABLE IF NOT EXISTS registrations (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  event_id uuid NOT NULL,
  model_id uuid,
  category_id uuid,
  status text NOT NULL,
  checked_in boolean NOT NULL DEFAULT false
);

ALTER TABLE registrations ADD COLUMN IF NOT EXISTS model_id uuid;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS category_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS ux_reg_user_event
  ON registrations (user_id, event_id);

CREATE TABLE IF NOT EXISTS models (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  team_id uuid,
  category_id uuid NOT NULL,
  name text NOT NULL,
  image_url text
);

ALTER TABLE models ADD COLUMN IF NOT EXISTS team_id uuid;

CREATE TABLE IF NOT EXISTS model_images (
  id uuid PRIMARY KEY,
  model_id uuid NOT NULL,
  url text NOT NULL
);

CREATE TABLE IF NOT EXISTS votes (
  id uuid PRIMARY KEY,
  judge_id uuid NOT NULL,
  model_id uuid NOT NULL,
  rank integer NOT NULL,
  created_at timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_votes_judge_model
  ON votes (judge_id, model_id);

CREATE TABLE IF NOT EXISTS judge_assignments (
  id uuid PRIMARY KEY,
  event_id uuid NOT NULL,
  judge_id uuid NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_judge_event
  ON judge_assignments (event_id, judge_id);

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY,
  registration_id uuid NOT NULL,
  amount integer NOT NULL,
  status text NOT NULL,
  provider_ref text,
  created_at timestamp DEFAULT now()
);
SQL
