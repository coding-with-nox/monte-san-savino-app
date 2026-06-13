# Monte San Savino Miniature Contest App

Web platform for managing miniature painting contests — registrations, judging, check-in, and label printing.

## Features

- Participant registration and profile management
- Event enrollment and team assignment
- Judge scoring per category with rank-based voting
- Staff check-in via QR code
- DYMO label printing for registered participants
- Role-based access: `user` / `staff` / `judge` / `manager` / `admin`
- Multi-theme UI (violet / ocean / forest) with light/dark toggle (Material 3 design)

## Tech Stack

| Backend | Frontend | Database | Storage | CI/CD |
|---------|----------|----------|---------|-------|
| Bun 1.1.29 + Elysia | React 18 + MUI v5 | PostgreSQL 16 | MinIO | GitHub Actions + GHCR |

The backend follows a DDD layering (`domain` / `application` / `infra`) split into bounded contexts: `identity`, `contest`, `tenancy`, and `shared`. Persistence uses Drizzle ORM; authentication is email + password with JWT (signed via `jose`); object storage runs on MinIO in dev and S3-compatible storage in prod.

## Project Structure

```
monte-san-savino-app/
├── backend/                  # Bun/Elysia API, DDD architecture
│   ├── src/
│   │   ├── bootstrap/        # app composition, server entry, seed
│   │   ├── identity/         # auth, users, roles (domain/application/infra)
│   │   ├── contest/          # events, categories, votes, enrollment, QR, export
│   │   ├── tenancy/          # DB-per-tenant scaffolding + middleware
│   │   └── shared/           # logger, storage, email ports & adapters
│   └── package.json
├── frontend/                 # React SPA, Vite, MUI v5
│   └── package.json
├── docs/                     # architecture, deploy guides, user manual
├── docker/                   # postgres init, nginx config
├── docker-compose.yml        # production compose (GHCR images)
├── docker-compose.dev.yml    # dev override (hot-reload, adminer)
└── start.ps1                 # dev start command
```

## Quick Start (Development)

### Prerequisites

- Docker Desktop
- PowerShell (Windows) or bash (Linux/Mac)

### Start all services

```powershell
./start.ps1
```

This runs `docker compose -f docker-compose.yml -f docker-compose.dev.yml up`, starting:

- PostgreSQL — `:5432`
- MinIO — API `:9000`, console `:9001`
- Backend — `:3000`
- Frontend — `:5173`
- Adminer — `:8888`

In dev mode the backend runs `bunx drizzle-kit push` (sync schema) then `bun --hot` for hot-reload, and seeds demo data on startup when `NODE_ENV != production`.

### First run: seed admin user

```bash
cd backend && bun run seed
```

### URLs

- App: http://localhost:5173
- API Swagger: http://localhost:3000/docs
- MinIO console: http://localhost:9001
- Adminer: http://localhost:8888

## Testing

### Backend

```bash
cd backend
bun run test:setup   # Push schema to tenant_db_test (requires postgres running)
bun test             # Unit + integration tests (domain, application, auth routes)
```

`test:setup` runs `PG_DB=tenant_db_test bunx drizzle-kit push`. Unit tests cover the domain (`Email`, `Role`, `Vote`) and application layer (`RegisterUser`, `LoginWithPassword`, `AuthenticateUser`); integration tests exercise the auth routes (register, login, protected).

### Frontend

```bash
cd frontend
bun run test         # Vitest: component tests + page smoke tests
```

## CI/CD

- **Pull Requests → main**: `test-backend` and `test-frontend` jobs run in parallel.
- **Push to main**: tests pass → `build-images` builds and pushes backend + frontend to GHCR with `sha-<commit>` and `latest` tags.
- **Version tags** (`v*`): tests pass → `build-backend` + `build-frontend` publish versioned images to GHCR (semver, tag, branch, and sha tags).

Backend test jobs spin up a `postgres:16` service and push the schema to `tenant_db_test` before running `bun test`. All jobs use Bun `1.1.29`.

Images are published to:
- `ghcr.io/coding-with-nox/monte-san-savino-app-backend`
- `ghcr.io/coding-with-nox/monte-san-savino-app-frontend`

## Deployment

The production `docker-compose.yml` pulls the `latest` GHCR images and wires up Postgres, MinIO, the backend, an nginx-served frontend (`:8080`), and a one-shot `db-init` job. Pulling from GHCR may require authentication:

```bash
echo "$GHCR_TOKEN" | docker login ghcr.io -u <github-username> --password-stdin
docker compose up -d
```

Deployment guides:

- `docs/stage-deploy-single-vm.md` — single-VM deployment
- `docs/stage-deploy-gcp.md` — GCP deployment
- `docs/configuration_deploy_debug.md` — configuration and debug notes
- `helm/` — Kubernetes deployment charts

## Environment Variables

### Backend

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | — | Required: JWT signing key |
| `PORT` | `3000` | API listen port |
| `NODE_ENV` | — | Skips demo seeding when set to `production` |
| `PG_HOST` | `localhost` | PostgreSQL host |
| `PG_PORT` | `5432` | PostgreSQL port |
| `PG_DB` | `tenant_db_1` | Database name |
| `PG_USER` | `postgres` | DB user |
| `PG_PASSWORD` | `postgres` | DB password |
| `MINIO_ENDPOINT` | `localhost` | MinIO endpoint |
| `MINIO_PORT` | `9000` | MinIO port |
| `MINIO_ACCESS_KEY` | — | MinIO access key |
| `MINIO_SECRET_KEY` | — | MinIO secret key |

### Frontend

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_BASE` | `/api` | API base URL (the dev server proxies `/api` to the backend) |
| `VITE_PROXY_TARGET` | `http://backend:3000` | Backend target for the Vite dev proxy |

## Roles

Access is role-based with an ascending hierarchy (`roleAtLeast` checks):

```
user < staff < judge < manager < admin
```

## API

- Swagger UI: `http://localhost:3000/docs` when running — the authoritative endpoint and schema reference
- `GET /health` for health checks
- Auth: `POST /auth/register`, `POST /auth/login` (returns `accessToken`)
- Judging: `POST /judge/vote` (requires `Authorization: Bearer <token>` and `judge` role)
- Uploads: `POST /models/:modelId/image-upload` returns a signed upload URL (requires `user` role)

See `docs/architecture.md` for the high-level design and `docs/user-manual.md` for usage.

## License

MIT
