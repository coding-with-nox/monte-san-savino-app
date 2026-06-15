# Backend Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add unit + integration tests for backend domain/application layer and auth HTTP routes using Bun's built-in test runner.

**Architecture:** Unit tests use hand-written port stubs, no DB. Integration tests use a real `tenant_db_test` PostgreSQL database, calling routes via Elysia's `.handle()` method.

**Tech Stack:** Bun 1.1.29 test runner, Elysia 1.x, Drizzle ORM, PostgreSQL 16

---

## File Map

Files to **create**:

| Path | Responsibility |
|------|---------------|
| `backend/src/identity/domain/__tests__/Email.unit.test.ts` | Unit tests for `Email` value object |
| `backend/src/identity/domain/__tests__/Role.unit.test.ts` | Unit tests for `roleAtLeast` |
| `backend/src/contest/domain/__tests__/Vote.unit.test.ts` | Unit tests for `Vote` domain entity |
| `backend/src/identity/application/__tests__/AuthenticateUser.unit.test.ts` | Unit tests for `AuthenticateUser` use case with stubs |
| `backend/src/identity/application/__tests__/LoginWithPassword.unit.test.ts` | Unit tests for `LoginWithPassword` use case with stubs |
| `backend/src/identity/application/__tests__/RegisterUser.unit.test.ts` | Unit tests for `RegisterUser` use case with stubs |
| `backend/src/__integration__/testDb.ts` | Helper: returns a Drizzle instance pointed at `tenant_db_test` |
| `backend/src/__integration__/testApp.ts` | Helper: builds the Elysia app with test env vars pre-set |
| `backend/src/__integration__/auth.register.test.ts` | Integration tests for `POST /auth/register` |
| `backend/src/__integration__/auth.login.test.ts` | Integration tests for `POST /auth/login` and `POST /auth/refresh` |
| `backend/src/__integration__/auth.protected.test.ts` | Integration test for protected route (`GET /users/profile`) |

Files to **modify**:

| Path | Change |
|------|--------|
| `backend/package.json` | Add `"test"` and `"test:setup"` scripts |

---

## Task 1: Add test scripts to `backend/package.json`

**Files:**
- Modify: `backend/package.json`

- [ ] **Step 1: Add the two scripts**

Open `backend/package.json` and add the following two entries inside `"scripts"`:

```json
"test:setup": "PG_DB=tenant_db_test bunx drizzle-kit push",
"test": "bun test"
```

The full `"scripts"` block becomes:

```json
"scripts": {
  "dev": "bunx drizzle-kit push && bun --hot src/bootstrap/server.ts",
  "start": "bun src/bootstrap/server.ts",
  "drizzle:generate": "bunx drizzle-kit generate",
  "drizzle:migrate": "bunx drizzle-kit migrate",
  "drizzle:push": "bunx drizzle-kit push",
  "seed": "bun src/bootstrap/seed.ts",
  "test:setup": "PG_DB=tenant_db_test bunx drizzle-kit push",
  "test": "bun test"
}
```

- [ ] **Step 2: Verify the file is valid JSON**

Run from the `backend/` directory:

```bash
bun -e "import p from './package.json'; console.log(p.scripts.test)"
```

Expected output:
```
bun test
```

- [ ] **Step 3: Commit**

```bash
git add backend/package.json
git commit -m "chore(backend): add test and test:setup scripts"
```

---

## Task 2: Unit tests — `Email` value object

**Files:**
- Create: `backend/src/identity/domain/__tests__/Email.unit.test.ts`

- [ ] **Step 1: Create the test file**

Create `backend/src/identity/domain/__tests__/Email.unit.test.ts`:

