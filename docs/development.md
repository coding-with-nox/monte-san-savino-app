# Development Guide

Full setup for the Monte San Savino contest app (Bun/Elysia backend + React/Vite frontend), from a clean machine to a productive dev loop.

See also: [`backend/README.md`](../backend/README.md), [`frontend/README.md`](../frontend/README.md), [`configuration_deploy_debug.md`](./configuration_deploy_debug.md).

---

## 1. Prerequisites

- **Docker Desktop** — runs Postgres 16, MinIO, and (optionally) the whole stack.
- **Bun** ≥ 1.1.29 — backend runtime; also runs frontend scripts.
- **Node.js** ≥ 20 — optional alternative for frontend tooling (`npm`).
- **PowerShell** (Windows) — for `start.ps1`.

---

## 2. Clone and start services

```powershell
git clone <repo-url>
cd monte-san-savino-app
```

### Option A — full stack via convenience script

```powershell
./start.ps1
```

This runs `docker compose -f docker-compose.yml -f docker-compose.dev.yml up`, bringing up Postgres, MinIO, Adminer, and source-mounted backend + frontend containers with hot-reload.

### Option B — infrastructure only (run apps on host)

```powershell
docker compose up -d postgres minio
```

Then run backend and frontend on the host (see §4). When running on the host, set
`PG_HOST=localhost` and `MINIO_ENDPOINT=localhost` in your `.env`.

URLs once up:

| Service        | URL                              |
|----------------|----------------------------------|
| Frontend (dev) | http://localhost:5173            |
| Backend API    | http://localhost:3000            |
| Swagger UI     | http://localhost:3000/docs       |
| MinIO console  | http://localhost:9001            |
| Adminer (dev)  | http://localhost:8888            |

---

## 3. First-run setup

- **Tenant schema** — `server.ts` calls `ensureTenantSchema()` on boot, and `bun run dev` runs `drizzle-kit push` first, so tables are created automatically.
- **Seed admin / demo data** — in non-production mode the server seeds demo data on startup. To seed manually:
  ```bash
  cd backend
  bun run seed
  ```
- **Create the first event** — log in with a seeded admin account, open **Admin**, and create an event + categories. The public catalogue then appears under **Public Events**.

---

## 4. Dev workflow

### Backend (hot-reload)

```bash
cd backend
bun install
bun run dev     # drizzle push + bun --hot → http://localhost:3000
```

`bun --hot` reloads on source changes. Use `LOG_LEVEL=debug` for verbose logs.

### Frontend (Vite HMR)

```bash
cd frontend
bun install     # or: npm install
bun run dev     # → http://localhost:5173, HMR enabled
```

`/api/*` requests are proxied to the backend (`VITE_PROXY_TARGET`, default `http://localhost:3000`).

---

## 5. Adding a new page (frontend)

1. Create the component under `src/pages/`, e.g. `Sponsors.tsx`. Follow the existing
   page pattern: accept `{ language }`, wrap content in `PageContainer` / `SectionCard`,
   fetch via `api(...)`, show `EmptyState` when empty, surface errors with `useToast`.
2. Register the route in `App.tsx` inside `<Routes>`, wrapping with guards as needed:
   ```tsx
   <Route path="/sponsors" element={
     <Protected><RequireRole min="manager"><Sponsors language={language} /></RequireRole></Protected>
   } />
   ```
3. Add a nav entry to `allNavItems` (and, if it belongs on mobile, `bottomNavItems`)
   with the right `minRole`. Items are filtered by `roleAtLeast`.
4. Add any new labels to `lib/i18n.ts` for both `it` and `en`.

Roles, ascending: `user` < `judge` < `manager` < `admin`.

## 6. Adding a new API route (backend)

1. **Domain / application** — if new behaviour is involved, add domain types under the
   context's `domain/` and a use case under `application/` (depends only on domain +
   a repository **port** interface). Keep these framework-free.
2. **Repository** — implement the port with a Drizzle adapter under
   `infra/persistence/`. Add tables to that context's `schema.ts` if needed.
3. **Route** — add an Elysia router under `infra/http/` (e.g. `sponsor.routes.ts`),
   with `detail.tags` + `response` schemas so Swagger documents it.
4. **Register** the router in `src/bootstrap/app.ts` via `.use(yourRoutes)`.
5. **Sync schema** — `bun run drizzle:push` (dev) or generate + migrate (prod).

## 7. Adding tests

- **Backend unit test** (no DB) — instantiate the use case with an in-memory stub
  implementing the repository port; assert behaviour. Run with `bun test --grep "unit"`.
- **Backend integration test** (DB required) — provision the test schema once with
  `bun run test:setup` (`PG_DB=tenant_db_test`), drive the app through a `testApp`
  helper, then `bun test`.
- **Frontend** — render with `renderWithProviders` from `src/test/`, query with RTL,
  drive interactions with `@testing-library/user-event`. Run `bun run test` (jsdom).

---

## 8. Common errors and fixes

| Symptom                              | Likely cause                                   | Fix                                                        |
|--------------------------------------|------------------------------------------------|------------------------------------------------------------|
| `ECONNREFUSED` to Postgres           | `PG_HOST=postgres` while running on the host    | Set `PG_HOST=localhost` in `.env`.                         |
| MinIO connection refused             | `MINIO_ENDPOINT=minio` while running on host    | Set `MINIO_ENDPOINT=localhost` in `.env`.                  |
| MinIO bucket missing                 | Bucket not created on first upload              | Ensure MinIO is up; the backend creates the bucket on demand — check console at :9001. |
| 401 after a restart                  | `JWT_SECRET` changed between runs               | Pin a fixed `JWT_SECRET` in `.env`.                        |
| Tables missing                       | Schema not pushed                               | Run `bun run drizzle:push` (or just `bun run dev`).        |
| Port 5432 already in use             | A local Postgres is already running             | `docker compose stop postgres` or change the host port.    |
| `/api` calls 404 in dev              | Backend not running / wrong proxy target        | Start backend; check `VITE_PROXY_TARGET`.                  |
