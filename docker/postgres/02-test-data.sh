#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# 02-test-data.sh — Seed dati di test per monte-san-savino-app
#
# Copre tutte le casistiche funzionali:
#   • utenti (admin / manager / judge / staff / user / inattivo)
#   • eventi (aperto, chiuso/passato, futuro/draft)
#   • campagne evento (aperta, chiusa)
#   • categorie (aperta, chiusa)
#   • team + ruoli team
#   • modelli (singolo, team, varie categorie)
#   • iscrizioni (con/senza modello, checked-in, non checked-in)
#   • assegnazioni giudici
#   • voti con storico (più voti sullo stesso modello)
#   • richieste di modifica (pending / resolved / rejected)
#   • menzioni speciali
#   • sponsor
#   • settings export/tema
#
# Password di tutti gli utenti: Password1!
# ---------------------------------------------------------------------------
set -euo pipefail

TENANT_DB_NAME="${TENANT_DB_NAME:-tenant_db_1}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-postgres}"
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"

export PGPASSWORD="$POSTGRES_PASSWORD"

FORCE_OVERWRITE="${FORCE_OVERWRITE:-false}"

if [ "$FORCE_OVERWRITE" = "true" ]; then
  echo "⚠  FORCE_OVERWRITE=true — truncate di tutte le tabelle di test..."
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$TENANT_DB_NAME" <<'TRUNCATE_SQL'
TRUNCATE TABLE
  settings,
  special_mentions,
  sponsors,
  modification_requests,
  votes,
  judge_assignments,
  registrations,
  models,
  team_members,
  teams,
  team_roles,
  categories,
  event_campaigns,
  events,
  user_profiles,
  users
CASCADE;
TRUNCATE_SQL
fi

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$TENANT_DB_NAME" <<'SQL'

-- ===========================================================================
-- pgcrypto per hashing bcrypt (compatibile con Bun.password.verify)
-- ===========================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Precomputed hash di "Password1!" con bcrypt cost=10
-- (generato via pgcrypto, verificabile da Bun.password.verify)
DO $$
DECLARE
  pwd_hash text := crypt('Password1!', gen_salt('bf', 10));
BEGIN

-- ===========================================================================
-- UTENTI
-- ===========================================================================
-- admin@test.com — ruolo admin
INSERT INTO users (id, email, role, password_hash, is_active)
VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 'admin@test.com', 'admin', pwd_hash, true)
ON CONFLICT (email) DO NOTHING;

INSERT INTO user_profiles (user_id, first_name, last_name, phone, city, address, emergency_contact, emergency_contact_name)
VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 'Admin', 'Sistema', '+39 0577 000001', 'Monte San Savino', 'Via Roma 1', '+39 333 0000001', 'Contatto Admin')
ON CONFLICT (user_id) DO NOTHING;

-- manager@test.com — ruolo manager
INSERT INTO users (id, email, role, password_hash, is_active)
VALUES ('aaaaaaaa-0000-0000-0000-000000000002', 'manager@test.com', 'manager', pwd_hash, true)
ON CONFLICT (email) DO NOTHING;

INSERT INTO user_profiles (user_id, first_name, last_name, phone, city, address, emergency_contact, emergency_contact_name)
VALUES ('aaaaaaaa-0000-0000-0000-000000000002', 'Marco', 'Direttore', '+39 0577 000002', 'Arezzo', 'Via Mazzini 10', '+39 333 0000002', 'Contatto Marco')
ON CONFLICT (user_id) DO NOTHING;

-- judge1@test.com — ruolo judge
INSERT INTO users (id, email, role, password_hash, is_active)
VALUES ('aaaaaaaa-0000-0000-0000-000000000003', 'judge1@test.com', 'judge', pwd_hash, true)
ON CONFLICT (email) DO NOTHING;

INSERT INTO user_profiles (user_id, first_name, last_name, phone, city, address, emergency_contact, emergency_contact_name)
VALUES ('aaaaaaaa-0000-0000-0000-000000000003', 'Giulia', 'Giudice', '+39 0577 000003', 'Siena', 'Via Tribunale 3', '+39 333 0000003', 'Contatto Giulia')
ON CONFLICT (user_id) DO NOTHING;

-- judge2@test.com — ruolo judge
INSERT INTO users (id, email, role, password_hash, is_active)
VALUES ('aaaaaaaa-0000-0000-0000-000000000004', 'judge2@test.com', 'judge', pwd_hash, true)
ON CONFLICT (email) DO NOTHING;

INSERT INTO user_profiles (user_id, first_name, last_name, phone, city, address, emergency_contact, emergency_contact_name)
VALUES ('aaaaaaaa-0000-0000-0000-000000000004', 'Roberto', 'Arbitro', '+39 0577 000004', 'Firenze', 'Via Giudici 7', '+39 333 0000004', 'Contatto Roberto')
ON CONFLICT (user_id) DO NOTHING;

-- staff@test.com — ruolo staff (check-in)
INSERT INTO users (id, email, role, password_hash, is_active)
VALUES ('aaaaaaaa-0000-0000-0000-000000000005', 'staff@test.com', 'staff', pwd_hash, true)
ON CONFLICT (email) DO NOTHING;

INSERT INTO user_profiles (user_id, first_name, last_name, phone, city, address, emergency_contact, emergency_contact_name)
VALUES ('aaaaaaaa-0000-0000-0000-000000000005', 'Sara', 'Accoglienza', '+39 0577 000005', 'Monte San Savino', 'Via Staff 5', '+39 333 0000005', 'Contatto Sara')
ON CONFLICT (user_id) DO NOTHING;