```ts
import { describe, it, expect } from "bun:test";
import { Email } from "../Email";

describe("Email.unit.create", () => {
  it("accepts a valid email and lowercases it", () => {
    const email = Email.create("User@Example.COM");
    expect(email.value).toBe("user@example.com");
  });

  it("trims leading and trailing whitespace", () => {
    const email = Email.create("  hello@world.io  ");
    expect(email.value).toBe("hello@world.io");
  });

  it("throws 'Invalid email' when @ is missing", () => {
    expect(() => Email.create("notanemail")).toThrow("Invalid email");
  });

  it("throws 'Invalid email' when input contains spaces after trim fails regex", () => {
    expect(() => Email.create("bad email@domain.com")).toThrow("Invalid email");
  });

  it("throws 'Invalid email' for empty string", () => {
    expect(() => Email.create("")).toThrow("Invalid email");
  });
});
```

- [ ] **Step 2: Run and verify**

```bash
bun test src/identity/domain/__tests__/Email.unit.test.ts
```

Expected output:
```
5 pass, 0 fail
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/identity/domain/__tests__/Email.unit.test.ts
git commit -m "test(identity): unit tests for Email value object"
```

---

## Task 3: Unit tests — `roleAtLeast`

**Files:**
- Create: `backend/src/identity/domain/__tests__/Role.unit.test.ts`

- [ ] **Step 1: Create the test file**

Create `backend/src/identity/domain/__tests__/Role.unit.test.ts`:

```ts
import { describe, it, expect } from "bun:test";
import { roleAtLeast } from "../Role";

describe("roleAtLeast.unit", () => {
  it("admin is at least user", () => {
    expect(roleAtLeast("admin", "user")).toBe(true);
  });

  it("user is NOT at least admin", () => {
    expect(roleAtLeast("user", "admin")).toBe(false);
  });

  it("same role satisfies itself", () => {
    expect(roleAtLeast("judge", "judge")).toBe(true);
    expect(roleAtLeast("staff", "staff")).toBe(true);
    expect(roleAtLeast("manager", "manager")).toBe(true);
  });

  it("ordering: user < staff < judge < manager < admin", () => {
    const roles = ["user", "staff", "judge", "manager", "admin"] as const;
    for (let i = 0; i < roles.length; i++) {
      for (let j = 0; j <= i; j++) {
        expect(roleAtLeast(roles[i], roles[j])).toBe(true);
      }
      for (let j = i + 1; j < roles.length; j++) {
        expect(roleAtLeast(roles[i], roles[j])).toBe(false);
      }
    }
  });
});
```

- [ ] **Step 2: Run and verify**

```bash
bun test src/identity/domain/__tests__/Role.unit.test.ts
```

Expected: 4 pass, 0 fail

- [ ] **Step 3: Commit**

```bash
git add backend/src/identity/domain/__tests__/Role.unit.test.ts
git commit -m "test(identity): unit tests for roleAtLeast"
```

---

## Task 4: Unit tests — `Vote` domain entity

**Files:**
- Create: `backend/src/contest/domain/__tests__/Vote.unit.test.ts`

- [ ] **Step 1: Create the test file**

Create `backend/src/contest/domain/__tests__/Vote.unit.test.ts`:

```ts
import { describe, it, expect } from "bun:test";
import { Vote } from "../Vote";

describe("Vote.unit", () => {
  it("constructs with all fields set correctly", () => {
    const before = new Date();
    const vote = new Vote("v1", "judge-1", "model-1", 2);
    const after = new Date();

    expect(vote.id).toBe("v1");
    expect(vote.judgeId).toBe("judge-1");
    expect(vote.modelId).toBe("model-1");
    expect(vote.rank).toBe(2);
    expect(vote.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(vote.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it("accepts an explicit createdAt date", () => {
    const date = new Date("2024-01-15T10:00:00Z");
    const vote = new Vote("v2", "judge-2", "model-2", 0, date);
    expect(vote.createdAt).toBe(date);
  });

  it("changeRank updates the rank", () => {
    const vote = new Vote("v3", "judge-3", "model-3", 1);
    vote.changeRank(3);
    expect(vote.rank).toBe(3);
  });

  it("changeRank to 0 sets rank to 0", () => {
    const vote = new Vote("v4", "judge-4", "model-4", 3);
    vote.changeRank(0);
    expect(vote.rank).toBe(0);
  });
});
```

