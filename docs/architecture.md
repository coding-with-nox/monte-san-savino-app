# Architecture

Miniatures Contest application ("Monte San Savino"). A full-stack web app for
running scale-model / miniature painting contests: participants enroll their
models in events, judges score them, staff handle check-in and badge printing,
and managers/admins run the back office (events, categories, awards, exports).

- **Backend**: [Bun](https://bun.sh) runtime + [Elysia](https://elysiajs.com)
  HTTP framework, [Drizzle ORM](https://orm.drizzle.team) over PostgreSQL.
- **Frontend**: React 18 + React Router 6 SPA, Material UI (Material 3 styling).
- **Storage**: MinIO (S3-compatible) for model images.
- **Auth**: email + password producing JWTs (access + refresh).
- **Tenancy**: one PostgreSQL database per tenant.

---

## 1. Overview

The system manages the full lifecycle of a miniatures contest:

| Actor    | Uses the system to… |
|----------|---------------------|
| User (participant) | Register/login, edit profile, create models, upload images, enroll models into events, pay, print own model card |
| Staff    | Check participants in at the venue, print badges (HTML + QR) |
| Judge    | See assigned events, browse judgeable models, cast ranked votes, request category changes |
| Manager  | CRUD events, categories, levels, sponsors, judge assignments, member roles, view enrollments, compute awards/rankings, run exports |
| Admin    | Everything a manager can do, plus user administration and global settings |

A single deployment serves multiple tenants, each isolated in its own database.

---

## 2. Domain Model (DDD)

The backend follows a Domain-Driven Design layering. Each bounded context is a
top-level folder under `backend/src/` and is split into three layers:

```
backend/src/<context>/
  domain/        # pure business types & rules (no I/O)
  application/   # use cases + ports (interfaces) the use case depends on
    ports/       # repository / service interfaces
  infra/         # adapters: http routes, persistence (Drizzle), crypto, tokens, storage
```

Dependencies point inward: `infra → application → domain`. The domain layer has
no framework or database imports; the application layer depends only on ports
(interfaces); concrete adapters live in `infra`.

### Bounded contexts

| Context     | Folder | Responsibility |
|-------------|--------|----------------|
| **identity**  | `identity/` | Users, roles, authentication, JWT issuance, password hashing, user profiles |
| **contest**   | `contest/`  | Events, categories, levels, models, votes, judge assignments, payments, sponsors, awards, mentions, exports, settings |
| **enrollment** | within `contest/` (`registrationsTable`, `enrollment.routes.ts`, `event.routes.ts`) | Registering a user+model into an event |
| **labels / exports** | within `contest/` (`export.routes.ts`) | XLSX / PDF / HTML exports, DYMO label data, badge & model-card printing |
| **checkin**   | within `contest/` (`staffCheckinRoutes`, `qr.routes.ts`) | Venue check-in, QR codes, printable badges |
| **tenancy**   | `tenancy/` | Per-tenant DB resolution and tenant middleware |
| **shared**    | `shared/`  | Cross-cutting infra: logger, email, object storage ports/adapters |

> Note: enrollment, labels and checkin are conceptually distinct contexts but
> are currently implemented as modules inside the `contest` context rather than
> separate top-level folders.

### Example domain types (identity)

- `domain/Email.ts` — value object; validates and normalizes (trim + lowercase).
- `domain/User.ts` — entity holding `id`, `email`, `role`, `passwordHash`,
  `isActive`, optional `tenantId`; `canLogin()` returns `isActive`.
- `domain/Role.ts` — `Role` union and `roleAtLeast(actual, minimum)`.

Application use cases (identity): `RegisterUser`, `LoginWithPassword`,
`AuthenticateUser` (PKCE). Contest use cases include `VoteModel`,
`RequestModelImageUpload`.

---

## 3. Role Hierarchy

Roles are totally ordered (least → most privileged):

```
user  <  staff  <  judge  <  manager  <  admin
```

Defined in `backend/src/identity/domain/Role.ts` and mirrored on the frontend in
`frontend/src/lib/auth.ts`. Authorization is "at least": `roleAtLeast(actual,
minimum)` compares positions in the order array, so a higher role automatically
satisfies any lower minimum.

| Role | Can do (cumulative — inherits everything below) |
|------|--------------------------------------------------|
| **user**    | Manage own profile, models and images; enroll models; pay; read public events/categories/levels/member-roles; export own enrollments / model card |
| **staff**   | Everything `user` can, plus check-in participants and print badges (`/staff/*`) |
| **judge**   | Everything `staff` can, plus view assigned events, judgeable models, cast votes, view/create category-change requests (`/judge/*`) |
| **manager** | Everything `judge` can, plus CRUD events/categories/levels/sponsors/member-roles, judge assignments, enrollments overview, awards & mentions, modification-request review, event campaigns, all exports, and user admin (`/admin/users`) |
| **admin**   | Everything `manager` can, plus global settings (`PUT /admin/settings`) |

Enforcement: the `requireRole(minimum)` middleware
(`identity/infra/http/role.middleware.ts`) returns `401` when unauthenticated
and `403` when the role is too low. Each route group declares its own minimum.

---

## 4. Authentication Flow

Two flows are supported, both ending in JWT issuance.

### Direct password login (primary)

1. `POST /auth/register` → `RegisterUser` validates email, ensures uniqueness,
   hashes the password (bcrypt), saves a `user`-role account.
2. `POST /auth/login` → `LoginWithPassword` validates credentials and issues:
   - **access token** (default TTL 86400s / 24h)
   - **refresh token** (default TTL 30 days)
   - plus `expiresIn`/`expires_in` and the user `role`.
3. The SPA stores both tokens + computed expiry in `localStorage`
   (`frontend/src/lib/auth.ts`).
4. Subsequent requests send `Authorization: Bearer <accessToken>`.

### PKCE flow (also available)

`POST /auth/authorize` (with `code_challenge`, `S256`) → returns a one-time
`code` held in an in-memory store (`pkceStore.ts`); `POST /auth/token` (with the
matching `code_verifier`, length 43–128) exchanges it for tokens.

### Token issuance & validation

`JwtTokenService` (`identity/infra/tokens/jwtTokenService.ts`) uses the `jose`
library, **HS256**, signing with `process.env.JWT_SECRET`. The payload carries
`sub`, `email`, `role`, optional `tenantId`, and a `tokenType` of `access` or
`refresh`.

- `authMiddleware` reads the `Authorization` header, verifies the JWT, and
  rejects tokens whose `tokenType` is not `access`. On success it derives
  `user = { id, email, role, tenantId }`; on any failure `user = null`.
- `POST /auth/refresh` verifies a token, requires `tokenType === "refresh"`,
  and mints a fresh access + refresh pair.

The frontend `api()` helper proactively refreshes when the access token is
within 5 minutes of expiry and retries once on a `401`/`403` (`lib/api.ts`).

TTLs are configurable via `ACCESS_TOKEN_TTL_SECONDS` /
`REFRESH_TOKEN_TTL_SECONDS`.

---

## 5. Multi-tenancy

Each tenant has its **own PostgreSQL database**. There is no shared schema with a
tenant column — isolation is at the database level.

- `tenantDbFactory.ts` builds a connection config from environment variables and
  caches one Drizzle/`pg` pool per `host:port/database/user` key.
- The selected database is `process.env.PG_DB` (default `tenant_db_1`); other
  connection parts come from `PG_HOST`, `PG_PORT`, `PG_USER`, `PG_PASSWORD`.
- `tenantMiddleware` (`tenancy/infra/http/tenant.middleware.ts`) is an Elysia
  scoped plugin that `.derive()`s `tenantDb` onto the request context. Every
  route group `.use(tenantMiddleware)` and reads `tenantDb`, falling back to
  `getTenantDbFromEnv()` when needed.

> Current state: tenant selection is environment-driven (`PG_DB`); the
> middleware always resolves the same env-configured tenant. The plumbing (token
> `tenantId`, per-tenant pool cache) is in place for per-request tenant routing
> as a future step. New tenant schemas are provisioned via
> `tenancy/infra/persistence/ensureTenantSchema.ts` and `drizzle-kit push`.

---

## 6. Backend Layer Map

| Bounded context | Domain | Application use cases | Infra adapters |
|-----------------|--------|-----------------------|----------------|
| identity | `Email`, `User`, `Role` | `RegisterUser`, `LoginWithPassword`, `AuthenticateUser` (ports: `UserRepository`, `PasswordHasher`, `TokenService`) | `identity.routes`, `user.routes`, `admin.routes`; `auth.middleware`, `role.middleware`; `userRepository.drizzle`; `bcryptHasher`; `jwtTokenService`, `pkceStore` |
| contest (models) | `Vote` | `VoteModel`, `RequestModelImageUpload` (ports: `VoteRepository`, `ModelReadRepository`, `ObjectStorage`) | `model.routes`, `modelUpload.routes`, `admin-models.routes`; `voteRepository.drizzle`, `modelReadRepository.drizzle`; `model-code` formatter |
| contest (events/categories/levels) | — | — | `event.routes`, `category.routes`, `levels.routes`, `public-categories.routes`, `member-roles.routes`, `event-campaigns.routes` |
| enrollment | — | — | `enrollment.routes` (`/enrollments`, `/admin/enrollments`, `/staff`), `event.routes` (`/events/:id/enroll`) |
| judging | — | `VoteModel` | `judge.routes`, `judge-admin.routes`, `modification-request.routes` |
| awards | — | — | `award.routes`, `special-mention.routes` |
| payments | — | — | `payment.routes` |
| labels / exports | — | — | `export.routes` (XLSX/PDF/HTML, hand-rolled zip + XLSX writer) |
| checkin | — | — | `staffCheckinRoutes` (in `enrollment.routes`), `qr.routes` |
| settings/public | — | — | `settings.routes`, `public.routes`, `sponsor.routes` |
| tenancy | — | — | `tenantDbFactory`, `tenant.middleware`, `ensureTenantSchema` |
| shared | — | port: `ObjectStorage` | `minioStorage`, `emailService`, `logger`, `logger.middleware` |

Composition root: `backend/src/bootstrap/app.ts` (`buildApp()`), started by
`bootstrap/server.ts`. Demo data is seeded by `bootstrap/seed.ts`.

---

## 7. Frontend Architecture

React 18 SPA under `frontend/src`.

- **Routing** — `react-router-dom` v6 in `App.tsx`. Route guards:
  - `Protected` redirects to `/login` when there is no token.
  - `RequireRole min="…"` redirects to `/` when the role is below the minimum.
  - Routes: `/login`, `/` (Profile), `/models`, `/public-events` (public),
    `/judge` (judge+), `/users`, `/admin`, `/labels` (manager+), `/settings`
    (admin). Navigation (top bar / drawer / mobile bottom nav) is filtered by
    role via `roleAtLeast`.
- **Shared components** (`frontend/src/components/`):
  - `PageContainer` — consistent page shell / max-width wrapper.
  - `SectionCard` — titled card surface used to group content.
  - `Field` — labelled form field wrapper.
  - `EmptyState` — placeholder for empty lists.
  - `useToast` — hook returning `show/error/success/info` plus a `node` MUI
    `Snackbar`/`Alert` to render.
- **API & auth libs** (`frontend/src/lib/`): `api.ts` (typed `fetch` wrapper with
  auto-refresh and `ApiError`), `auth.ts` (token storage, JWT decode, role
  helpers, PKCE helpers), `i18n.ts` (it/en).
- **Theme system** (`frontend/src/lib/theme.ts`): Material 3 styling via MUI.
  `buildTheme(mode, preset)` produces a theme for **3 presets** (`violet`,
  `ocean`, `forest`) × **2 modes** (`light`, `dark`) = 6 combinations. Adds M3
  surface tokens (`surfaceContainer`, `surfaceVariant`), rounded shapes, and
  component overrides. Mode/preset persist in `localStorage` and can be driven
  by server `/settings` (`appTheme`, `themePreset`).

---

## 8. Data Flow

A typical authenticated request:

```
Browser (SPA)
  │  fetch(API_BASE + path, Authorization: Bearer <access>)
  ▼
Elysia app (buildApp)
  │  loggerMiddleware → cors → swagger
  │  tenantMiddleware  → derives tenantDb (Drizzle pool for PG_DB)
  │  authMiddleware    → verifies JWT → derives user
  │  requireRole(min)  → 401/403 guard (per route group)
  ▼
Route handler (infra/http/*.routes.ts)
  │  may invoke an application use case (e.g. VoteModel)
  ▼
Use case → port (interface)
  ▼
Repository adapter (*.drizzle.ts)
  ▼
Drizzle ORM → pg Pool → PostgreSQL (tenant DB)
```

Responses are JSON by default; some endpoints return HTML (badges, print views),
SVG/PNG (QR), or XLSX binaries (exports).

---

## 9. Storage

Model images live in **MinIO** (S3-compatible), via the `ObjectStorage` port and
`MinioStorage` adapter (`shared/infra/storage/minioStorage.ts`).

- `POST /models/:modelId/image-upload` → `RequestModelImageUpload` →
  `getUploadUrl()` ensures the bucket exists and returns a **presigned PUT URL**
  (5-minute expiry) plus a public URL. The browser uploads the bytes directly to
  MinIO with that URL.
- The resulting public URL is persisted on the model as `imageUrl`
  (`modelsTable.imageUrl`) or added as a `modelImagesTable` row via
  `POST /models/:modelId/images`.
- User profile `avatarUrl` is stored as a column on `userProfilesTable`
  (`identity/infra/persistence/schema.ts`) — a plain URL string, not managed by
  the upload flow.

MinIO config: `MINIO_ENDPOINT`, `MINIO_PORT`, `MINIO_SSL`, `MINIO_ACCESS_KEY`,
`MINIO_SECRET_KEY`, `MINIO_BUCKET` (default `models`), `MINIO_PUBLIC_URL`.

---

## 10. Infrastructure

### Docker Compose (`docker-compose.yml`)

| Service  | Image | Purpose |
|----------|-------|---------|
| `postgres` | `postgres:16` | Database; init script `docker/postgres/01-init-tenant.sh` creates the tenant DB |
| `minio`    | `minio/minio` | Object storage (API `:9000`, console `:9001`) |
| `backend`  | GHCR `…-backend:latest` | Elysia API on `:3000`; waits for postgres healthy + minio |
| `frontend` | GHCR `…-frontend:latest` | Nginx-served SPA on `:8080` |
| `db-init`  | `postgres:16` | One-shot: runs `01-init-tenant.sh` then `02-test-data.sh` |

Key backend env: `JWT_SECRET`, `PG_HOST/PORT/DB/USER/PASSWORD`,
`MINIO_ENDPOINT/PORT/ACCESS_KEY/SECRET_KEY`.

### Dev override (`docker-compose.dev.yml`)

Layered on top of the base file (`docker compose -f docker-compose.yml -f
docker-compose.dev.yml up`) to replace the prebuilt images with live-reload dev
containers and add tooling:

- `backend` → `oven/bun:1.1.29`, bind-mounts `./backend`, runs `bun run dev`
  (`drizzle-kit push` + `bun --hot`).
- `frontend` → `node:20-alpine`, bind-mounts `./frontend`, runs Vite dev server
  on `:5173` (proxying to `http://backend:3000`).
- `adminer` → DB UI on `:8888`.

`docker-compose.debug.yml` adds further debug tooling. There is also a
`backend/docker-compose.yml` for backend-local use.

### Deployment

Backend and frontend ship as stateless container images (built and pushed to
GHCR by CI on `main`). PostgreSQL and MinIO are expected to be external/managed
in production.
