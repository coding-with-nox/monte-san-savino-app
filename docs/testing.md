# Testing Guide

Two independent test suites:

- **Backend** — `bun test` (Bun's built-in runner), unit + integration.
- **Frontend** — `vitest` + React Testing Library + jest-dom.

Both run in CI on every PR to `main` and gate the Docker image build.

---

## Backend

Runner: the native **Bun test runner** (`bun:test`). Config lives in
`backend/package.json`:

```json
"scripts": {
  "test:setup": "PG_DB=tenant_db_test bunx drizzle-kit push",
  "test": "bun test"
}
```

### Test layout

| Kind | Location | Naming |
|------|----------|--------|
| Unit (domain) | `backend/src/<context>/domain/__tests__/` | `*.unit.test.ts` |
| Unit (application) | `backend/src/<context>/application/__tests__/` | `*.unit.test.ts` |
| Integration | `backend/src/__integration__/` | `*.test.ts` |

Examples:
`identity/domain/__tests__/Email.unit.test.ts`,
`identity/application/__tests__/RegisterUser.unit.test.ts`,
`contest/domain/__tests__/Vote.unit.test.ts`,
`__integration__/auth.login.test.ts`.

### Unit tests — hand-rolled stubs

Unit tests have **no database and no HTTP**. They exercise a domain type or an
application use case directly, passing **hand-written stubs** that implement the
use case's ports (no mocking library). For example,
`RegisterUser.unit.test.ts` builds a fake `UserRepository` and `PasswordHasher`:

```ts
function stubRepo(existing: User | null): UserRepository & { saved: User[] } {
  const saved: User[] = [];
  return {
    saved,
    findByEmail: async () => existing,
    findById: async () => null,
    save: async (user) => { saved.push(user); },
  };
}

function stubHasher(): PasswordHasher {
  return { hash: async (p) => `hashed:${p}`, verify: async () => false };
}
```

The stubs let assertions verify behavior (e.g. password is hashed before save,
`save` is not called when the email already exists). Async rejections use
`await expect(uc.execute(...)).rejects.toThrow("…")`.

### Integration tests — real Elysia app + real Postgres

Integration tests build the full Elysia app and drive it via `app.handle(...)`
with real `Request` objects — they hit the actual route handlers, middleware and
database. They **require a running PostgreSQL** with a database named
**`tenant_db_test`**.

Helpers (`backend/src/__integration__/`):

- `testApp.ts` — sets `PG_DB=tenant_db_test` (and other PG_* / `JWT_SECRET`
  defaults) **before** importing `buildApp`, exposes `buildTestApp()`,
  `postJson(app, path, body)` and `getJson(app, path, token?)`.
- `testDb.ts` — `getTestDb()` connects to `tenant_db_test`; `truncateUsers()`
  clears the `users` table between suites (used in `beforeAll` / `afterAll`).

`tenant_db_test` is a dedicated, disposable tenant database used only for tests,
kept separate from the dev tenant DB (`tenant_db_1`). Its schema is created by
pushing the Drizzle schema into it.

### Running backend tests

Prerequisite for integration tests: a Postgres instance reachable at the
configured `PG_*` (defaults `localhost:5432`, `postgres`/`postgres`), e.g. via
`docker compose up postgres`.

```bash
cd backend

# 1. One-time / when schema changes: create & migrate the test DB
bun run test:setup          # PG_DB=tenant_db_test bunx drizzle-kit push

# 2. Run everything (unit + integration)
bun test

# Run only a subset (Bun filters by path/name)
bun test src/identity/domain          # only domain unit tests
bun test src/__integration__          # only integration tests
```

> Unit tests run without any database. Integration tests under
> `src/__integration__/` will fail to connect if `tenant_db_test` does not exist
> or Postgres is down — run `bun run test:setup` and start Postgres first.

---

## Frontend

Runner: **Vitest** with **jsdom**, **React Testing Library** and
**@testing-library/jest-dom**. Config in `frontend/package.json`:

```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest"
}
```

### Test layout

| Kind | Location | Naming |
|------|----------|--------|
| Component | `frontend/src/components/__tests__/` | `*.test.tsx` |
| Page smoke | `frontend/src/pages/__tests__/` | `*.smoke.test.tsx` |

Examples: `components/__tests__/PageContainer.test.tsx`,
`components/__tests__/useToast.test.tsx`,
`pages/__tests__/Login.smoke.test.tsx`.

### Setup & helpers (`frontend/src/test/`)

- `setup.ts` — imports `@testing-library/jest-dom` (registers matchers like
  `toBeInTheDocument`). Loaded as Vitest's global setup file.
- `renderWithProviders.tsx` — wraps the UI under test in the MUI `ThemeProvider`
  (built with `buildTheme("dark", "violet")`) so components that read the theme
  render correctly:

```tsx
import { render } from "@testing-library/react";
import { ThemeProvider } from "@mui/material";
import { buildTheme } from "../lib/theme";

const theme = buildTheme("dark", "violet");
export function renderWithProviders(ui) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}
```

Use `renderWithProviders(<Component />)` instead of RTL's bare `render` for
anything that depends on the theme.

### Running frontend tests

```bash
cd frontend
bun run test         # vitest run (one-shot, CI mode)
bun run test:watch   # vitest watch mode
```

No database or backend is required — frontend tests are isolated (jsdom).

---

## CI (GitHub Actions)

Workflow: `.github/workflows/ci.yml`. Triggers on **push to `main`** and
**pull requests targeting `main`**. Three jobs:

### `test-backend`
- Spins up a **`postgres:16` service container** with
  `POSTGRES_DB=tenant_db_test`, `postgres`/`postgres`, port `5432`, with a
  `pg_isready` health check.
- Env: `PG_HOST=localhost`, `PG_PORT=5432`, `PG_USER=postgres`,
  `PG_PASSWORD=postgres`.
- Steps: checkout → set up Bun `1.1.29` → `bun install` → push schema to the
  test DB (`PG_DB=tenant_db_test bunx drizzle-kit push --force`) → `bun test`.

### `test-frontend`
- Checkout → set up Bun `1.1.29` → `bun install` → `bun run test` (vitest).
- No service container needed.

### `build-images`
- `needs: [test-backend, test-frontend]` — runs **only if both test jobs pass**.
- `if: push && ref == refs/heads/main` — pushes are gated, PRs never build images.
- Builds and pushes backend + frontend images to GHCR (tags `sha-<sha>` and
  `latest`).

**Gate summary**: a PR is green only when both `test-backend` and
`test-frontend` succeed. Image publishing additionally requires the change to be
a push to `main`. (A separate `ghcr-images.yml` workflow handles tag-release
image builds, also gated behind tests.)