-- user1@test.com — utente normale, profilo completo, modelli iscritti, check-in
INSERT INTO users (id, email, role, password_hash, is_active)
VALUES ('aaaaaaaa-0000-0000-0000-000000000006', 'user1@test.com', 'user', pwd_hash, true)
ON CONFLICT (email) DO NOTHING;

INSERT INTO user_profiles (user_id, first_name, last_name, phone, city, address, emergency_contact, emergency_contact_name)
VALUES ('aaaaaaaa-0000-0000-0000-000000000006', 'Mario', 'Rossi', '+39 335 100001', 'Roma', 'Via dei Modelli 12', '+39 335 100099', 'Maria Rossi')
ON CONFLICT (user_id) DO NOTHING;

-- user2@test.com — utente normale, fa parte di un team
INSERT INTO users (id, email, role, password_hash, is_active)
VALUES ('aaaaaaaa-0000-0000-0000-000000000007', 'user2@test.com', 'user', pwd_hash, true)
ON CONFLICT (email) DO NOTHING;

INSERT INTO user_profiles (user_id, first_name, last_name, phone, city, address, emergency_contact, emergency_contact_name)
VALUES ('aaaaaaaa-0000-0000-0000-000000000007', 'Luigi', 'Bianchi', '+39 335 100002', 'Milano', 'Via Scala 8', '+39 335 100098', 'Anna Bianchi')
ON CONFLICT (user_id) DO NOTHING;

-- user3@test.com — partecipante evento passato, check-in effettuato
INSERT INTO users (id, email, role, password_hash, is_active)
VALUES ('aaaaaaaa-0000-0000-0000-000000000008', 'user3@test.com', 'user', pwd_hash, true)
ON CONFLICT (email) DO NOTHING;

INSERT INTO user_profiles (user_id, first_name, last_name, phone, city, address, emergency_contact, emergency_contact_name)
VALUES ('aaaaaaaa-0000-0000-0000-000000000008', 'Anna', 'Verdi', '+39 335 100003', 'Napoli', 'Via Vesuvio 22', '+39 335 100097', 'Giorgio Verdi')
ON CONFLICT (user_id) DO NOTHING;

-- user4@test.com — utente DISATTIVATO (is_active=false)
INSERT INTO users (id, email, role, password_hash, is_active)
VALUES ('aaaaaaaa-0000-0000-0000-000000000009', 'user4@test.com', 'user', pwd_hash, false)
ON CONFLICT (email) DO NOTHING;

INSERT INTO user_profiles (user_id, first_name, last_name, phone, city, address, emergency_contact, emergency_contact_name)
VALUES ('aaaaaaaa-0000-0000-0000-000000000009', 'Carlo', 'Neri', '+39 335 100004', 'Torino', 'Via Buia 1', '+39 335 100096', 'Luisa Neri')
ON CONFLICT (user_id) DO NOTHING;

-- user5@test.com — utente senza profilo (solo iscrizione senza modello)
INSERT INTO users (id, email, role, password_hash, is_active)
VALUES ('aaaaaaaa-0000-0000-0000-000000000010', 'user5@test.com', 'user', pwd_hash, true)
ON CONFLICT (email) DO NOTHING;
-- Nessun user_profiles intenzionalmente

END $$;

-- ===========================================================================
-- EVENTI
-- ===========================================================================
-- Evento attivo / iscrizioni aperte
INSERT INTO events (id, name, status, start_date, end_date)
VALUES ('eeeeeeee-0000-0000-0000-000000000001', 'MSS Open 2026', 'open', '2026-04-15', '2026-04-17')
ON CONFLICT (id) DO NOTHING;

-- Evento concluso (passato)
INSERT INTO events (id, name, status, start_date, end_date)
VALUES ('eeeeeeee-0000-0000-0000-000000000002', 'MSS Open 2025', 'closed', '2025-04-20', '2025-04-22')
ON CONFLICT (id) DO NOTHING;

-- Evento futuro / draft non ancora aperto
INSERT INTO events (id, name, status, start_date, end_date)
VALUES ('eeeeeeee-0000-0000-0000-000000000003', 'MSS Open 2027', 'draft', '2027-04-19', '2027-04-21')
ON CONFLICT (id) DO NOTHING;

-- ===========================================================================
-- CAMPAGNE EVENTO
-- campagna con iscrizioni aperte (date future)
-- campagna con iscrizioni chiuse (date passate)
-- ===========================================================================
INSERT INTO event_campaigns (id, event_id, name, enrollment_open_date, enrollment_close_date)
VALUES
  -- MSS 2026: turno A iscrizioni aperte
  ('cccccccc-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000001',
   'Turno A – Iscrizioni Aperte', '2026-01-01', '2026-04-01'),
  -- MSS 2026: turno B iscrizioni chiuse (date già passate)
  ('cccccccc-0000-0000-0000-000000000002', 'eeeeeeee-0000-0000-0000-000000000001',
   'Turno B – Iscrizioni Chiuse', '2025-09-01', '2025-12-31'),
  -- MSS 2025: campagna storica chiusa
  ('cccccccc-0000-0000-0000-000000000003', 'eeeeeeee-0000-0000-0000-000000000002',
   'Unica Campagna 2025', '2024-09-01', '2025-03-31')
