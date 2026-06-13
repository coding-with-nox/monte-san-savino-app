# Backend — Miniatures Contest API

Bun + Elysia API for the Monte San Savino miniatures contest. Multi-tenant, DDD-structured, PostgreSQL + MinIO backed.

## Stack

| Concern        | Tech                          |
|----------------|-------------------------------|
| Runtime        | Bun 1.1.29                    |
| HTTP framework | Elysia 1.x                    |
| ORM            | Drizzle ORM 0.36              |
| Database       | PostgreSQL 16                 |
| Object storage | MinIO (S3-compatible)         |
| Logging        | pino (+ pino-pretty in dev)   |
| JWT            | jose                          |
| Email          | resend                        |
| QR codes       | qrcode                        |
| API docs       | @elysiajs/swagger             |

## Project structure

```
src/
  identity/        — User auth bounded context
    domain/        — Email, User, Role value objects (pure, no framework imports)
    application/   — Use cases: AuthenticateUser, LoginWithPassword, RegisterUser
    infra/         — HTTP routes, Drizzle repository, JWT service
  contest/         — Model + voting bounded context (events, categories, awards, judging…)
  enrollment/      — Enrollment + team bounded context
  checkin/         — Staff check-in
  labels/          — DYMO label printing
  tenancy/         — Per-tenant DB factory + tenant middleware
  shared/          — Cross-cutting infra (logger, middleware)
  bootstrap/
    app.ts         — Elysia composition (CORS, swagger, middleware, all routes)
    server.ts      — Entry point (ensures tenant schema, listens on PORT)
    seed.ts        — Demo data seeding (dev only)
```

Each bounded context follows the same `domain / application / infra` layering.

## Scripts

| Script                     | Command                                                     | Purpose                                                       |
|----------------------------|-------------------------------------------------------------|---------------------------------------------------------------|
| `bun run dev`              | `bunx drizzle-kit push && bun --hot src/bootstrap/server.ts` | Push schema to DB, then start with hot-reload.               |
| `bun run start`            | `bun src/bootstrap/server.ts`                               | Start without hot-reload (production-style).                  |
| `bun run drizzle:generate` | `bunx drizzle-kit generate`                                 | Generate SQL migration files from schema (prod migrations).   |
| `bun run drizzle:migrate`  | `bunx drizzle-kit migrate`                                  | Apply generated migration files.                              |
| `bun run drizzle:push`     | `bunx drizzle-kit push`                                     | Push schema diff directly to DB (dev, no migration files).    |
| `bun run seed`             | `bun src/bootstrap/seed.ts`                                 | Seed demo data.                                               |
| `bun run test:setup`       | `PG_DB=tenant_db_test bunx drizzle-kit push`                | Provision the test database schema.                           |
| `bun run test`             | `bun test`                                                  | Run the test suite.                                           |

## Environment variables

| Name              | Default        | Required        | Description                                                  |
|-------------------|----------------|-----------------|--------------------------------------------------------------|
| `PORT`            | `3000`         | optional        | HTTP listen port.                                            |
| `NODE_ENV`        | —              | optional        | Set to `production` to disable dev seeding.                 |
| `JWT_SECRET`      | `change-me`    | **yes** (prod)  | HMAC secret for signing/verifying JWTs. Must be stable across restarts. |
| `PG_HOST`         | `localhost`    | optional        | PostgreSQL host. `localhost` for local dev, `postgres` inside Docker. |
| `PG_PORT`         | `5432`         | optional        | PostgreSQL port.                                            |
| `PG_USER`         | `postgres`     | optional        | PostgreSQL user.                                            |
| `PG_PASSWORD`     | `postgres`     | optional        | PostgreSQL password.                                        |
| `PG_DB`           | `tenant_db_1`  | optional        | Tenant database name. `tenant_db_test` for tests.          |
| `MINIO_ENDPOINT`  | `localhost`    | optional        | MinIO host. `localhost` for local dev, `minio` inside Docker. |
| `MINIO_PORT`      | `9000`         | optional        | MinIO API port.                                            |
| `MINIO_ACCESS_KEY`| `minioadmin`   | optional        | MinIO access key.                                          |
| `MINIO_SECRET_KEY`| `minioadmin`   | optional        | MinIO secret key.                                          |
| `CORS_ORIGIN`     | *(all)*        | optional        | Comma-separated allowed origins. Empty = allow all.        |
| `RESEND_API_KEY`  | —              | optional        | Resend API key for transactional email. If absent, reset emails are skipped. |
| `LOG_LEVEL`       | `info`         | optional        | pino log level (e.g. `debug`).                             |

## Database

Drizzle ORM drives the schema. Two workflows:

- **Dev** — `bun run drizzle:push` (also run automatically by `bun run dev`). Diffs the schema and applies changes directly. No migration files.
- **Prod** — `bun run drizzle:generate` to emit SQL migration files into `./drizzle`, then `bun run drizzle:migrate` to apply them.

Schema files live at `src/**/infra/persistence/schema.ts` (glob configured in `drizzle.config.ts`), currently:

- `src/identity/infra/persistence/schema.ts`
- `src/contest/infra/persistence/schema.ts`

Connection settings come from the `PG_*` env vars (see table above).

## Running locally

```bash
# 1. Start infrastructure (Postgres + MinIO) from the repo root
docker compose up -d postgres minio

# 2. Install dependencies
cd backend
bun install

# 3. Point the app at local services (in .env or shell)
#    PG_HOST=localhost  MINIO_ENDPOINT=localhost

# 4. Start with hot-reload (pushes schema, then serves)
bun run dev
```

API is then available at `http://localhost:3000`. In non-production mode demo data is seeded automatically on boot.

## Tests

- **Unit tests** — no database needed:
  ```bash
  bun test --grep "unit"
  ```
- **Integration tests** — require PostgreSQL. Provision the test schema first:
  ```bash
  bun run test:setup   # PG_DB=tenant_db_test drizzle-kit push
  bun test
  ```

## Swagger

Interactive API docs are auto-generated from Elysia route definitions at:

```
http://localhost:3000/docs
```

Use the **Authorize** button to paste a JWT and exercise protected endpoints.

## Architecture

Domain-Driven Design with strict layering inside each bounded context:

- **domain** — pure business types and value objects (`Email`, `User`, `Role`). No framework or I/O imports.
- **application** — use cases and ports (interfaces). Orchestrates domain logic; depends only on domain + port abstractions.
- **infra** — adapters: Elysia HTTP routes, Drizzle repositories, JWT service, MinIO storage. Implements the ports.

No framework imports leak into `domain/` or `application/`. The Elysia app is composed in `bootstrap/app.ts`, where every context's routes are registered behind the tenant and auth middleware.

## Docker (GHCR)

```bash
docker build -t ghcr.io/coding-with-nox/monte-san-savino-app-backend:latest .
```
