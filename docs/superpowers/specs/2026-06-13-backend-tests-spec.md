# Backend Tests Spec — Monte San Savino App

Date: 2026-06-13
Branch: `feat/teams-levels-displaynumber`
Runtime: Bun 1.1.29 (built-in test runner `bun test`)
Framework: Elysia 1.x, Drizzle ORM, PostgreSQL

---

## Scope

Two test layers:

1. **Unit tests** — pure domain/application logic, no I/O, no DB
2. **Integration tests** — real PostgreSQL via environment variables, HTTP routes through `buildApp()`

---

## Unit Tests

### Location
`backend/src/**/__tests__/*.unit.test.ts`

### Targets

#### `Email` value object (`identity/domain/Email.ts`)
- `create()` with valid email → normalizes to lowercase, trims whitespace
- `create()` with missing `@` → throws `"Invalid email"`
- `create()` with spaces → throws `"Invalid email"`

#### `roleAtLeast` (`identity/domain/Role.ts`)
- `"admin"` vs `"user"` → true
- `"user"` vs `"admin"` → false
- same role vs same role → true
- all 5 levels produce correct ordering

#### `Vote` domain (`contest/domain/Vote.ts`)
- construct Vote → fields set correctly, `createdAt` auto-set to now
- `changeRank()` → `rank` updated to new value

#### `AuthenticateUser` use case (`identity/application/AuthenticateUser.ts`)
- happy path: repo returns user, hasher.verify returns true → returns user
- user not found: repo returns null → throws `"Invalid credentials"`
- user disabled: user.canLogin() false → throws `"User disabled"` (or "Invalid credentials" — match actual throw)
- wrong password: hasher.verify returns false → throws `"Invalid credentials"`
- Uses in-memory stubs (implement `UserRepository` and `PasswordHasher` interfaces inline)

#### `LoginWithPassword` use case (`identity/application/LoginWithPassword.ts`)
- happy path: returns `{ accessToken, refreshToken, expiresIn, role }`
- user not found → throws
- wrong password → throws
- Token payloads contain `sub`, `email`, `role`

#### `RegisterUser` use case (`identity/application/RegisterUser.ts`)
- happy path: repo.save called with hashed password, returns `{ id, email, role }`
- duplicate email: repo.findByEmail returns existing user → throws `"Email already registered"`
- default role is `"user"` when not provided

### Stubs pattern

```ts
// Inline stub — no mocking library needed
const stubRepo = {
  findByEmail: async () => null,
  findById: async () => null,
  save: async () => {},
} satisfies UserRepository;
```

---

## Integration Tests

### Location
`backend/src/__integration__/*.test.ts`

### Setup

- Target DB: `tenant_db_test` (separate from dev `tenant_db_1`)
- All env vars set in test file via `process.env` overrides before importing app
- Run `drizzle-kit push` to create schema in test DB before suite
- Use `beforeAll` to truncate `users` table; `afterAll` to close pool

### Test DB helper
```ts
// backend/src/__integration__/testDb.ts
import { getTenantDb } from "../../src/tenancy/infra/tenantDbFactory";
export function getTestDb() {
  return getTenantDb({
    host: process.env.PG_HOST ?? "localhost",
    port: Number(process.env.PG_PORT ?? "5432"),
    database: "tenant_db_test",
    user: process.env.PG_USER ?? "postgres",
    password: process.env.PG_PASSWORD ?? "postgres",
  });
}
```

### HTTP test helper
Use Elysia's built-in `.handle()` method — no real network required:

```ts
import { buildApp } from "../../src/bootstrap/app";
const app = buildApp();
const res = await app.handle(new Request("http://localhost/auth/register", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "test@example.com", password: "password123" }),
}));
```

### Covered Routes

#### Auth (`/auth`)
| Route | Cases |
|-------|-------|
| `POST /auth/register` | success 200, duplicate 400, short password 400 |
| `POST /auth/login` | success 200 (returns tokens), wrong password 401, nonexistent user 401 |
| `POST /auth/refresh` | valid refresh token → new access token |

#### Enrollment flow (if enrollment route structure allows simple setup)
| Route | Cases |
|-------|-------|
| `GET /auth/me` (or user profile) | 401 without token, 200 with valid JWT |

### Env vars for test run
```
PG_HOST=localhost
PG_PORT=5432
PG_USER=postgres
PG_PASSWORD=postgres
PG_DB=tenant_db_test
```

---

## Test Commands

```bash
# Unit tests only
bun test --grep "\.unit\."

# Integration tests (requires running postgres)
bun test --grep "integration"

# All tests
bun test
```

Test file pattern for `bun test`: `**/*.test.ts`

---

## Schema Setup for Integration Tests

Since `drizzle-kit push` handles schema creation, add a `test:setup` npm script:

```json
"test:setup": "PG_DB=tenant_db_test bunx drizzle-kit push",
"test": "bun test"
```

---

## Non-Goals

- No test for MinIO upload in this phase
- No test for PKCE flow in this phase
- No test for judge voting routes in this phase
- No mocking library (use hand-written stubs)