ON CONFLICT (id) DO NOTHING;

-- ===========================================================================
-- CATEGORIE
-- ===========================================================================
-- Evento 2026 – categorie aperte e una chiusa
INSERT INTO categories (id, event_id, name, status)
VALUES
  ('cccccccc-1111-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000001', 'Aerei 1:72',  'open'),
  ('cccccccc-1111-0000-0000-000000000002', 'eeeeeeee-0000-0000-0000-000000000001', 'Navi',        'open'),
  ('cccccccc-1111-0000-0000-000000000003', 'eeeeeeee-0000-0000-0000-000000000001', 'Armature',    'closed'),
  ('cccccccc-1111-0000-0000-000000000004', 'eeeeeeee-0000-0000-0000-000000000001', 'Veicoli',     'open')
ON CONFLICT (id) DO NOTHING;

-- Evento 2025 – categorie chiuse (evento concluso)
INSERT INTO categories (id, event_id, name, status)
VALUES
  ('cccccccc-2222-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000002', 'Fantasy',  'closed'),
  ('cccccccc-2222-0000-0000-000000000002', 'eeeeeeee-0000-0000-0000-000000000002', 'Sci-Fi',   'closed')
ON CONFLICT (id) DO NOTHING;

-- Evento 2027 – categoria aperta (futuro)
INSERT INTO categories (id, event_id, name, status)
VALUES
  ('cccccccc-3333-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000003', 'Figurini', 'open')
ON CONFLICT (id) DO NOTHING;

-- ===========================================================================
-- RUOLI TEAM (Task 08)
-- ===========================================================================
INSERT INTO team_roles (id, name)
VALUES
  ('b1b1b1b1-0000-0000-0000-000000000001', 'Capogruppo'),
  ('b1b1b1b1-0000-0000-0000-000000000002', 'Vice'),
  ('b1b1b1b1-0000-0000-0000-000000000003', 'Membro')
ON CONFLICT (id) DO NOTHING;

-- ===========================================================================
-- TEAM
-- ===========================================================================
INSERT INTO teams (id, name, owner_id)
VALUES
  ('d1d1d1d1-0000-0000-0000-000000000001', 'Aquile Blu',    'aaaaaaaa-0000-0000-0000-000000000006'),
  ('d1d1d1d1-0000-0000-0000-000000000002', 'Dragoni Verdi', 'aaaaaaaa-0000-0000-0000-000000000007')
ON CONFLICT (id) DO NOTHING;

-- Membri team Aquile Blu: user1 (capogruppo) + user2 (vice)
INSERT INTO team_members (team_id, user_id, role)
VALUES
  ('d1d1d1d1-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000006', 'Capogruppo'),
  ('d1d1d1d1-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000007', 'Vice')
ON CONFLICT (team_id, user_id) DO NOTHING;

-- Membri team Dragoni Verdi: user2 (capogruppo) + user3 (membro)
INSERT INTO team_members (team_id, user_id, role)
VALUES
  ('d1d1d1d1-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000007', 'Capogruppo'),
  ('d1d1d1d1-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000008', 'Membro')
ON CONFLICT (team_id, user_id) DO NOTHING;

-- ===========================================================================
-- MODELLI
-- code è auto-incrementale: impostiamo valori distinti
-- ===========================================================================
INSERT INTO models (id, user_id, team_id, category_id, name, description, code, image_url)
VALUES
  -- user1 — solo — Aerei 1:72 (evento 2026 aperto)
  ('a2a2a2a2-0000-0000-0000-000000000001',
   'aaaaaaaa-0000-0000-0000-000000000006', NULL,
   'cccccccc-1111-0000-0000-000000000001',
   'Spitfire Mk.IX', 'Replica 1:72 con decal originali', 1, NULL),

  -- user1 — solo — Navi (evento 2026 aperto)
  ('a2a2a2a2-0000-0000-0000-000000000002',
   'aaaaaaaa-0000-0000-0000-000000000006', NULL,
   'cccccccc-1111-0000-0000-000000000002',
   'HMS Victory 1:350', 'Modello del veliero famoso', 2, NULL),

  -- user2 — team Aquile Blu — Aerei 1:72 (evento 2026 aperto)
  ('a2a2a2a2-0000-0000-0000-000000000003',
   'aaaaaaaa-0000-0000-0000-000000000007',
   'd1d1d1d1-0000-0000-0000-000000000001',
   'cccccccc-1111-0000-0000-000000000001',
   'B-17 Flying Fortress', 'Bombariere USA WWII in team', 3, NULL),

  -- user2 — solo — Armature (categoria CHIUSA, evento 2026)
  ('a2a2a2a2-0000-0000-0000-000000000004',
   'aaaaaaaa-0000-0000-0000-000000000007', NULL,
   'cccccccc-1111-0000-0000-000000000003',
   'Cavaliere Medievale', 'Armatura 1:6 dipinta a mano', 4, NULL),

  -- user3 — solo — Fantasy (evento 2025 chiuso)
  ('a2a2a2a2-0000-0000-0000-000000000005',
   'aaaaaaaa-0000-0000-0000-000000000008', NULL,
   'cccccccc-2222-0000-0000-000000000001',
   'Drago Antico', 'Figura fantasy con base diorama', 5, NULL),

  -- user3 — solo — Sci-Fi (evento 2025 chiuso)
  ('a2a2a2a2-0000-0000-0000-000000000006',
   'aaaaaaaa-0000-0000-0000-000000000008', NULL,
   'cccccccc-2222-0000-0000-000000000002',
   'Space Marine', 'Warhammer 40k custom paintjob', 6, NULL),

  -- user1 — solo — Figurini (evento 2027 futuro)
  ('a2a2a2a2-0000-0000-0000-000000000007',
   'aaaaaaaa-0000-0000-0000-000000000006', NULL,
   'cccccccc-3333-0000-0000-000000000001',
   'Guerriero Romano', 'Centurione 1:12', 7, NULL),

  -- user2 — team Dragoni Verdi — Veicoli (evento 2026 aperto)
  ('a2a2a2a2-0000-0000-0000-000000000008',
   'aaaaaaaa-0000-0000-0000-000000000007',
   'd1d1d1d1-0000-0000-0000-000000000002',
   'cccccccc-1111-0000-0000-000000000004',
   'Tiger I Ausf. E', 'Carro armato tedesco WWII', 8, NULL)