- [ ] **Step 2: Run and verify**

```bash
bun test src/contest/domain/__tests__/Vote.unit.test.ts
```

Expected: 4 pass, 0 fail

- [ ] **Step 3: Commit**

```bash
git add backend/src/contest/domain/__tests__/Vote.unit.test.ts
git commit -m "test(contest): unit tests for Vote domain entity"
```

---

## Task 5: Unit tests — `AuthenticateUser` use case

**Files:**
- Create: `backend/src/identity/application/__tests__/AuthenticateUser.unit.test.ts`

Context: `AuthenticateUser` depends on `UserRepository` and `PasswordHasher`. `User` constructor: `new User(id, email, role, passwordHash, isActive)`. `user.canLogin()` returns `user.isActive`.

- [ ] **Step 1: Create the test file**

Create `backend/src/identity/application/__tests__/AuthenticateUser.unit.test.ts`:

```ts
import { describe, it, expect } from "bun:test";
import { AuthenticateUser } from "../AuthenticateUser";
import { Email } from "../../domain/Email";
import { User } from "../../domain/User";
import type { UserRepository } from "../ports/UserRepository";
import type { PasswordHasher } from "../ports/PasswordHasher";

function makeActiveUser(): User {
  return new User("uid-1", Email.create("alice@example.com"), "user", "hashed-pw", true);
}

function makeDisabledUser(): User {
  return new User("uid-2", Email.create("bob@example.com"), "user", "hashed-pw", false);
}

function stubRepo(user: User | null): UserRepository {
  return {
    findByEmail: async () => user,
    findById: async () => null,
    save: async () => {},
  } satisfies UserRepository;
}

function stubHasher(result: boolean): PasswordHasher {
  return {
    hash: async (plain) => plain,
    verify: async () => result,
  } satisfies PasswordHasher;
}

describe("AuthenticateUser.unit", () => {
  it("returns the user when credentials are correct", async () => {
    const user = makeActiveUser();
    const uc = new AuthenticateUser(stubRepo(user), stubHasher(true));
    const result = await uc.execute({ email: "alice@example.com", password: "correct" });
    expect(result).toBe(user);
  });

  it("throws 'Invalid credentials' when user is not found", async () => {
    const uc = new AuthenticateUser(stubRepo(null), stubHasher(true));
    expect(uc.execute({ email: "nobody@example.com", password: "pw" })).rejects.toThrow("Invalid credentials");
  });

  it("throws when user is disabled (canLogin returns false)", async () => {
    const user = makeDisabledUser();
    const uc = new AuthenticateUser(stubRepo(user), stubHasher(true));
    expect(uc.execute({ email: "bob@example.com", password: "pw" })).rejects.toThrow();
  });

  it("throws 'Invalid credentials' when password is wrong", async () => {
    const user = makeActiveUser();
    const uc = new AuthenticateUser(stubRepo(user), stubHasher(false));
    expect(uc.execute({ email: "alice@example.com", password: "wrong" })).rejects.toThrow("Invalid credentials");
  });
});
```

- [ ] **Step 2: Run and verify**

```bash
bun test src/identity/application/__tests__/AuthenticateUser.unit.test.ts
```

Expected: 4 pass, 0 fail

- [ ] **Step 3: Commit**

```bash
git add backend/src/identity/application/__tests__/AuthenticateUser.unit.test.ts
git commit -m "test(identity): unit tests for AuthenticateUser use case"
```

---

## Task 6: Unit tests — `LoginWithPassword` use case

**Files:**
- Create: `backend/src/identity/application/__tests__/LoginWithPassword.unit.test.ts`

Context: additionally depends on `TokenService` (`signAccess`, `signRefresh`, `verify`). Returns `{ accessToken, refreshToken, expiresIn, role }`.

- [ ] **Step 1: Create the test file**

Create `backend/src/identity/application/__tests__/LoginWithPassword.unit.test.ts`:

