# Configuration, Deploy & Debug

## Stack

| Layer    | Tech                        | Port  |
|----------|-----------------------------|-------|
| Frontend | React + Vite (dev) / Nginx  | 8080  |
| Backend  | Bun + Elysia                | 3000  |
| DB       | PostgreSQL 16               | 5432  |
| Storage  | MinIO                       | 9000 / 9001 |

---

## 1. Setup locale (sviluppo)

### Prerequisiti
- [Bun](https://bun.sh) >= 1.x
- Node.js >= 18
- Docker + Docker Compose

### Avvio rapido

```bash
# 1. Copia e configura le variabili d'ambiente
cp .env.example .env

# 2. Avvia i servizi infrastrutturali (postgres + minio), pubblicati solo su 127.0.0.1
# (richiede POSTGRES_PASSWORD, MINIO_ROOT_USER, MINIO_ROOT_PASSWORD nel .env)
docker compose -f docker-compose.debug.yml up -d postgres minio

# 3. Backend
cd backend
bun install
bun run dev      # http://localhost:3000

# 4. Frontend (nuovo terminale)
cd frontend
npm install
npm run dev      # http://localhost:5173
```

---

## 2. Variabili d'ambiente

File: `.env` (copia da `.env.example`)

| Variabile            | Default          | Note                              |
|----------------------|------------------|-----------------------------------|
| `POSTGRES_USER`      | `postgres`       |                                   |
| `POSTGRES_PASSWORD`  | nessuno          | **Obbligatorio**, senza default (`openssl rand -base64 24`) |
| `POSTGRES_DB`        | `postgres`       |                                   |
| `JWT_SECRET`         | nessuno          | **Obbligatorio**, senza default (`openssl rand -base64 48`) |
| `PG_HOST`            | `postgres`       | `localhost` in dev locale         |
| `PG_PORT`            | `5432`           |                                   |
| `PG_DB`              | `tenant_db_1`    |                                   |
| `MINIO_ENDPOINT`     | `minio`          | `localhost` in dev locale         |
| `MINIO_PORT`         | `9000`           |                                   |
| `MINIO_ROOT_USER`    | nessuno          | **Obbligatorio** (compose lo usa anche come `MINIO_ACCESS_KEY` del backend) |
| `MINIO_ROOT_PASSWORD`| nessuno          | **Obbligatorio** (compose lo usa anche come `MINIO_SECRET_KEY` del backend) |
| `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` | nessuno | Solo per il backend fuori da compose; uguali a `MINIO_ROOT_*` |
| `DEMO_PASSWORD_HASH` | nessuno          | Solo profilo demo, obbligatorio con `--profile demo` |
| `RESEND_API_KEY`     | *(opzionale)*    | Se assente, email reset saltate   |

> In sviluppo locale sostituire `PG_HOST=localhost` e `MINIO_ENDPOINT=localhost` nel `.env`.

---

### JWT_SECRET: obbligatorio, senza default

- Il backend rifiuta di partire se `JWT_SECRET` e' assente o vuoto. I file `docker-compose.yml` e
  `docker-compose.debug.yml` falliscono subito (`required variable JWT_SECRET is missing a value`)
  se non e' valorizzato; anche il chart Helm (`secrets.JWT_SECRET`) fa fallire `helm template/install`.
- Generarlo: `openssl rand -base64 48`. Deve restare stabile tra i riavvii.
- `start-prod.ps1` crea `.env` da `.env.example` e genera automaticamente un `JWT_SECRET` casuale se
  mancante/vuoto (non sovrascrive un valore esistente e non lo stampa).
- `docker-compose.dev.yml` e' un override: non ridefinisce `environment` del backend, quindi con
  `-f docker-compose.yml -f docker-compose.dev.yml` il backend eredita `JWT_SECRET` dal file base
  (e il controllo `:?` resta attivo).
- Migrazione: chi ha un `.env` o values Helm con `change-me` (o `debug-secret-change-me`) deve
  sostituirlo con un valore casuale. Attenzione: cambiare il segreto invalida i token JWT gia' emessi
  (gli utenti dovranno rifare il login).

## 3. Deploy completo con Docker Compose

```bash
# Build e avvio di tutti i servizi
docker-compose up -d --build

# Verifica stato
docker-compose ps

# Log in tempo reale
docker-compose logs -f backend
docker-compose logs -f frontend
```

URL dopo il deploy:
- Frontend: `http://localhost:8080`
- API (via nginx): `http://localhost:8080/api`
- Backend, PostgreSQL e MinIO Console non sono pubblicati sull'host nello stack base
  (usa `docker-compose.debug.yml`: tutte le porte sono su `127.0.0.1`)

---

## 4. Debug

### Backend (Bun)

```bash
# Dev con hot-reload
cd backend
bun run dev

# Endpoint health check
curl http://localhost:3000/health

# Log dettagliati (se supportato)
LOG_LEVEL=debug bun run dev
```

### Frontend (Vite)

```bash
cd frontend
npm run dev

# Proxy API: /api → http://localhost:3000 (configurato in vite.config)
# Per bypassare il proxy:
VITE_API_BASE=http://localhost:3000 npm run dev
```

### Debug container in esecuzione

```bash
# Shell nel container backend
docker-compose exec backend sh

# Shell nel container postgres
docker-compose exec postgres psql -U postgres -d tenant_db_1

# Ispeziona variabili d'ambiente del container
docker-compose exec backend env
```

### Problemi comuni

| Sintomo | Causa probabile | Fix |
|---------|----------------|-----|
| Backend non si connette a Postgres | `PG_HOST=postgres` non raggiungibile in dev | Usare `PG_HOST=localhost` nel `.env` |
| MinIO connection refused | `MINIO_ENDPOINT=minio` in dev locale | Usare `MINIO_ENDPOINT=localhost` |
| JWT error 401 | `JWT_SECRET` diverso tra restart | Fissare valore nel `.env` |
| Porta 5432 occupata | Postgres locale già in esecuzione | `docker-compose stop postgres` o cambiare porta |
| Tabelle mancanti | Migration non eseguita | Verificare script in `docker/postgres/` |

---

## 5. Database

```bash
# Connessione diretta (dev)
psql -h localhost -U postgres -d tenant_db_1

# Reset dati (attenzione: distruttivo)
docker-compose down -v   # rimuove i volumi pgdata e miniodata
docker-compose up -d
```

---

## 6. MinIO

- Console admin (solo `docker-compose.debug.yml`): `http://127.0.0.1:9001`
- Credenziali: `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` dal `.env` (nessun default)
- Bucket default: `models`

```bash
# Verifica bucket esistenti via API
curl http://localhost:9000/minio/health/live
```

---

## Profilo demo (opt-in) e dati di test

`db-seed` (carica `docker/postgres/02-test-data.sh`) e' dietro `profiles: ["demo"]` e **non** parte
con un normale `docker compose up`. Non usarlo su database reali; non e' incluso nel pacchetto laptop.

```bash
# hash argon2id della password demo (stessa funzione del backend)
cd backend && bun -e "console.log(await Bun.password.hash(process.argv[1]))" 'LaTuaPassword'
# in .env, tra apici SINGOLI (contiene '$'):  DEMO_PASSWORD_HASH='$argon2id$v=19$...'
docker compose --profile demo up -d
```

- `DEMO_PASSWORD_HASH` e' obbligatoria con il profilo (nessun default; lo script esce con errore se manca).
  L'hash argon2 non si calcola in shell: va precalcolato. Nessun hash/password e' nel repository.
- Lo script gira solo se `SELECT count(*) FROM users` = 0, usa `ON CONFLICT DO NOTHING`, non
  reimposta password esistenti, non crea admin con password fissa e non stampa credenziali.
- Utenti demo (email fittizie, password = quella scelta): admin@test.com, manager@test.com,
  judge1@test.com, judge2@test.com, staff@test.com, user1..user5@test.com.
- Gli e2e (`e2e/tests/helpers.ts`) assumono la vecchia password nota: vanno allineati.

## Migrazione per deploy esistenti

- `.env` senza `POSTGRES_PASSWORD`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`: `docker compose` ora
  fallisce con "... is required". Prima i default erano `postgres` / `minioadmin`.
- Postgres applica `POSTGRES_PASSWORD` solo alla creazione del volume `pgdata`: per un DB esistente
  imposta in `.env` la password GIA' in uso (default storico: `postgres`) e poi cambiala con
  `ALTER USER postgres PASSWORD '...'` e aggiorna `.env`. Un valore diverso fa fallire backend e db-schema.
- MinIO: le credenziali root si possono cambiare riavviando con nuovi `MINIO_ROOT_*`; aggiorna `.env`.
- Porte 5432/9001/3000 non piu' raggiungibili dall'host (3000 solo via `http://localhost:8080/api`);
  MinIO 9000 solo su 127.0.0.1 (se `MINIO_PUBLIC_URL` punta a un host esterno le immagini non si caricano).
- Database che contengono utenti di test con `Password1!` (seed precedente): cambiare/disattivare quelle password.

## Header di sicurezza, CSP e container non-root

- nginx invia CSP, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`
  da `docker/nginx/security-headers.conf` (montato in `/etc/nginx/snippets/`; copia identica in
  `frontend/security-headers.conf` per l'immagine, la CI verifica che coincidano). HSTS e' commentato:
  attivalo solo con HTTPS.
- **Operatore**: in quel file sostituisci `http://localhost:9000` (in `img-src` e `connect-src`) con
  l'origine di `MINIO_PUBLIC_URL` (schema://host[:porta]). Con Helm il file e' nell'immagine: monta
  una ConfigMap su `/etc/nginx/snippets/security-headers.conf` oppure ricostruisci l'immagine.
- Il frontend carica Roboto/Material Symbols da Google Fonts (consentiti in CSP); self-hosting richiede
  modifiche in `frontend/` e permetterebbe di rimuovere `fonts.googleapis.com`/`fonts.gstatic.com`.
- Il frontend ora usa `nginxinc/nginx-unprivileged` (utente non root) e ascolta sulla porta **8080** del
  container: il mapping compose deve essere `8080:8080` (non `8080:80`); Helm e' gia' aggiornato.
  Il backend gira come utente `bun`.