ON CONFLICT (id) DO NOTHING;

-- ===========================================================================
-- ISCRIZIONI
-- Casistiche: con/senza modello, check-in sì/no, vari eventi
-- ===========================================================================
INSERT INTO registrations (id, user_id, event_id, model_id, category_id, status, checked_in)
VALUES
  -- user1 — MSS 2026 — Spitfire — check-in effettuato
  ('a4a00001-0000-0000-0000-000000000001',
   'aaaaaaaa-0000-0000-0000-000000000006',
   'eeeeeeee-0000-0000-0000-000000000001',
   'a2a2a2a2-0000-0000-0000-000000000001',
   'cccccccc-1111-0000-0000-000000000001',
   'accepted', true),

  -- user1 — MSS 2026 — HMS Victory — non ancora check-in
  ('a4a00001-0000-0000-0000-000000000002',
   'aaaaaaaa-0000-0000-0000-000000000006',
   'eeeeeeee-0000-0000-0000-000000000001',
   'a2a2a2a2-0000-0000-0000-000000000002',
   'cccccccc-1111-0000-0000-000000000002',
   'accepted', false),

  -- user2 — MSS 2026 — B-17 (team) — check-in effettuato
  ('a4a00001-0000-0000-0000-000000000003',
   'aaaaaaaa-0000-0000-0000-000000000007',
   'eeeeeeee-0000-0000-0000-000000000001',
   'a2a2a2a2-0000-0000-0000-000000000003',
   'cccccccc-1111-0000-0000-000000000001',
   'accepted', true),

  -- user2 — MSS 2026 — Cavaliere Medievale (categoria chiusa) — non check-in
  ('a4a00001-0000-0000-0000-000000000004',
   'aaaaaaaa-0000-0000-0000-000000000007',
   'eeeeeeee-0000-0000-0000-000000000001',
   'a2a2a2a2-0000-0000-0000-000000000004',
   'cccccccc-1111-0000-0000-000000000003',
   'accepted', false),

  -- user2 — MSS 2026 — Tiger I (team Dragoni) — non check-in
  ('a4a00001-0000-0000-0000-000000000005',
   'aaaaaaaa-0000-0000-0000-000000000007',
   'eeeeeeee-0000-0000-0000-000000000001',
   'a2a2a2a2-0000-0000-0000-000000000008',
   'cccccccc-1111-0000-0000-000000000004',
   'accepted', false),

  -- user5 — MSS 2026 — senza modello (iscrizione generica)
  ('a4a00001-0000-0000-0000-000000000006',
   'aaaaaaaa-0000-0000-0000-000000000010',
   'eeeeeeee-0000-0000-0000-000000000001',
   NULL, NULL,
   'accepted', false),

  -- user3 — MSS 2025 — Drago Antico — check-in effettuato
  ('a4a00001-0000-0000-0000-000000000007',
   'aaaaaaaa-0000-0000-0000-000000000008',
   'eeeeeeee-0000-0000-0000-000000000002',
   'a2a2a2a2-0000-0000-0000-000000000005',
   'cccccccc-2222-0000-0000-000000000001',
   'accepted', true),

  -- user3 — MSS 2025 — Space Marine — check-in effettuato
  ('a4a00001-0000-0000-0000-000000000008',
   'aaaaaaaa-0000-0000-0000-000000000008',
   'eeeeeeee-0000-0000-0000-000000000002',
   'a2a2a2a2-0000-0000-0000-000000000006',
   'cccccccc-2222-0000-0000-000000000002',
   'accepted', true),

  -- user1 — MSS 2025 — senza modello (partecipante spettatore)
  ('a4a00001-0000-0000-0000-000000000009',
   'aaaaaaaa-0000-0000-0000-000000000006',
   'eeeeeeee-0000-0000-0000-000000000002',
   NULL, NULL,
   'accepted', true),

  -- user1 — MSS 2027 — Guerriero Romano (evento futuro)
  ('a4a00001-0000-0000-0000-000000000010',
   'aaaaaaaa-0000-0000-0000-000000000006',
   'eeeeeeee-0000-0000-0000-000000000003',
   'a2a2a2a2-0000-0000-0000-000000000007',
   'cccccccc-3333-0000-0000-000000000001',
   'accepted', false)
ON CONFLICT (id) DO NOTHING;