```ts
import { describe, it, expect } from "bun:test";
import { LoginWithPassword } from "../LoginWithPassword";
import { Email } from "../../domain/Email";
import { User } from "../../domain/User";
import type { UserRepository } from "../ports/UserRepository";
import type { PasswordHasher } from "../ports/PasswordHasher";
import type { TokenService } from "../ports/TokenService";

function makeActiveUser(): User {
  return new User("uid-1", Email.create("alice@example.com"), "judge", "hashed-pw", true);
}

function stubRepo(user: User | null): UserRepository {
  return {
    findByEmail: async () => user,
    findById: async () => null,
    save: async () => {},
  } satisfies UserRepository;
}

function stubHasher(result: boolean): PasswordHasher {
  return {
    hash: async (plain) => plain,
    verify: async () => result,
  } satisfies PasswordHasher;
}

function stubTokens(): TokenService {
  return {
    signAccess: async (payload) => ({ token: `access.${payload.sub}.${payload.role}`, expiresIn: 86400 }),
    signRefresh: async (payload) => ({ token: `refresh.${payload.sub}`, expiresIn: 2592000 }),
    verify: async () => ({}),
  } satisfies TokenService;
}

describe("LoginWithPassword.unit", () => {
  it("returns accessToken, refreshToken, expiresIn and role on success", async () => {
    const user = makeActiveUser();
    const uc = new LoginWithPassword(stubRepo(user), stubHasher(true), stubTokens());
    const result = await uc.execute({ email: "alice@example.com", password: "correct" });

    expect(result.accessToken).toBe("access.uid-1.judge");
    expect(result.refreshToken).toBe("refresh.uid-1");
    expect(result.expiresIn).toBe(86400);
    expect(result.role).toBe("judge");
  });

  it("throws when user not found", async () => {
    const uc = new LoginWithPassword(stubRepo(null), stubHasher(true), stubTokens());
    expect(uc.execute({ email: "ghost@example.com", password: "pw" })).rejects.toThrow();
  });

  it("throws 'Invalid credentials' when password is wrong", async () => {
    const user = makeActiveUser();
    const uc = new LoginWithPassword(stubRepo(user), stubHasher(false), stubTokens());
    expect(uc.execute({ email: "alice@example.com", password: "bad" })).rejects.toThrow("Invalid credentials");
  });

  it("token payload contains sub, email, role", async () => {
    const user = makeActiveUser();
    const payloads: Array<{ sub: string; email: string; role: string }> = [];
    const capturingTokens: TokenService = {
      signAccess: async (p) => { payloads.push(p); return { token: "tok", expiresIn: 1 }; },
      signRefresh: async (p) => { payloads.push(p); return { token: "ref", expiresIn: 1 }; },
      verify: async () => ({}),
    };
    const uc = new LoginWithPassword(stubRepo(user), stubHasher(true), capturingTokens);
    await uc.execute({ email: "alice@example.com", password: "pw" });

    expect(payloads.length).toBe(2);
    for (const p of payloads) {
      expect(p.sub).toBe("uid-1");
      expect(p.email).toBe("alice@example.com");
      expect(p.role).toBe("judge");
    }
  });
});
```

- [ ] **Step 2: Run and verify**

```bash
bun test src/identity/application/__tests__/LoginWithPassword.unit.test.ts
```

Expected: 4 pass, 0 fail

- [ ] **Step 3: Commit**

```bash
git add backend/src/identity/application/__tests__/LoginWithPassword.unit.test.ts
git commit -m "test(identity): unit tests for LoginWithPassword use case"
```

---

## Task 7: Unit tests — `RegisterUser` use case

**Files:**
- Create: `backend/src/identity/application/__tests__/RegisterUser.unit.test.ts`

- [ ] **Step 1: Create the test file**

Create `backend/src/identity/application/__tests__/RegisterUser.unit.test.ts`:

