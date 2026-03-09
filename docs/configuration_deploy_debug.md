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

# 2. Avvia i servizi infrastrutturali (postgres + minio)
docker-compose up -d postgres minio

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
| `POSTGRES_PASSWORD`  | `postgres`       |                                   |
| `POSTGRES_DB`        | `postgres`       |                                   |
| `JWT_SECRET`         | `change-me`      | **Cambiare in produzione**        |
| `PG_HOST`            | `postgres`       | `localhost` in dev locale         |
| `PG_PORT`            | `5432`           |                                   |
| `PG_DB`              | `tenant_db_1`    |                                   |
| `MINIO_ENDPOINT`     | `minio`          | `localhost` in dev locale         |
| `MINIO_PORT`         | `9000`           |                                   |
| `MINIO_ACCESS_KEY`   | `minioadmin`     |                                   |
| `MINIO_SECRET_KEY`   | `minioadmin`     |                                   |
| `RESEND_API_KEY`     | *(opzionale)*    | Se assente, email reset saltate   |

> In sviluppo locale sostituire `PG_HOST=localhost` e `MINIO_ENDPOINT=localhost` nel `.env`.

---

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
- Backend API: `http://localhost:3000`
- Swagger UI: `http://localhost:3000/docs`
- MinIO Console: `http://localhost:9001`

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

- Console admin: `http://localhost:9001`
- Credenziali default: `minioadmin` / `minioadmin`
- Bucket default: `models`

```bash
# Verifica bucket esistenti via API
curl http://localhost:9000/minio/health/live
```