-- ===========================================================================
-- ASSEGNAZIONI GIUDICI
-- ===========================================================================
INSERT INTO judge_assignments (id, event_id, judge_id, category_id)
VALUES
  -- judge1 → MSS 2026 (tutte le categorie)
  ('a1a1a1a1-0000-0000-0000-000000000001',
   'eeeeeeee-0000-0000-0000-000000000001',
   'aaaaaaaa-0000-0000-0000-000000000003', NULL),

  -- judge2 → MSS 2026 (tutte le categorie)
  ('a1a1a1a1-0000-0000-0000-000000000002',
   'eeeeeeee-0000-0000-0000-000000000001',
   'aaaaaaaa-0000-0000-0000-000000000004', NULL),

  -- judge1 → MSS 2025 (tutte le categorie, evento passato)
  ('a1a1a1a1-0000-0000-0000-000000000003',
   'eeeeeeee-0000-0000-0000-000000000002',
   'aaaaaaaa-0000-0000-0000-000000000003', NULL)
ON CONFLICT (event_id, judge_id) DO NOTHING;

-- ===========================================================================
-- VOTI — con storico (più voti sullo stesso modello per lo stesso giudice)
-- judge1 ha aggiornato il voto su model1 due volte → storico visibile
-- ===========================================================================
INSERT INTO votes (id, judge_id, model_id, rank, created_at)
VALUES
  -- judge1 su Spitfire: prima rank=2, poi aggiornato a rank=3
  ('e1e1e1e1-0000-0000-0000-000000000001',
   'aaaaaaaa-0000-0000-0000-000000000003',
   'a2a2a2a2-0000-0000-0000-000000000001',
   2, NOW() - INTERVAL '2 hours'),

  ('e1e1e1e1-0000-0000-0000-000000000002',
   'aaaaaaaa-0000-0000-0000-000000000003',
   'a2a2a2a2-0000-0000-0000-000000000001',
   3, NOW() - INTERVAL '1 hour'),

  -- judge1 su HMS Victory: rank=1
  ('e1e1e1e1-0000-0000-0000-000000000003',
   'aaaaaaaa-0000-0000-0000-000000000003',
   'a2a2a2a2-0000-0000-0000-000000000002',
   1, NOW() - INTERVAL '90 minutes'),

  -- judge1 su B-17: rank=3
  ('e1e1e1e1-0000-0000-0000-000000000004',
   'aaaaaaaa-0000-0000-0000-000000000003',
   'a2a2a2a2-0000-0000-0000-000000000003',
   3, NOW() - INTERVAL '80 minutes'),

  -- judge1 su Cavaliere Medievale: rank=0 (non meritevole)
  ('e1e1e1e1-0000-0000-0000-000000000005',
   'aaaaaaaa-0000-0000-0000-000000000003',
   'a2a2a2a2-0000-0000-0000-000000000004',
   0, NOW() - INTERVAL '70 minutes'),

  -- judge1 su Tiger I: nessun voto (modello non ancora valutato)

  -- judge2 su Spitfire: rank=3
  ('e1e1e1e1-0000-0000-0000-000000000006',
   'aaaaaaaa-0000-0000-0000-000000000004',
   'a2a2a2a2-0000-0000-0000-000000000001',
   3, NOW() - INTERVAL '60 minutes'),

  -- judge2 su B-17: prima rank=2, poi rank=3 → storico
  ('e1e1e1e1-0000-0000-0000-000000000007',
   'aaaaaaaa-0000-0000-0000-000000000004',
   'a2a2a2a2-0000-0000-0000-000000000003',
   2, NOW() - INTERVAL '50 minutes'),

  ('e1e1e1e1-0000-0000-0000-000000000008',
   'aaaaaaaa-0000-0000-0000-000000000004',
   'a2a2a2a2-0000-0000-0000-000000000003',
   3, NOW() - INTERVAL '40 minutes'),

  -- judge2 su HMS Victory: rank=2
  ('e1e1e1e1-0000-0000-0000-000000000009',
   'aaaaaaaa-0000-0000-0000-000000000004',
   'a2a2a2a2-0000-0000-0000-000000000002',
   2, NOW() - INTERVAL '30 minutes'),

  -- judge1 su Drago Antico (MSS 2025): rank=3
  ('e1e1e1e1-0000-0000-0000-000000000010',
   'aaaaaaaa-0000-0000-0000-000000000003',
   'a2a2a2a2-0000-0000-0000-000000000005',
   3, NOW() - INTERVAL '365 days'),

  -- judge1 su Space Marine (MSS 2025): rank=2
  ('e1e1e1e1-0000-0000-0000-000000000011',
   'aaaaaaaa-0000-0000-0000-000000000003',
   'a2a2a2a2-0000-0000-0000-000000000006',
   2, NOW() - INTERVAL '364 days')
ON CONFLICT (id) DO NOTHING;