```ts
import { describe, it, expect } from "bun:test";
import { RegisterUser } from "../RegisterUser";
import { Email } from "../../domain/Email";
import { User } from "../../domain/User";
import type { UserRepository } from "../ports/UserRepository";
import type { PasswordHasher } from "../ports/PasswordHasher";

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
  return {
    hash: async (plain) => `hashed:${plain}`,
    verify: async () => false,
  } satisfies PasswordHasher;
}

describe("RegisterUser.unit", () => {
  it("saves user with hashed password and returns id, email, role", async () => {
    const repo = stubRepo(null);
    const uc = new RegisterUser(repo, stubHasher());
    const result = await uc.execute({ id: "new-id", email: "new@example.com", password: "plaintext" });

    expect(result.id).toBe("new-id");
    expect(result.email).toBe("new@example.com");
    expect(result.role).toBe("user");
    expect(repo.saved).toHaveLength(1);
    expect(repo.saved[0].passwordHash).toBe("hashed:plaintext");
  });

  it("defaults role to 'user' when not provided", async () => {
    const repo = stubRepo(null);
    const uc = new RegisterUser(repo, stubHasher());
    const result = await uc.execute({ id: "id-2", email: "x@example.com", password: "pw" });
    expect(result.role).toBe("user");
  });

  it("uses the provided role when given", async () => {
    const repo = stubRepo(null);
    const uc = new RegisterUser(repo, stubHasher());
    const result = await uc.execute({ id: "id-3", email: "admin@example.com", password: "pw", role: "admin" });
    expect(result.role).toBe("admin");
  });

  it("throws 'Email already registered' when email is taken", async () => {
    const existing = new User("old-id", Email.create("taken@example.com"), "user", "h", true);
    const repo = stubRepo(existing);
    const uc = new RegisterUser(repo, stubHasher());
    expect(uc.execute({ id: "new-id", email: "taken@example.com", password: "pw" })).rejects.toThrow("Email already registered");
  });

  it("does not call save when email is already registered", async () => {
    const existing = new User("old-id", Email.create("taken@example.com"), "user", "h", true);
    const repo = stubRepo(existing);
    const uc = new RegisterUser(repo, stubHasher());
    try { await uc.execute({ id: "new-id", email: "taken@example.com", password: "pw" }); } catch {}
    expect(repo.saved).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run and verify**

```bash
bun test src/identity/application/__tests__/RegisterUser.unit.test.ts
```

Expected: 5 pass, 0 fail

- [ ] **Step 3: Run all unit tests**

```bash
bun test --grep "\.unit\."
```

Expected: all unit tests pass (22 total), 0 fail.

- [ ] **Step 4: Commit**

```bash
git add backend/src/identity/application/__tests__/RegisterUser.unit.test.ts
git commit -m "test(identity): unit tests for RegisterUser use case"
```

---

## Task 8: Integration test helpers (`testDb.ts` + `testApp.ts`)

**Files:**
- Create: `backend/src/__integration__/testDb.ts`
- Create: `backend/src/__integration__/testApp.ts`

- [ ] **Step 1: Create `testDb.ts`**

Create `backend/src/__integration__/testDb.ts`:

```ts
import { getTenantDb } from "../tenancy/infra/tenantDbFactory";
import { usersTable } from "../identity/infra/persistence/schema";

export function getTestDb() {
  return getTenantDb({
    host: process.env.PG_HOST ?? "localhost",
    port: Number(process.env.PG_PORT ?? "5432"),
    database: "tenant_db_test",
    user: process.env.PG_USER ?? "postgres",
    password: process.env.PG_PASSWORD ?? "postgres",
  });
}

export async function truncateUsers() {
  const db = getTestDb();
  await db.delete(usersTable);
}
```

- [ ] **Step 2: Create `testApp.ts`**

Create `backend/src/__integration__/testApp.ts`:

```ts
// Set env vars BEFORE importing buildApp so tenantMiddleware and JwtTokenService
// pick them up from the module-level environment.
process.env.PG_DB = "tenant_db_test";
process.env.PG_HOST ??= "localhost";
process.env.PG_PORT ??= "5432";
process.env.PG_USER ??= "postgres";
process.env.PG_PASSWORD ??= "postgres";
process.env.JWT_SECRET ??= "test-secret";

