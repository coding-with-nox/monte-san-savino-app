-- Create tenant database if it does not already exist.
SELECT 'CREATE DATABASE tenant_db_1'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'tenant_db_1')\gexec

\connect tenant_db_1

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE,
  role text NOT NULL,
  password_hash text NOT NULL,
  is_active boolean NOT NULL DEFAULT true
);

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
  status text NOT NULL,
  checked_in boolean NOT NULL DEFAULT false
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_reg_user_event
  ON registrations (user_id, event_id);

CREATE TABLE IF NOT EXISTS models (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  category_id uuid NOT NULL,
  name text NOT NULL,
  image_url text
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