-- ===========================================================================
-- RICHIESTE DI MODIFICA CATEGORIA (Task 03)
-- Casistiche: pending / resolved / rejected
-- ===========================================================================
INSERT INTO modification_requests (id, model_id, judge_id, reason, status, suggested_category_id, created_at)
VALUES
  -- judge1 chiede cambio categoria per B-17: da Aerei a Veicoli — PENDING
  ('a3a3a3a0-0000-0000-0000-000000000001',
   'a2a2a2a2-0000-0000-0000-000000000003',
   'aaaaaaaa-0000-0000-0000-000000000003',
   'Il modello sembra più adatto alla categoria Veicoli militari.',
   'pending',
   'cccccccc-1111-0000-0000-000000000004',
   NOW() - INTERVAL '3 hours'),

  -- judge2 chiede revisione Spitfire senza categoria suggerita — RESOLVED
  ('a3a3a3a0-0000-0000-0000-000000000002',
   'a2a2a2a2-0000-0000-0000-000000000001',
   'aaaaaaaa-0000-0000-0000-000000000004',
   'Verifica scala: potrebbe essere 1:48 anziché 1:72.',
   'resolved',
   NULL,
   NOW() - INTERVAL '5 hours'),

  -- judge1 chiede cambio Cavaliere Medievale: da Armature a nessuna categ — REJECTED
  ('a3a3a3a0-0000-0000-0000-000000000003',
   'a2a2a2a2-0000-0000-0000-000000000004',
   'aaaaaaaa-0000-0000-0000-000000000003',
   'Non chiaro se figura o armatura completa.',
   'rejected',
   NULL,
   NOW() - INTERVAL '6 hours')
ON CONFLICT (id) DO NOTHING;

-- ===========================================================================
-- MENZIONI SPECIALI
-- ===========================================================================
INSERT INTO special_mentions (id, event_id, model_id, title, description, awarded_by, created_at)
VALUES
  -- MSS 2026: Miglior Team award
  ('c1c1c1c1-0000-0000-0000-000000000001',
   'eeeeeeee-0000-0000-0000-000000000001',
   'a2a2a2a2-0000-0000-0000-000000000003',
   'Miglior Modello in Team',
   'Eccellente lavoro di squadra nella costruzione e pittura.',
   'aaaaaaaa-0000-0000-0000-000000000002',
   NOW()),

  -- MSS 2025: Miglior assoluto storico
  ('c1c1c1c1-0000-0000-0000-000000000002',
   'eeeeeeee-0000-0000-0000-000000000002',
   'a2a2a2a2-0000-0000-0000-000000000005',
   'Miglior Modello in Assoluto',
   'Giudizio unanime della giuria.',
   'aaaaaaaa-0000-0000-0000-000000000002',
   NOW() - INTERVAL '365 days'),

  -- MSS 2025: Menzione pittura
  ('c1c1c1c1-0000-0000-0000-000000000003',
   'eeeeeeee-0000-0000-0000-000000000002',
   'a2a2a2a2-0000-0000-0000-000000000006',
   'Miglior Pittura',
   'Tecnica NMM eccezionale.',
   'aaaaaaaa-0000-0000-0000-000000000002',
   NOW() - INTERVAL '365 days')
ON CONFLICT (id) DO NOTHING;

-- ===========================================================================
-- SPONSOR
-- ===========================================================================
INSERT INTO sponsors (id, event_id, name, logo_url, website_url, description, tier)
VALUES
  ('c2c2c2c2-0000-0000-0000-000000000001',
   'eeeeeeee-0000-0000-0000-000000000001',
   'Revell Italia', NULL, 'https://www.revell.com', 'Sponsor tecnico principale', 'gold'),

  ('c2c2c2c2-0000-0000-0000-000000000002',
   'eeeeeeee-0000-0000-0000-000000000001',
   'Tamiya Italia', NULL, 'https://www.tamiya.com', 'Sponsor colori e accessori', 'silver'),

  ('c2c2c2c2-0000-0000-0000-000000000003',
   'eeeeeeee-0000-0000-0000-000000000001',
   'AeroModel Club', NULL, NULL, 'Club locale di modellismo', 'bronze'),

  ('c2c2c2c2-0000-0000-0000-000000000004',
   'eeeeeeee-0000-0000-0000-000000000002',
   'Scale Shop Firenze', NULL, NULL, 'Sponsor edizione 2025', 'gold')
ON CONFLICT (id) DO NOTHING;

-- ===========================================================================
-- SETTINGS
-- ===========================================================================
INSERT INTO settings (key, value, updated_at)
VALUES
  ('model_code_prefix',           'MSS',    NOW()),
  ('model_code_digits',           '5',      NOW()),
  ('model_user_digits',           '4',      NOW()),
  ('model_images_enabled',        'true',   NOW()),
  ('export_include_code',         'true',   NOW()),
  ('export_include_description',  'false',  NOW()),
  ('export_include_email',        'true',   NOW()),
  ('excel_sheet_name',            'Modelli', NOW()),
  ('excel_file_prefix',           'export', NOW()),
  ('theme_mode',                  'light',  NOW()),
  ('theme_preset',                'violet', NOW())
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value, updated_at = NOW();