import { buildApp } from "../bootstrap/app";

export function buildTestApp() {
  return buildApp();
}

export async function postJson(
  app: ReturnType<typeof buildApp>,
  path: string,
  body: unknown
): Promise<Response> {
  return app.handle(
    new Request(`http://localhost${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

export async function getJson(
  app: ReturnType<typeof buildApp>,
  path: string,
  token?: string
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return app.handle(
    new Request(`http://localhost${path}`, { method: "GET", headers })
  );
}
```

- [ ] **Step 3: Push schema to test DB (requires PostgreSQL running)**

```bash
PG_DB=tenant_db_test bunx drizzle-kit push
```

Expected: `[✓] Changes applied`

- [ ] **Step 4: Commit**

```bash
git add backend/src/__integration__/testDb.ts backend/src/__integration__/testApp.ts
git commit -m "test(integration): add testDb and testApp helpers"
```

---

## Task 9: Integration tests — `POST /auth/register`

**Files:**
- Create: `backend/src/__integration__/auth.register.test.ts`

- [ ] **Step 1: Create the test file**

Create `backend/src/__integration__/auth.register.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { buildTestApp, postJson } from "./testApp";
import { truncateUsers } from "./testDb";

const app = buildTestApp();

describe("integration POST /auth/register", () => {
  beforeAll(async () => { await truncateUsers(); });
  afterAll(async () => { await truncateUsers(); });

  it("registers a new user and returns id, email, role", async () => {
    const res = await postJson(app, "/auth/register", {
      email: "register-test@example.com",
      password: "password123",
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { id: string; email: string; role: string };
    expect(body.email).toBe("register-test@example.com");
    expect(body.role).toBe("user");
    expect(typeof body.id).toBe("string");
    expect(body.id.length).toBeGreaterThan(0);
  });

  it("returns 400 when password is shorter than 8 characters", async () => {
    const res = await postJson(app, "/auth/register", {
      email: "short-pw@example.com",
      password: "abc123",
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toContain("8");
  });

  it("returns 400 when email is already registered", async () => {
    await postJson(app, "/auth/register", {
      email: "duplicate@example.com",
      password: "password123",
    });
    const res = await postJson(app, "/auth/register", {
      email: "duplicate@example.com",
      password: "password456",
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toContain("already");
  });
});
```

- [ ] **Step 2: Run and verify**

```bash
bun test src/__integration__/auth.register.test.ts
```

Expected: 3 pass, 0 fail

- [ ] **Step 3: Commit**

```bash
git add backend/src/__integration__/auth.register.test.ts
git commit -m "test(integration): POST /auth/register integration tests"
```

---

## Task 10: Integration tests — `POST /auth/login` and `POST /auth/refresh`

**Files:**
- Create: `backend/src/__integration__/auth.login.test.ts`

- [ ] **Step 1: Create the test file**

Create `backend/src/__integration__/auth.login.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { buildTestApp, postJson } from "./testApp";
import { truncateUsers } from "./testDb";

const app = buildTestApp();
const TEST_EMAIL = "login-test@example.com";
const TEST_PASSWORD = "password123";

describe("integration POST /auth/login", () => {
  beforeAll(async () => {
    await truncateUsers();
    await postJson(app, "/auth/register", { email: TEST_EMAIL, password: TEST_PASSWORD });
  });
  afterAll(async () => { await truncateUsers(); });

  it("returns accessToken, refreshToken, expiresIn and role on valid credentials", async () => {
    const res = await postJson(app, "/auth/login", { email: TEST_EMAIL, password: TEST_PASSWORD });
    expect(res.status).toBe(200);
    const body = await res.json() as { accessToken: string; refreshToken: string; expiresIn: number; role: string };
    expect(typeof body.accessToken).toBe("string");
    expect(body.accessToken.length).toBeGreaterThan(0);
    expect(typeof body.refreshToken).toBe("string");
    expect(typeof body.expiresIn).toBe("number");
    expect(body.expiresIn).toBeGreaterThan(0);
    expect(body.role).toBe("user");
  });

  it("returns 401 on wrong password", async () => {
    const res = await postJson(app, "/auth/login", { email: TEST_EMAIL, password: "wrongpassword" });
    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toContain("credentials");
  });

  it("returns 401 when user does not exist", async () => {
    const res = await postJson(app, "/auth/login", { email: "nobody@example.com", password: "somepassword" });
    expect(res.status).toBe(401);
  });
});

describe("integration POST /auth/refresh", () => {
  let refreshToken: string;

  beforeAll(async () => {
    await truncateUsers();
    await postJson(app, "/auth/register", { email: TEST_EMAIL, password: TEST_PASSWORD });
    const loginRes = await postJson(app, "/auth/login", { email: TEST_EMAIL, password: TEST_PASSWORD });
    const loginBody = await loginRes.json() as { refreshToken: string };
    refreshToken = loginBody.refreshToken;
  });
  afterAll(async () => { await truncateUsers(); });

  it("returns new accessToken and refreshToken given a valid refresh token", async () => {
    const res = await postJson(app, "/auth/refresh", { refreshToken });
    expect(res.status).toBe(200);
    const body = await res.json() as { accessToken: string; refreshToken: string; role: string };
    expect(typeof body.accessToken).toBe("string");
    expect(body.accessToken.length).toBeGreaterThan(0);
    expect(body.role).toBe("user");
  });

  it("returns 401 when refresh token is invalid", async () => {
    const res = await postJson(app, "/auth/refresh", { refreshToken: "not.a.valid.token" });
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run and verify**

```bash
bun test src/__integration__/auth.login.test.ts
```

Expected: 5 pass, 0 fail

- [ ] **Step 3: Commit**

```bash
git add backend/src/__integration__/auth.login.test.ts
git commit -m "test(integration): POST /auth/login and /auth/refresh integration tests"
```

---

## Task 11: Integration test — protected route (`GET /users/profile`)

**Files:**
- Create: `backend/src/__integration__/auth.protected.test.ts`

- [ ] **Step 1: Create the test file**

Create `backend/src/__integration__/auth.protected.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { buildTestApp, postJson, getJson } from "./testApp";
import { truncateUsers } from "./testDb";

const app = buildTestApp();
const TEST_EMAIL = "protected-test@example.com";
const TEST_PASSWORD = "password123";

describe("integration GET /users/profile (protected route)", () => {
  let accessToken: string;

  beforeAll(async () => {
    await truncateUsers();
    await postJson(app, "/auth/register", { email: TEST_EMAIL, password: TEST_PASSWORD });
    const loginRes = await postJson(app, "/auth/login", { email: TEST_EMAIL, password: TEST_PASSWORD });
    const loginBody = await loginRes.json() as { accessToken: string };
    accessToken = loginBody.accessToken;
  });
  afterAll(async () => { await truncateUsers(); });

  it("returns 401 when no Authorization header is sent", async () => {
    const res = await getJson(app, "/users/profile");
    expect(res.status).toBe(401);
  });

  it("returns 401 when Authorization header contains a garbage token", async () => {
    const res = await getJson(app, "/users/profile", "garbage.token.value");
    expect(res.status).toBe(401);
  });

  it("returns 200 when a valid JWT is provided", async () => {
    const res = await getJson(app, "/users/profile", accessToken);
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run and verify**

```bash
bun test src/__integration__/auth.protected.test.ts
```

Expected: 3 pass, 0 fail

- [ ] **Step 3: Run all tests**

```bash
cd backend && bun test
```

Expected: all tests pass (~35 total), 0 fail.

- [ ] **Step 4: Commit**

```bash
git add backend/src/__integration__/auth.protected.test.ts
git commit -m "test(integration): protected route 401/200 test for GET /users/profile"
```