-- ===========================================================================
-- TEAM ADMIN
-- ===========================================================================
INSERT INTO teams (id, name, owner_id)
VALUES
  ('d2d2d2d2-0000-0000-0000-000000000001', 'Falchi Rossi',    'aaaaaaaa-0000-0000-0000-000000000001'),
  ('d2d2d2d2-0000-0000-0000-000000000002', 'Leoni d''Argento', 'aaaaaaaa-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- Falchi Rossi: admin (Capogruppo), user1 (Vice), user2 (Membro)
INSERT INTO team_members (team_id, user_id, role)
VALUES
  ('d2d2d2d2-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Capogruppo'),
  ('d2d2d2d2-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000006', 'Vice'),
  ('d2d2d2d2-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000007', 'Membro')
ON CONFLICT (team_id, user_id) DO NOTHING;

-- Leoni d'Argento: admin (Capogruppo), user3 (Vice)
INSERT INTO team_members (team_id, user_id, role)
VALUES
  ('d2d2d2d2-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Capogruppo'),
  ('d2d2d2d2-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000008', 'Vice')
ON CONFLICT (team_id, user_id) DO NOTHING;

-- ===========================================================================
-- 15 MODELLI ADMIN
-- code 9–23, distribuiti su eventi e categorie esistenti
-- ===========================================================================
INSERT INTO models (id, user_id, team_id, category_id, name, description, code, image_url)
VALUES
  -- Solo — MSS 2026
  ('a2a2a2a2-0001-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', NULL,
   'cccccccc-1111-0000-0000-000000000001', 'Messerschmitt Bf 109', 'Caccia tedesco WWII 1:72', 9, NULL),

  ('a2a2a2a2-0001-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', NULL,
   'cccccccc-1111-0000-0000-000000000002', 'USS Enterprise CV-6', 'Portaerei USA 1:700', 10, NULL),

  ('a2a2a2a2-0001-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', NULL,
   'cccccccc-1111-0000-0000-000000000003', 'Samurai Takeda', 'Armatura full-plate periodo Sengoku', 11, NULL),

  ('a2a2a2a2-0001-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', NULL,
   'cccccccc-1111-0000-0000-000000000004', 'M4 Sherman', 'Carro medio USA WWII 1:35', 12, NULL),

  -- Team Falchi Rossi — MSS 2026
  ('a2a2a2a2-0001-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000001',
   'd2d2d2d2-0000-0000-0000-000000000001',
   'cccccccc-1111-0000-0000-000000000001', 'P-51 Mustang', 'Caccia USA WWII in team', 13, NULL),

  ('a2a2a2a2-0001-0000-0000-000000000006', 'aaaaaaaa-0000-0000-0000-000000000001',
   'd2d2d2d2-0000-0000-0000-000000000001',
   'cccccccc-1111-0000-0000-000000000004', 'Panzer IV Ausf. H', 'Carro tedesco WWII in team', 14, NULL),

  -- Solo — MSS 2025
  ('a2a2a2a2-0001-0000-0000-000000000007', 'aaaaaaaa-0000-0000-0000-000000000001', NULL,
   'cccccccc-2222-0000-0000-000000000001', 'Lich King', 'Figura fantasy non-morta', 15, NULL),

  ('a2a2a2a2-0001-0000-0000-000000000008', 'aaaaaaaa-0000-0000-0000-000000000001', NULL,
   'cccccccc-2222-0000-0000-000000000002', 'Tau Commander', 'Warhammer 40k xenos', 16, NULL),

  -- Solo — MSS 2027
  ('a2a2a2a2-0001-0000-0000-000000000009', 'aaaaaaaa-0000-0000-0000-000000000001', NULL,
   'cccccccc-3333-0000-0000-000000000001', 'Legionario Romano', 'Fanteria pesante I sec.', 17, NULL),

  -- Team Leoni d'Argento — MSS 2026
  ('a2a2a2a2-0001-0000-0000-000000000010', 'aaaaaaaa-0000-0000-0000-000000000001',
   'd2d2d2d2-0000-0000-0000-000000000002',
   'cccccccc-1111-0000-0000-000000000002', 'Yamato 1:350', 'Corazzata giapponese WWII', 18, NULL),

  ('a2a2a2a2-0001-0000-0000-000000000011', 'aaaaaaaa-0000-0000-0000-000000000001',
   'd2d2d2d2-0000-0000-0000-000000000002',
   'cccccccc-1111-0000-0000-000000000003', 'Cavaliere Templare', 'Armatura medievale in team', 19, NULL),

  -- Solo — MSS 2026 (ulteriori)
  ('a2a2a2a2-0001-0000-0000-000000000012', 'aaaaaaaa-0000-0000-0000-000000000001', NULL,
   'cccccccc-1111-0000-0000-000000000001', 'Zero A6M2', 'Caccia navale giapponese 1:72', 20, NULL),

  ('a2a2a2a2-0001-0000-0000-000000000013', 'aaaaaaaa-0000-0000-0000-000000000001', NULL,
   'cccccccc-1111-0000-0000-000000000004', 'Leopard 2A6', 'MBT tedesco moderno 1:35', 21, NULL),

  -- Solo — MSS 2025 (ulteriori)
  ('a2a2a2a2-0001-0000-0000-000000000014', 'aaaaaaaa-0000-0000-0000-000000000001', NULL,
   'cccccccc-2222-0000-0000-000000000001', 'Goblin Shaman', 'Figura fantasy con effetti magici', 22, NULL),

  -- Solo — MSS 2027 (ulteriore)
  ('a2a2a2a2-0001-0000-0000-000000000015', 'aaaaaaaa-0000-0000-0000-000000000001', NULL,
   'cccccccc-3333-0000-0000-000000000001', 'Gladiatore Reziario', 'Figura 1:12 con rete e tridente', 23, NULL)
ON CONFLICT (id) DO NOTHING;

-- ===========================================================================
-- ISCRIZIONI ADMIN (15 — una per modello)
-- ===========================================================================
INSERT INTO registrations (id, user_id, event_id, model_id, category_id, status, checked_in)
VALUES
  -- MSS 2026 — solo
  ('a4a00002-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
   'eeeeeeee-0000-0000-0000-000000000001',
   'a2a2a2a2-0001-0000-0000-000000000001', 'cccccccc-1111-0000-0000-000000000001', 'accepted', true),

  ('a4a00002-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001',
   'eeeeeeee-0000-0000-0000-000000000001',
   'a2a2a2a2-0001-0000-0000-000000000002', 'cccccccc-1111-0000-0000-000000000002', 'accepted', true),

  ('a4a00002-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001',
   'eeeeeeee-0000-0000-0000-000000000001',
   'a2a2a2a2-0001-0000-0000-000000000003', 'cccccccc-1111-0000-0000-000000000003', 'accepted', false),

  ('a4a00002-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001',
   'eeeeeeee-0000-0000-0000-000000000001',
   'a2a2a2a2-0001-0000-0000-000000000004', 'cccccccc-1111-0000-0000-000000000004', 'accepted', true),

  -- MSS 2026 — team Falchi Rossi
  ('a4a00002-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000001',
   'eeeeeeee-0000-0000-0000-000000000001',
   'a2a2a2a2-0001-0000-0000-000000000005', 'cccccccc-1111-0000-0000-000000000001', 'accepted', true),

  ('a4a00002-0000-0000-0000-000000000006', 'aaaaaaaa-0000-0000-0000-000000000001',
   'eeeeeeee-0000-0000-0000-000000000001',
   'a2a2a2a2-0001-0000-0000-000000000006', 'cccccccc-1111-0000-0000-000000000004', 'accepted', false),

  -- MSS 2025 — solo
  ('a4a00002-0000-0000-0000-000000000007', 'aaaaaaaa-0000-0000-0000-000000000001',
   'eeeeeeee-0000-0000-0000-000000000002',
   'a2a2a2a2-0001-0000-0000-000000000007', 'cccccccc-2222-0000-0000-000000000001', 'accepted', true),

  ('a4a00002-0000-0000-0000-000000000008', 'aaaaaaaa-0000-0000-0000-000000000001',
   'eeeeeeee-0000-0000-0000-000000000002',
   'a2a2a2a2-0001-0000-0000-000000000008', 'cccccccc-2222-0000-0000-000000000002', 'accepted', true),

  -- MSS 2027 — solo
  ('a4a00002-0000-0000-0000-000000000009', 'aaaaaaaa-0000-0000-0000-000000000001',
   'eeeeeeee-0000-0000-0000-000000000003',
   'a2a2a2a2-0001-0000-0000-000000000009', 'cccccccc-3333-0000-0000-000000000001', 'accepted', false),

  -- MSS 2026 — team Leoni d'Argento
  ('a4a00002-0000-0000-0000-000000000010', 'aaaaaaaa-0000-0000-0000-000000000001',
   'eeeeeeee-0000-0000-0000-000000000001',
   'a2a2a2a2-0001-0000-0000-000000000010', 'cccccccc-1111-0000-0000-000000000002', 'accepted', false),

  ('a4a00002-0000-0000-0000-000000000011', 'aaaaaaaa-0000-0000-0000-000000000001',
   'eeeeeeee-0000-0000-0000-000000000001',
   'a2a2a2a2-0001-0000-0000-000000000011', 'cccccccc-1111-0000-0000-000000000003', 'accepted', false),

  -- MSS 2026 — solo (ulteriori)
  ('a4a00002-0000-0000-0000-000000000012', 'aaaaaaaa-0000-0000-0000-000000000001',
   'eeeeeeee-0000-0000-0000-000000000001',
   'a2a2a2a2-0001-0000-0000-000000000012', 'cccccccc-1111-0000-0000-000000000001', 'accepted', true),

  ('a4a00002-0000-0000-0000-000000000013', 'aaaaaaaa-0000-0000-0000-000000000001',
   'eeeeeeee-0000-0000-0000-000000000001',
   'a2a2a2a2-0001-0000-0000-000000000013', 'cccccccc-1111-0000-0000-000000000004', 'accepted', false),

  -- MSS 2025 — solo (ulteriori)
  ('a4a00002-0000-0000-0000-000000000014', 'aaaaaaaa-0000-0000-0000-000000000001',
   'eeeeeeee-0000-0000-0000-000000000002',
   'a2a2a2a2-0001-0000-0000-000000000014', 'cccccccc-2222-0000-0000-000000000001', 'accepted', true),

  -- MSS 2027 — solo (ulteriore)
  ('a4a00002-0000-0000-0000-000000000015', 'aaaaaaaa-0000-0000-0000-000000000001',
   'eeeeeeee-0000-0000-0000-000000000003',
   'a2a2a2a2-0001-0000-0000-000000000015', 'cccccccc-3333-0000-0000-000000000001', 'accepted', false)
ON CONFLICT (id) DO NOTHING;

SQL

echo "✓ Test data inseriti con successo nel DB '${TENANT_DB_NAME}'"
echo ""
echo "Credenziali di accesso (password: Password1!):"
echo "  admin@test.com    → admin"
echo "  manager@test.com  → manager"
echo "  judge1@test.com   → judge (assegnato a MSS 2026 e MSS 2025)"
echo "  judge2@test.com   → judge (assegnato a MSS 2026)"
echo "  staff@test.com    → staff"
echo "  user1@test.com    → user  (Mario Rossi, 3 modelli, check-in su Spitfire)"
echo "  user2@test.com    → user  (Luigi Bianchi, team Aquile Blu + Dragoni Verdi)"
echo "  user3@test.com    → user  (Anna Verdi, partecipante MSS 2025)"
echo "  user4@test.com    → user  (Carlo Neri, DISATTIVATO)"
echo "  user5@test.com    → user  (senza profilo, iscrizione senza modello)"
