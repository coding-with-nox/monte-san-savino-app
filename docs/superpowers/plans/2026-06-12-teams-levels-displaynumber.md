# Teams Refactor + Levels + DisplayNumber — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove standalone Teams system, add inline team members on models, add configurable levels, implement displayNumber logic and new model code format.

**Architecture:** Schema-first approach — update Drizzle schema.ts (type safety) + ensureTenantSchema.ts (actual DB migration via raw SQL). Backend routes before frontend. No test infrastructure in project — verify via `curl` commands after each backend task.

**Tech Stack:** Bun + Elysia + Drizzle ORM + PostgreSQL (backend); React + TypeScript + MUI (frontend); raw SQL migrations in `ensureTenantSchema.ts`.

**Spec:** `docs/superpowers/specs/2026-06-12-teams-levels-displaynumber-design.md`

---

## File Map

| File | Action |
|------|--------|
| `backend/src/contest/infra/persistence/schema.ts` | Modify: add/remove tables and columns |
| `backend/src/tenancy/infra/persistence/ensureTenantSchema.ts` | Modify: raw SQL migrations |
| `backend/src/bootstrap/seed.ts` | Modify: add levels + memberRoles seed |
| `backend/src/contest/infra/http/team.routes.ts` | **DELETE** |
| `backend/src/contest/infra/http/team-roles.routes.ts` | **DELETE** |
| `backend/src/bootstrap/app.ts` | Modify: remove team imports, add new routes |
| `backend/src/contest/infra/http/levels.routes.ts` | **CREATE** |
| `backend/src/contest/infra/http/member-roles.routes.ts` | **CREATE** |
| `backend/src/contest/infra/http/model-code.ts` | Modify: new format function |
| `backend/src/contest/infra/http/model.routes.ts` | Modify: levelId, displayNumber, isTeam, teamMembers |
| `backend/src/contest/infra/http/admin-models.routes.ts` | Modify: remove teamId, add levelId/displayNumber |
| `backend/src/contest/infra/http/export.routes.ts` | Modify: remove team imports, add new fields |
| `frontend/src/App.tsx` | Modify: remove Teams route/nav/import |
| `frontend/src/pages/Teams.tsx` | **DELETE** |
| `frontend/src/lib/i18n.ts` | Modify: add new translation keys |
| `frontend/src/pages/Models.tsx` | Modify: add levelId, isTeam, teamMembers UI |
| `frontend/src/pages/Admin.tsx` | Modify: add Levels + MemberRoles sections |

---

## Task 1: Update Drizzle Schema

**Files:**
- Modify: `backend/src/contest/infra/persistence/schema.ts`

- [ ] **Step 1: Replace schema.ts content**

Replace `backend/src/contest/infra/persistence/schema.ts` with:

```typescript
import { pgTable, uuid, text, integer, timestamp, boolean, uniqueIndex, index, serial } from "drizzle-orm/pg-core";

// REMOVED: teamsTable, teamMembersTable, teamRolesTable

export const levelsTable = pgTable("levels", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order")
});

export const memberRolesTable = pgTable("member_roles", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull()
});

export const eventsTable = pgTable("events", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  status: text("status").default("accepted").notNull(),
  startDate: text("start_date"),
  endDate: text("end_date")
});

export const categoriesTable = pgTable("categories", {
  id: uuid("id").primaryKey(),
  eventId: uuid("event_id").notNull(),
  name: text("name").notNull(),
  status: text("status").default("open").notNull(),
  seqId: serial("seq_id").notNull()
});

export const eventCampaignsTable = pgTable("event_campaigns", {
  id: uuid("id").primaryKey(),
  eventId: uuid("event_id").notNull(),
  name: text("name").notNull(),
  enrollmentOpenDate: text("enrollment_open_date"),
  enrollmentCloseDate: text("enrollment_close_date")
});

export const registrationsTable = pgTable("registrations", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id").notNull(),
  eventId: uuid("event_id").notNull(),
  modelId: uuid("model_id"),
  categoryId: uuid("category_id"),
  status: text("status").notNull(),
  checkedIn: boolean("checked_in").default(false).notNull()
});

export const modelsTable = pgTable("models", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id").notNull(),
  categoryId: uuid("category_id").notNull(),
  levelId: uuid("level_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  code: integer("code"),
  imageUrl: text("image_url"),
  isTeam: boolean("is_team").default(false).notNull(),
  displayNumber: integer("display_number")
}, (t) => ({
  uniqCode: uniqueIndex("ux_models_code").on(t.code)
}));

export const modelTeamMembersTable = pgTable("model_team_members", {
  id: uuid("id").primaryKey(),
  modelId: uuid("model_id").notNull(),
  name: text("name").notNull(),
  surname: text("surname").notNull(),
  role: text("role").notNull()
});

export const modelImagesTable = pgTable("model_images", {
  id: uuid("id").primaryKey(),
  modelId: uuid("model_id").notNull(),
  url: text("url").notNull()
});

export const votesTable = pgTable("votes", {
  id: uuid("id").primaryKey(),
  judgeId: uuid("judge_id").notNull(),
  modelId: uuid("model_id").notNull(),
  rank: integer("rank").notNull(),
  createdAt: timestamp("created_at").defaultNow()
}, (t) => ({
  byJudgeModel: index("ix_votes_judge_model").on(t.judgeId, t.modelId),
  byModelCreatedAt: index("ix_votes_model_created_at").on(t.modelId, t.createdAt)
}));

export const judgeAssignmentsTable = pgTable("judge_assignments", {
  id: uuid("id").primaryKey(),
  eventId: uuid("event_id").notNull(),
  judgeId: uuid("judge_id").notNull(),
  categoryId: uuid("category_id")
}, (t) => ({
  uniq: uniqueIndex("ux_judge_event").on(t.eventId, t.judgeId)
}));

export const paymentsTable = pgTable("payments", {
  id: uuid("id").primaryKey(),
  registrationId: uuid("registration_id").notNull(),
  amount: integer("amount").notNull(),
  status: text("status").notNull(),
  providerRef: text("provider_ref"),
  createdAt: timestamp("created_at").defaultNow()
});

export const sponsorsTable = pgTable("sponsors", {
  id: uuid("id").primaryKey(),
  eventId: uuid("event_id").notNull(),
  name: text("name").notNull(),
  logoUrl: text("logo_url"),
  websiteUrl: text("website_url"),
  description: text("description"),
  tier: text("tier").default("bronze").notNull()
});

export const specialMentionsTable = pgTable("special_mentions", {
  id: uuid("id").primaryKey(),
  eventId: uuid("event_id").notNull(),
  modelId: uuid("model_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  awardedBy: uuid("awarded_by").notNull(),
  createdAt: timestamp("created_at").defaultNow()
});

export const modificationRequestsTable = pgTable("modification_requests", {
  id: uuid("id").primaryKey(),
  modelId: uuid("model_id").notNull(),
  judgeId: uuid("judge_id").notNull(),
  reason: text("reason").notNull(),
  suggestedCategoryId: uuid("suggested_category_id"),
  status: text("status").default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow()
});

export const settingsTable = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow()
});
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/contest/infra/persistence/schema.ts
git commit -m "feat(schema): remove team tables, add levels/memberRoles/modelTeamMembers, update models+categories"
```

---

## Task 2: DB Migration (ensureTenantSchema.ts)

**Files:**
- Modify: `backend/src/tenancy/infra/persistence/ensureTenantSchema.ts`

- [ ] **Step 1: Append migration SQL at end of `ensureTenantSchema` function, before the `finally` block**

Add these queries in sequence after the existing ones:

```typescript
    // Remove old team tables
    await pool.query(`DROP TABLE IF EXISTS team_members CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS teams CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS team_roles CASCADE;`);

    // Add levels table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS levels (
        id uuid PRIMARY KEY,
        name text NOT NULL,
        sort_order integer
      );
    `);

    // Add member_roles table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS member_roles (
        id uuid PRIMARY KEY,
        name text NOT NULL
      );
    `);

    // Add model_team_members table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS model_team_members (
        id uuid PRIMARY KEY,
        model_id uuid NOT NULL,
        name text NOT NULL,
        surname text NOT NULL,
        role text NOT NULL
      );
    `);

    // Add seqId to categories
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'categories' AND column_name = 'seq_id'
        ) THEN
          ALTER TABLE categories ADD COLUMN seq_id serial NOT NULL;
        END IF;
      END $$;
    `);

    // Add levelId, displayNumber, isTeam to models; remove teamId
    await pool.query(`
      ALTER TABLE IF EXISTS models
        ADD COLUMN IF NOT EXISTS level_id uuid,
        ADD COLUMN IF NOT EXISTS display_number integer,
        ADD COLUMN IF NOT EXISTS is_team boolean NOT NULL DEFAULT false;
    `);
    await pool.query(`
      ALTER TABLE IF EXISTS models
        DROP COLUMN IF EXISTS team_id;
    `);
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/tenancy/infra/persistence/ensureTenantSchema.ts
git commit -m "feat(migration): add levels, member_roles, model_team_members; update models+categories columns"
```

---

## Task 3: Seed Levels and Member Roles

**Files:**
- Modify: `backend/src/bootstrap/seed.ts`

- [ ] **Step 1: Add imports and seed data after the sponsors block**

Add import at top of file:
```typescript
import { levelsTable, memberRolesTable } from "../contest/infra/persistence/schema";
```

Add after the sponsors insert (before the console.log lines):
```typescript
  // --- Levels ---
  await db.insert(levelsTable).values([
    { id: crypto.randomUUID(), name: "Junior", sortOrder: 1 },
    { id: crypto.randomUUID(), name: "Senior", sortOrder: 2 },
    { id: crypto.randomUUID(), name: "Open", sortOrder: 3 },
    { id: crypto.randomUUID(), name: "Master", sortOrder: 4 }
  ]);

  // --- Member Roles ---
  await db.insert(memberRolesTable).values([
    { id: crypto.randomUUID(), name: "Pilota" },
    { id: crypto.randomUUID(), name: "Co-pilota" },
    { id: crypto.randomUUID(), name: "Meccanico" },
    { id: crypto.randomUUID(), name: "Navigatore" }
  ]);
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/bootstrap/seed.ts
git commit -m "feat(seed): add initial levels and member roles"
```

---

## Task 4: Remove Team Routes from Backend

**Files:**
- Modify: `backend/src/bootstrap/app.ts`
- Delete: `backend/src/contest/infra/http/team.routes.ts`
- Delete: `backend/src/contest/infra/http/team-roles.routes.ts`

- [ ] **Step 1: Remove team imports and `.use()` calls from `app.ts`**

In `backend/src/bootstrap/app.ts`, remove these lines:
```typescript
import { teamRoutes } from "../contest/infra/http/team.routes";
// and
import { teamRolesRoutes, teamRolesPublicRoutes } from "../contest/infra/http/team-roles.routes";
// and the corresponding .use() calls:
.use(teamRoutes)
.use(teamRolesRoutes)
.use(teamRolesPublicRoutes)
```

Also remove from swagger tags array:
```typescript
{ name: "Teams", description: "Gestione team." },
```

- [ ] **Step 2: Delete team route files**

```bash
rm backend/src/contest/infra/http/team.routes.ts
rm backend/src/contest/infra/http/team-roles.routes.ts
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: remove standalone team routes and files"
```

---

## Task 5: Create Admin Levels Routes

**Files:**
- Create: `backend/src/contest/infra/http/levels.routes.ts`
- Modify: `backend/src/bootstrap/app.ts`

- [ ] **Step 1: Create `levels.routes.ts`**

```typescript
import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";
import { requireRole } from "../../../identity/infra/http/role.middleware";
import { tenantMiddleware } from "../../../tenancy/infra/http/tenant.middleware";
import { levelsTable } from "../persistence/schema";

export const adminLevelsRoutes = new Elysia({ prefix: "/admin/levels" })
  .use(tenantMiddleware)
  .use(requireRole("manager"))
  .get("/", async ({ tenantDb }) => {
    return tenantDb
      .select()
      .from(levelsTable)
      .orderBy(levelsTable.sortOrder, levelsTable.name);
  }, {
    detail: { summary: "Lista livelli", tags: ["Admin"], security: [{ bearerAuth: [] }] }
  })
  .post("/", async ({ tenantDb, body }) => {
    const id = crypto.randomUUID();
    await tenantDb.insert(levelsTable).values({ id, name: body.name, sortOrder: body.sortOrder ?? null });
    return { id };
  }, {
    body: t.Object({ name: t.String(), sortOrder: t.Optional(t.Number()) }),
    detail: { summary: "Crea livello", tags: ["Admin"], security: [{ bearerAuth: [] }] }
  })
  .put("/:id", async ({ tenantDb, params, body, set }) => {
    const rows = await tenantDb.select().from(levelsTable).where(eq(levelsTable.id, params.id as any));
    if (!rows.length) { set.status = 404; return { error: "Not found" }; }
    await tenantDb.update(levelsTable).set(body).where(eq(levelsTable.id, params.id as any));
    return { updated: true };
  }, {
    params: t.Object({ id: t.String() }),
    body: t.Object({ name: t.Optional(t.String()), sortOrder: t.Optional(t.Number()) }),
    detail: { summary: "Aggiorna livello", tags: ["Admin"], security: [{ bearerAuth: [] }] }
  })
  .delete("/:id", async ({ tenantDb, params, set }) => {
    const rows = await tenantDb.select().from(levelsTable).where(eq(levelsTable.id, params.id as any));
    if (!rows.length) { set.status = 404; return { error: "Not found" }; }
    await tenantDb.delete(levelsTable).where(eq(levelsTable.id, params.id as any));
    return { deleted: true };
  }, {
    params: t.Object({ id: t.String() }),
    detail: { summary: "Elimina livello", tags: ["Admin"], security: [{ bearerAuth: [] }] }
  });

export const publicLevelsRoutes = new Elysia({ prefix: "/public/levels" })
  .use(tenantMiddleware)
  .use(requireRole("user"))
  .get("/", async ({ tenantDb }) => {
    return tenantDb
      .select()
      .from(levelsTable)
      .orderBy(levelsTable.sortOrder, levelsTable.name);
  }, {
    detail: { summary: "Lista livelli (pubblico)", tags: ["Public"], security: [{ bearerAuth: [] }] }
  });
```

- [ ] **Step 2: Add to `app.ts`**

Add import:
```typescript
import { adminLevelsRoutes, publicLevelsRoutes } from "../contest/infra/http/levels.routes";
```

Add `.use()` calls after `adminModelsRoutes`:
```typescript
.use(adminLevelsRoutes)
.use(publicLevelsRoutes)
```

- [ ] **Step 3: Manual test** (replace `TOKEN` with a valid admin JWT from `POST /auth/login`)

```bash
# Get token
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@contest.it","password":"Admin123!"}' | jq -r '.token')

# Create level
curl -s -X POST http://localhost:3000/admin/levels \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Level","sortOrder":99}' | jq

# List levels
curl -s http://localhost:3000/admin/levels \
  -H "Authorization: Bearer $TOKEN" | jq
```

Expected: `{ "id": "<uuid>" }` on POST, array with the new level on GET.

- [ ] **Step 4: Commit**

```bash
git add backend/src/contest/infra/http/levels.routes.ts backend/src/bootstrap/app.ts
git commit -m "feat(backend): add admin and public levels routes"
```

---

## Task 6: Create Admin Member Roles Routes

**Files:**
- Create: `backend/src/contest/infra/http/member-roles.routes.ts`
- Modify: `backend/src/bootstrap/app.ts`

- [ ] **Step 1: Create `member-roles.routes.ts`**

```typescript
import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";
import { requireRole } from "../../../identity/infra/http/role.middleware";
import { tenantMiddleware } from "../../../tenancy/infra/http/tenant.middleware";
import { memberRolesTable } from "../persistence/schema";

export const adminMemberRolesRoutes = new Elysia({ prefix: "/admin/member-roles" })
  .use(tenantMiddleware)
  .use(requireRole("manager"))
  .get("/", async ({ tenantDb }) => {
    return tenantDb.select().from(memberRolesTable).orderBy(memberRolesTable.name);
  }, {
    detail: { summary: "Lista ruoli membri", tags: ["Admin"], security: [{ bearerAuth: [] }] }
  })
  .post("/", async ({ tenantDb, body }) => {
    const id = crypto.randomUUID();
    await tenantDb.insert(memberRolesTable).values({ id, name: body.name });
    return { id };
  }, {
    body: t.Object({ name: t.String() }),
    detail: { summary: "Crea ruolo membro", tags: ["Admin"], security: [{ bearerAuth: [] }] }
  })
  .put("/:id", async ({ tenantDb, params, body, set }) => {
    const rows = await tenantDb.select().from(memberRolesTable).where(eq(memberRolesTable.id, params.id as any));
    if (!rows.length) { set.status = 404; return { error: "Not found" }; }
    await tenantDb.update(memberRolesTable).set({ name: body.name }).where(eq(memberRolesTable.id, params.id as any));
    return { updated: true };
  }, {
    params: t.Object({ id: t.String() }),
    body: t.Object({ name: t.String() }),
    detail: { summary: "Aggiorna ruolo membro", tags: ["Admin"], security: [{ bearerAuth: [] }] }
  })
  .delete("/:id", async ({ tenantDb, params, set }) => {
    const rows = await tenantDb.select().from(memberRolesTable).where(eq(memberRolesTable.id, params.id as any));
    if (!rows.length) { set.status = 404; return { error: "Not found" }; }
    await tenantDb.delete(memberRolesTable).where(eq(memberRolesTable.id, params.id as any));
    return { deleted: true };
  }, {
    params: t.Object({ id: t.String() }),
    detail: { summary: "Elimina ruolo membro", tags: ["Admin"], security: [{ bearerAuth: [] }] }
  });

export const publicMemberRolesRoutes = new Elysia({ prefix: "/public/member-roles" })
  .use(tenantMiddleware)
  .use(requireRole("user"))
  .get("/", async ({ tenantDb }) => {
    return tenantDb.select().from(memberRolesTable).orderBy(memberRolesTable.name);
  }, {
    detail: { summary: "Lista ruoli membri (pubblico)", tags: ["Public"], security: [{ bearerAuth: [] }] }
  });
```

- [ ] **Step 2: Add to `app.ts`**

Add import:
```typescript
import { adminMemberRolesRoutes, publicMemberRolesRoutes } from "../contest/infra/http/member-roles.routes";
```

Add `.use()` calls after `adminLevelsRoutes`:
```typescript
.use(adminMemberRolesRoutes)
.use(publicMemberRolesRoutes)
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/contest/infra/http/member-roles.routes.ts backend/src/bootstrap/app.ts
git commit -m "feat(backend): add admin and public member-roles routes"
```

---

## Task 7: Update model-code.ts — New Format

**Files:**
- Modify: `backend/src/contest/infra/http/model-code.ts`

The new format: `M{categorySeqId}-{displayNumber zero-padded}-{code}` (e.g., `M2-0315-865`).
The padding width for `displayNumber` is read from settings key `displayNumberPadding` (default 4).

- [ ] **Step 1: Replace `model-code.ts`**

```typescript
import { eq } from "drizzle-orm";
import { settingsTable } from "../persistence/schema";

const DEFAULT_DISPLAY_PADDING = 4;
const MIN_PADDING = 1;
const MAX_PADDING = 10;

export function normalizeDisplayNumberPadding(value?: string | null): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return DEFAULT_DISPLAY_PADDING;
  return Math.min(MAX_PADDING, Math.max(MIN_PADDING, parsed));
}

export type ModelCodeFormat = {
  displayNumberPadding: number;
};

export function formatModelCode(
  code: number | null | undefined,
  categorySeqId: number | null | undefined,
  displayNumber: number | null | undefined,
  format: ModelCodeFormat
): string {
  if (code === null || code === undefined) return "";
  if (categorySeqId === null || categorySeqId === undefined) return "";
  if (displayNumber === null || displayNumber === undefined) return "";
  const numCode = Math.max(0, Math.trunc(Number(code)));
  const numDisplay = Math.max(0, Math.trunc(Number(displayNumber)));
  const numCat = Math.max(0, Math.trunc(Number(categorySeqId)));
  const paddedDisplay = String(numDisplay).padStart(format.displayNumberPadding, "0");
  return `M${numCat}-${paddedDisplay}-${numCode}`;
}

export async function loadModelCodeFormatSettings(tenantDb: any): Promise<ModelCodeFormat> {
  const [paddingRow] = await tenantDb
    .select({ value: settingsTable.value })
    .from(settingsTable)
    .where(eq(settingsTable.key, "displayNumberPadding" as any))
    .limit(1);

  return {
    displayNumberPadding: normalizeDisplayNumberPadding(paddingRow?.value)
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/contest/infra/http/model-code.ts
git commit -m "feat(model-code): replace format with M{catSeqId}-{displayNumber}-{code} pattern"
```

---

## Task 8: Update model.routes.ts

**Files:**
- Modify: `backend/src/contest/infra/http/model.routes.ts`

- [ ] **Step 1: Replace `model.routes.ts`**

```typescript
import { Elysia, t } from "elysia";
import { and, desc, eq, ilike, isNotNull, max } from "drizzle-orm";
import { requireRole } from "../../../identity/infra/http/role.middleware";
import { tenantMiddleware } from "../../../tenancy/infra/http/tenant.middleware";
import { formatModelCode, loadModelCodeFormatSettings } from "./model-code";
import { modelsTable, modelImagesTable, modelTeamMembersTable, categoriesTable } from "../persistence/schema";

async function getCategorySeqId(tenantDb: any, categoryId: string): Promise<number | null> {
  const [row] = await tenantDb
    .select({ seqId: categoriesTable.seqId })
    .from(categoriesTable)
    .where(eq(categoriesTable.id, categoryId as any))
    .limit(1);
  return row?.seqId ?? null;
}

async function computeDisplayNumber(tenantDb: any, userId: string, categoryId: string, levelId: string): Promise<number> {
  // Reuse existing displayNumber for same combo (userId, categoryId, levelId)
  const [existing] = await tenantDb
    .select({ displayNumber: modelsTable.displayNumber })
    .from(modelsTable)
    .where(and(
      eq(modelsTable.userId, userId as any),
      eq(modelsTable.categoryId, categoryId as any),
      eq(modelsTable.levelId, levelId as any),
      isNotNull(modelsTable.displayNumber)
    ))
    .limit(1);

  if (existing?.displayNumber != null) return existing.displayNumber;

  // New combo: assign next sequential number within the event
  const [catRow] = await tenantDb
    .select({ eventId: categoriesTable.eventId })
    .from(categoriesTable)
    .where(eq(categoriesTable.id, categoryId as any))
    .limit(1);

  if (!catRow) return 1;

  const eventCategories = await tenantDb
    .select({ id: categoriesTable.id })
    .from(categoriesTable)
    .where(eq(categoriesTable.eventId, catRow.eventId as any));

  const eventCategoryIds = eventCategories.map((r: any) => r.id);
  if (eventCategoryIds.length === 0) return 1;

  // Find max displayNumber among all models in this event
  let maxDisplay = 0;
  for (const catId of eventCategoryIds) {
    const [maxRow] = await tenantDb
      .select({ displayNumber: modelsTable.displayNumber })
      .from(modelsTable)
      .where(and(
        eq(modelsTable.categoryId, catId as any),
        isNotNull(modelsTable.displayNumber)
      ))
      .orderBy(desc(modelsTable.displayNumber))
      .limit(1);
    if (maxRow?.displayNumber != null && maxRow.displayNumber > maxDisplay) {
      maxDisplay = maxRow.displayNumber;
    }
  }

  return maxDisplay + 1;
}

async function generateModelCode(tenantDb: any): Promise<number> {
  const [maxRow] = await tenantDb
    .select({ code: modelsTable.code })
    .from(modelsTable)
    .where(isNotNull(modelsTable.code))
    .orderBy(desc(modelsTable.code))
    .limit(1);
  return Number(maxRow?.code ?? 0) + 1;
}

function isCodeConflict(err: unknown): boolean {
  const msg = String((err as any)?.message ?? "");
  return msg.includes("ux_models_code") || msg.includes("models_code_key");
}

export const modelRoutes = new Elysia({ prefix: "/models" })
  .use(tenantMiddleware)
  .use(requireRole("user"))
  .get("/", async ({ tenantDb, user, query }) => {
    const search = query?.search ? String(query.search) : null;
    const clauses = [eq(modelsTable.userId, user!.id as any)];
    if (search) clauses.push(ilike(modelsTable.name, `%${search}%`));
    const codeFormat = await loadModelCodeFormatSettings(tenantDb);
    const rows = await tenantDb
      .select({
        id: modelsTable.id,
        name: modelsTable.name,
        description: modelsTable.description,
        code: modelsTable.code,
        categoryId: modelsTable.categoryId,
        levelId: modelsTable.levelId,
        imageUrl: modelsTable.imageUrl,
        isTeam: modelsTable.isTeam,
        displayNumber: modelsTable.displayNumber,
        categorySeqId: categoriesTable.seqId
      })
      .from(modelsTable)
      .leftJoin(categoriesTable, eq(categoriesTable.id, modelsTable.categoryId))
      .where(and(...clauses));
    return rows.map((row: any) => ({
      ...row,
      code: formatModelCode(row.code, row.categorySeqId, row.displayNumber, codeFormat) || null
    }));
  }, {
    detail: { summary: "Lista modelli", tags: ["Models"], security: [{ bearerAuth: [] }] }
  })
  .post("/", async ({ tenantDb, user, body }) => {
    const modelId = crypto.randomUUID();
    let lastError: unknown = null;
    const codeFormat = await loadModelCodeFormatSettings(tenantDb);
    const displayNumber = await computeDisplayNumber(tenantDb, user!.id, body.categoryId, body.levelId);
    const categorySeqId = await getCategorySeqId(tenantDb, body.categoryId);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = await generateModelCode(tenantDb);
      try {
        await tenantDb.insert(modelsTable).values({
          id: modelId,
          userId: user!.id as any,
          categoryId: body.categoryId,
          levelId: body.levelId,
          name: body.name,
          description: body.description ?? null,
          code,
          imageUrl: body.imageUrl ?? null,
          isTeam: body.isTeam ?? false,
          displayNumber
        });

        if (body.isTeam && body.teamMembers?.length) {
          await tenantDb.insert(modelTeamMembersTable).values(
            body.teamMembers.map((m: any) => ({
              id: crypto.randomUUID(),
              modelId,
              name: m.name,
              surname: m.surname,
              role: m.role
            }))
          );
        }

        return {
          id: modelId,
          code: formatModelCode(code, categorySeqId, displayNumber, codeFormat)
        };
      } catch (err) {
        if (!isCodeConflict(err)) throw err;
        lastError = err;
      }
    }

    throw lastError ?? new Error("Unable to generate model code");
  }, {
    body: t.Object({
      name: t.String(),
      categoryId: t.String(),
      levelId: t.String(),
      description: t.Optional(t.String()),
      imageUrl: t.Optional(t.String()),
      isTeam: t.Optional(t.Boolean()),
      teamMembers: t.Optional(t.Array(t.Object({
        name: t.String(),
        surname: t.String(),
        role: t.String()
      })))
    }),
    detail: { summary: "Crea modello", tags: ["Models"], security: [{ bearerAuth: [] }] }
  })
  .get("/:modelId", async ({ tenantDb, user, params, set }) => {
    const rows = await tenantDb
      .select({
        id: modelsTable.id,
        name: modelsTable.name,
        description: modelsTable.description,
        code: modelsTable.code,
        categoryId: modelsTable.categoryId,
        levelId: modelsTable.levelId,
        imageUrl: modelsTable.imageUrl,
        isTeam: modelsTable.isTeam,
        displayNumber: modelsTable.displayNumber,
        categorySeqId: categoriesTable.seqId
      })
      .from(modelsTable)
      .leftJoin(categoriesTable, eq(categoriesTable.id, modelsTable.categoryId))
      .where(and(eq(modelsTable.id, params.modelId as any), eq(modelsTable.userId, user!.id as any)));

    if (!rows.length) { set.status = 404; return { error: "Not found" }; }

    const codeFormat = await loadModelCodeFormatSettings(tenantDb);
    const images = await tenantDb
      .select()
      .from(modelImagesTable)
      .where(eq(modelImagesTable.modelId, params.modelId as any));
    const teamMembers = await tenantDb
      .select()
      .from(modelTeamMembersTable)
      .where(eq(modelTeamMembersTable.modelId, params.modelId as any));

    const row = rows[0] as any;
    return {
      model: {
        ...row,
        code: formatModelCode(row.code, row.categorySeqId, row.displayNumber, codeFormat) || null
      },
      images,
      teamMembers
    };
  }, {
    params: t.Object({ modelId: t.String() }),
    detail: { summary: "Dettaglio modello", tags: ["Models"], security: [{ bearerAuth: [] }] }
  })
  .put("/:modelId", async ({ tenantDb, user, params, body, set }) => {
    const rows = await tenantDb
      .select()
      .from(modelsTable)
      .where(and(eq(modelsTable.id, params.modelId as any), eq(modelsTable.userId, user!.id as any)));

    if (!rows.length) { set.status = 404; return { error: "Not found" }; }

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.categoryId !== undefined) updateData.categoryId = body.categoryId;
    if (body.levelId !== undefined) updateData.levelId = body.levelId;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.imageUrl !== undefined) updateData.imageUrl = body.imageUrl;
    if (body.isTeam !== undefined) updateData.isTeam = body.isTeam;

    await tenantDb.update(modelsTable).set(updateData).where(eq(modelsTable.id, params.modelId as any));

    if (body.teamMembers !== undefined) {
      await tenantDb.delete(modelTeamMembersTable).where(eq(modelTeamMembersTable.modelId, params.modelId as any));
      if (body.teamMembers.length > 0) {
        await tenantDb.insert(modelTeamMembersTable).values(
          body.teamMembers.map((m: any) => ({
            id: crypto.randomUUID(),
            modelId: params.modelId,
            name: m.name,
            surname: m.surname,
            role: m.role
          }))
        );
      }
    }

    return { updated: true };
  }, {
    params: t.Object({ modelId: t.String() }),
    body: t.Object({
      name: t.Optional(t.String()),
      categoryId: t.Optional(t.String()),
      levelId: t.Optional(t.String()),
      description: t.Optional(t.String()),
      imageUrl: t.Optional(t.String()),
      isTeam: t.Optional(t.Boolean()),
      teamMembers: t.Optional(t.Array(t.Object({
        name: t.String(),
        surname: t.String(),
        role: t.String()
      })))
    }),
    detail: { summary: "Aggiorna modello", tags: ["Models"], security: [{ bearerAuth: [] }] }
  })
  .delete("/:modelId", async ({ tenantDb, user, params, set }) => {
    const rows = await tenantDb
      .select()
      .from(modelsTable)
      .where(and(eq(modelsTable.id, params.modelId as any), eq(modelsTable.userId, user!.id as any)));

    if (!rows.length) { set.status = 404; return { error: "Not found" }; }

    await tenantDb.delete(modelTeamMembersTable).where(eq(modelTeamMembersTable.modelId, params.modelId as any));
    await tenantDb.delete(modelImagesTable).where(eq(modelImagesTable.modelId, params.modelId as any));
    await tenantDb.delete(modelsTable).where(eq(modelsTable.id, params.modelId as any));
    return { deleted: true };
  }, {
    params: t.Object({ modelId: t.String() }),
    detail: { summary: "Elimina modello", tags: ["Models"], security: [{ bearerAuth: [] }] }
  })
  .post("/:modelId/images", async ({ tenantDb, user, params, body, set }) => {
    const rows = await tenantDb
      .select()
      .from(modelsTable)
      .where(and(eq(modelsTable.id, params.modelId as any), eq(modelsTable.userId, user!.id as any)));
    if (!rows.length) { set.status = 404; return { error: "Not found" }; }
    const imageId = crypto.randomUUID();
    await tenantDb.insert(modelImagesTable).values({ id: imageId, modelId: params.modelId, url: body.url });
    return { id: imageId };
  }, {
    params: t.Object({ modelId: t.String() }),
    body: t.Object({ url: t.String() }),
    detail: { summary: "Aggiungi immagine", tags: ["Models"], security: [{ bearerAuth: [] }] }
  })
  .delete("/:modelId/images/:imageId", async ({ tenantDb, user, params, set }) => {
    const rows = await tenantDb
      .select()
      .from(modelsTable)
      .where(and(eq(modelsTable.id, params.modelId as any), eq(modelsTable.userId, user!.id as any)));
    if (!rows.length) { set.status = 404; return { error: "Not found" }; }
    await tenantDb.delete(modelImagesTable).where(and(
      eq(modelImagesTable.id, params.imageId as any),
      eq(modelImagesTable.modelId, params.modelId as any)
    ));
    return { deleted: true };
  }, {
    params: t.Object({ modelId: t.String(), imageId: t.String() }),
    detail: { summary: "Elimina immagine", tags: ["Models"], security: [{ bearerAuth: [] }] }
  });
```

- [ ] **Step 2: Manual test**

```bash
# Create model with level and team
LEVEL_ID=$(curl -s http://localhost:3000/public/levels \
  -H "Authorization: Bearer $TOKEN" | jq -r '.[0].id')

curl -s -X POST http://localhost:3000/models \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Test Model\",\"categoryId\":\"<cat-id>\",\"levelId\":\"$LEVEL_ID\",\"isTeam\":true,\"teamMembers\":[{\"name\":\"Mario\",\"surname\":\"Rossi\",\"role\":\"Pilota\"}]}" | jq
```

Expected: `{ "id": "<uuid>", "code": "M1-0001-1" }` (or similar with actual seqId values).

- [ ] **Step 3: Commit**

```bash
git add backend/src/contest/infra/http/model.routes.ts
git commit -m "feat(model-routes): add levelId, displayNumber, isTeam, teamMembers support"
```

---

## Task 9: Update admin-models.routes.ts

**Files:**
- Modify: `backend/src/contest/infra/http/admin-models.routes.ts`

- [ ] **Step 1: Update imports and select fields**

In `admin-models.routes.ts`, update imports to remove `teamsTable` and add new fields:

```typescript
// Replace the import line:
import { categoriesTable, modelsTable } from "../persistence/schema";
// Remove usersTable.seqId usage, add categoriesTable.seqId
```

Update the select in both branches (with and without `eventId`). Replace `teamId` and `userSeqId` usage:

```typescript
// In both .select() calls, replace:
//   teamId: modelsTable.teamId,
//   userSeqId: usersTable.seqId
// With:
//   levelId: modelsTable.levelId,
//   displayNumber: modelsTable.displayNumber,
//   isTeam: modelsTable.isTeam,
//   categorySeqId: categoriesTable.seqId
```

Update the `.leftJoin(usersTable, ...)` — keep it if `userId` is still selected (it is). Add inner join to `categoriesTable` in the no-eventId branch:

```typescript
// no-eventId branch: add left join to categories
.leftJoin(categoriesTable, eq(categoriesTable.id, modelsTable.categoryId))
```

Update `formatModelCode` calls from `formatModelCode(row.code, row.userSeqId, codeFormat)` to:
```typescript
formatModelCode(row.code, row.categorySeqId, row.displayNumber, codeFormat)
```

Remove unused `usersTable` import if `seqId` was the only field used (keep if `userId` resolution still needs it — check: `userId` is directly on `modelsTable`, so `usersTable` join can be removed entirely from this route).

- [ ] **Step 2: Commit**

```bash
git add backend/src/contest/infra/http/admin-models.routes.ts
git commit -m "feat(admin-models): replace teamId/userSeqId with levelId/displayNumber/categorySeqId"
```

---

## Task 10: Update export.routes.ts

**Files:**
- Modify: `backend/src/contest/infra/http/export.routes.ts`

- [ ] **Step 1: Remove team imports**

In `export.routes.ts`, find and remove:
```typescript
// Remove from import:
teamsTable, teamMembersTable
```

- [ ] **Step 2: Remove any query that joins/uses `teamsTable` or `teamMembersTable`**

Search for usages of `teamsTable` and `teamMembersTable` in the file. Replace team-related data in export rows with `levelId`, `displayNumber`, `isTeam` from `modelsTable`. If a column like `teamName` was exported, replace it with `levelId` or remove.

If model-card PDF export (`/exports/model-card/pdf`) includes team info, update the HTML template to show `isTeam` and `teamMembers` instead.

- [ ] **Step 3: Commit**

```bash
git add backend/src/contest/infra/http/export.routes.ts
git commit -m "feat(export): remove team references, add level/displayNumber fields"
```

---

## Task 11: Frontend — Remove Teams

**Files:**
- Modify: `frontend/src/App.tsx`
- Delete: `frontend/src/pages/Teams.tsx`

- [ ] **Step 1: Update `App.tsx`**

Remove from `App.tsx`:
```typescript
// Remove import:
import Teams from "./pages/Teams";

// Remove from allNavItems:
{ label: t(language, "navTeams"), path: "/teams", minRole: "user" as Role },

// Remove Route:
<Route path="/teams" element={<Protected><Teams language={language} /></Protected>} />
```

- [ ] **Step 2: Delete Teams.tsx**

```bash
rm frontend/src/pages/Teams.tsx
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(frontend): remove Teams page and navigation"
```

---

## Task 12: Frontend — i18n New Keys

**Files:**
- Modify: `frontend/src/lib/i18n.ts`

- [ ] **Step 1: Add new translation keys**

Open `frontend/src/lib/i18n.ts`. Add the following keys to both `it` and `en` translation objects:

```typescript
// Italian additions:
modelsLevelPlaceholder: "Livello",
modelsIsTeamLabel: "È un team?",
modelsTeamMembersSection: "Membri del team",
modelsAddMemberButton: "Aggiungi membro",
modelsMemberName: "Nome",
modelsMemberSurname: "Cognome",
modelsMemberRole: "Ruolo",
adminLevelsTitle: "Livelli",
adminLevelsAddButton: "Aggiungi livello",
adminLevelName: "Nome livello",
adminLevelSortOrder: "Ordinamento",
adminMemberRolesTitle: "Ruoli Membri",
adminMemberRolesAddButton: "Aggiungi ruolo",
adminMemberRoleName: "Nome ruolo",

// English additions:
modelsLevelPlaceholder: "Level",
modelsIsTeamLabel: "Is a team?",
modelsTeamMembersSection: "Team members",
modelsAddMemberButton: "Add member",
modelsMemberName: "First name",
modelsMemberSurname: "Last name",
modelsMemberRole: "Role",
adminLevelsTitle: "Levels",
adminLevelsAddButton: "Add level",
adminLevelName: "Level name",
adminLevelSortOrder: "Sort order",
adminMemberRolesTitle: "Member Roles",
adminMemberRolesAddButton: "Add role",
adminMemberRoleName: "Role name",
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/lib/i18n.ts
git commit -m "feat(i18n): add translation keys for levels, member roles, team members"
```

---

## Task 13: Frontend — Update Models.tsx

**Files:**
- Modify: `frontend/src/pages/Models.tsx`

- [ ] **Step 1: Add types and state**

Update the `Model` type:
```typescript
type Model = {
  id: string;
  name: string;
  description?: string | null;
  code?: string | null;
  categoryId: string;
  levelId: string;
  imageUrl?: string | null;
  isTeam: boolean;
  displayNumber?: number | null;
};
```

Add `Level`, `MemberRole`, `TeamMember` types:
```typescript
type Level = { id: string; name: string; sortOrder?: number | null };
type MemberRole = { id: string; name: string };
type TeamMember = { name: string; surname: string; role: string };
```

Update `ModelDetail`:
```typescript
type ModelDetail = { model: Model; images: { id: string; url: string }[]; teamMembers: TeamMember[] };
```

Add state variables (after existing state declarations):
```typescript
const [levels, setLevels] = useState<Level[]>([]);
const [memberRoles, setMemberRoles] = useState<MemberRole[]>([]);
const [editLevelId, setEditLevelId] = useState("");
const [editIsTeam, setEditIsTeam] = useState(false);
const [editTeamMembers, setEditTeamMembers] = useState<TeamMember[]>([]);
const [newMemberName, setNewMemberName] = useState("");
const [newMemberSurname, setNewMemberSurname] = useState("");
const [newMemberRole, setNewMemberRole] = useState("");
```

- [ ] **Step 2: Add load functions and update existing ones**

Add after `loadSettings`:
```typescript
async function loadLevels() {
  try { setLevels(await api<Level[]>("/public/levels")); } catch { setLevels([]); }
}
async function loadMemberRoles() {
  try { setMemberRoles(await api<MemberRole[]>("/public/member-roles")); } catch { setMemberRoles([]); }
}
```

Update `useEffect` call:
```typescript
useEffect(() => { load(); loadCategories(); loadSettings(); loadLevels(); loadMemberRoles(); }, []);
```

Update `openModel` to set new state:
```typescript
setEditLevelId(d.model.levelId || "");
setEditIsTeam(d.model.isTeam || false);
setEditTeamMembers(d.teamMembers || []);
```

Update `startCreate`:
```typescript
setEditLevelId("");
setEditIsTeam(false);
setEditTeamMembers([]);
setNewMemberName("");
setNewMemberSurname("");
setNewMemberRole("");
```

Update `createModel` body:
```typescript
body: JSON.stringify({
  name: editName.trim(),
  categoryId: editCategoryId,
  levelId: editLevelId,
  isTeam: editIsTeam,
  teamMembers: editIsTeam ? editTeamMembers : []
})
```

Update `saveModelChanges` body:
```typescript
body: JSON.stringify({
  name: editName.trim(),
  categoryId: editCategoryId,
  levelId: editLevelId,
  isTeam: editIsTeam,
  teamMembers: editTeamMembers
})
```

Add helper:
```typescript
function addTeamMember() {
  if (!newMemberName.trim() || !newMemberSurname.trim() || !newMemberRole) return;
  setEditTeamMembers(prev => [...prev, { name: newMemberName.trim(), surname: newMemberSurname.trim(), role: newMemberRole }]);
  setNewMemberName("");
  setNewMemberSurname("");
  setNewMemberRole("");
}
function removeTeamMember(idx: number) {
  setEditTeamMembers(prev => prev.filter((_, i) => i !== idx));
}
```

- [ ] **Step 3: Update `editPanel` JSX**

After the category `<Select>`, add a level select:
```tsx
<FormControl fullWidth size="small">
  <InputLabel>{t(language, "modelsLevelPlaceholder")}</InputLabel>
  <Select value={editLevelId} label={t(language, "modelsLevelPlaceholder")} onChange={(e) => setEditLevelId(e.target.value)}>
    {levels.map((lvl) => <MenuItem key={lvl.id} value={lvl.id}>{lvl.name}</MenuItem>)}
  </Select>
</FormControl>
```

Replace the old `TextField` for teamId with a checkbox + team members section:
```tsx
<Stack direction="row" alignItems="center" spacing={1}>
  <input type="checkbox" id="isTeam" checked={editIsTeam} onChange={(e) => setEditIsTeam(e.target.checked)} />
  <Typography variant="body2" component="label" htmlFor="isTeam">
    {t(language, "modelsIsTeamLabel")}
  </Typography>
</Stack>

{editIsTeam && (
  <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, p: 1.5 }}>
    <Typography variant="subtitle2" sx={{ mb: 1 }}>{t(language, "modelsTeamMembersSection")}</Typography>
    {editTeamMembers.map((m, idx) => (
      <Stack key={idx} direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
        <Typography variant="body2" sx={{ flexGrow: 1 }}>{m.name} {m.surname} — {m.role}</Typography>
        <IconButton size="small" color="error" onClick={() => removeTeamMember(idx)}>
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Stack>
    ))}
    <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
      <TextField size="small" label={t(language, "modelsMemberName")} value={newMemberName} onChange={(e) => setNewMemberName(e.target.value)} sx={{ flex: 1 }} />
      <TextField size="small" label={t(language, "modelsMemberSurname")} value={newMemberSurname} onChange={(e) => setNewMemberSurname(e.target.value)} sx={{ flex: 1 }} />
      <FormControl size="small" sx={{ minWidth: 120 }}>
        <InputLabel>{t(language, "modelsMemberRole")}</InputLabel>
        <Select value={newMemberRole} label={t(language, "modelsMemberRole")} onChange={(e) => setNewMemberRole(e.target.value)}>
          {memberRoles.map((r) => <MenuItem key={r.id} value={r.name}>{r.name}</MenuItem>)}
        </Select>
      </FormControl>
      <Button variant="outlined" size="small" onClick={addTeamMember} disabled={!newMemberName.trim() || !newMemberSurname.trim() || !newMemberRole}>
        {t(language, "modelsAddMemberButton")}
      </Button>
    </Stack>
  </Box>
)}
```

Update the save Button `disabled` condition to also require `editLevelId`:
```tsx
disabled={savingModel || !editName.trim() || !editCategoryId || !editLevelId}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Models.tsx
git commit -m "feat(models-ui): add level select, isTeam checkbox, team members inline form"
```

---

## Task 14: Frontend — Update Admin.tsx (Levels + Member Roles)

**Files:**
- Modify: `frontend/src/pages/Admin.tsx`

- [ ] **Step 1: Add state for levels and member roles**

In `Admin.tsx`, add state (after existing state):
```typescript
const [levels, setLevels] = useState<{ id: string; name: string; sortOrder?: number | null }[]>([]);
const [newLevelName, setNewLevelName] = useState("");
const [newLevelSortOrder, setNewLevelSortOrder] = useState("");
const [memberRoles, setMemberRoles] = useState<{ id: string; name: string }[]>([]);
const [newMemberRoleName, setNewMemberRoleName] = useState("");
```

- [ ] **Step 2: Add load and CRUD functions**

```typescript
async function loadLevels() {
  try { setLevels(await api<any[]>("/admin/levels")); } catch { setLevels([]); }
}
async function createLevel() {
  if (!newLevelName.trim()) return;
  await api("/admin/levels", {
    method: "POST",
    body: JSON.stringify({ name: newLevelName.trim(), sortOrder: newLevelSortOrder ? Number(newLevelSortOrder) : undefined })
  });
  setNewLevelName("");
  setNewLevelSortOrder("");
  await loadLevels();
}
async function deleteLevel(id: string) {
  await api(`/admin/levels/${id}`, { method: "DELETE" });
  await loadLevels();
}

async function loadMemberRoles() {
  try { setMemberRoles(await api<any[]>("/admin/member-roles")); } catch { setMemberRoles([]); }
}
async function createMemberRole() {
  if (!newMemberRoleName.trim()) return;
  await api("/admin/member-roles", {
    method: "POST",
    body: JSON.stringify({ name: newMemberRoleName.trim() })
  });
  setNewMemberRoleName("");
  await loadMemberRoles();
}
async function deleteMemberRole(id: string) {
  await api(`/admin/member-roles/${id}`, { method: "DELETE" });
  await loadMemberRoles();
}
```

Add `loadLevels()` and `loadMemberRoles()` to the `useEffect` that loads initial data.

- [ ] **Step 3: Add JSX sections**

Add two new `<Paper>` sections at the end of the admin page (before the closing `</Stack>`):

```tsx
{/* Levels */}
<Paper variant="outlined" sx={{ p: 2 }}>
  <Typography variant="h6" sx={{ mb: 2 }}>{t(language, "adminLevelsTitle")}</Typography>
  <Stack direction="row" spacing={1} sx={{ mb: 2 }} alignItems="center">
    <TextField size="small" label={t(language, "adminLevelName")} value={newLevelName} onChange={(e) => setNewLevelName(e.target.value)} />
    <TextField size="small" label={t(language, "adminLevelSortOrder")} type="number" value={newLevelSortOrder} onChange={(e) => setNewLevelSortOrder(e.target.value)} sx={{ width: 120 }} />
    <Button variant="contained" size="small" onClick={createLevel} disabled={!newLevelName.trim()}>
      {t(language, "adminLevelsAddButton")}
    </Button>
  </Stack>
  <TableContainer>
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell sx={{ fontWeight: 700 }}>{t(language, "adminLevelName")}</TableCell>
          <TableCell sx={{ fontWeight: 700 }}>{t(language, "adminLevelSortOrder")}</TableCell>
          <TableCell />
        </TableRow>
      </TableHead>
      <TableBody>
        {levels.map((lvl) => (
          <TableRow key={lvl.id}>
            <TableCell>{lvl.name}</TableCell>
            <TableCell>{lvl.sortOrder ?? "-"}</TableCell>
            <TableCell align="right">
              <IconButton size="small" color="error" onClick={() => deleteLevel(lvl.id)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </TableContainer>
</Paper>

{/* Member Roles */}
<Paper variant="outlined" sx={{ p: 2 }}>
  <Typography variant="h6" sx={{ mb: 2 }}>{t(language, "adminMemberRolesTitle")}</Typography>
  <Stack direction="row" spacing={1} sx={{ mb: 2 }} alignItems="center">
    <TextField size="small" label={t(language, "adminMemberRoleName")} value={newMemberRoleName} onChange={(e) => setNewMemberRoleName(e.target.value)} />
    <Button variant="contained" size="small" onClick={createMemberRole} disabled={!newMemberRoleName.trim()}>
      {t(language, "adminMemberRolesAddButton")}
    </Button>
  </Stack>
  <TableContainer>
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell sx={{ fontWeight: 700 }}>{t(language, "adminMemberRoleName")}</TableCell>
          <TableCell />
        </TableRow>
      </TableHead>
      <TableBody>
        {memberRoles.map((role) => (
          <TableRow key={role.id}>
            <TableCell>{role.name}</TableCell>
            <TableCell align="right">
              <IconButton size="small" color="error" onClick={() => deleteMemberRole(role.id)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </TableContainer>
</Paper>
```

Note: `Admin.tsx` uses `TableContainer`, `Table`, `TableHead`, `TableRow`, `TableCell`, `TableBody` — verify they are already imported; if not, add them to the MUI imports.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Admin.tsx
git commit -m "feat(admin-ui): add Levels and Member Roles management sections"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|-----------------|------|
| Remove teamsTable, teamMembersTable, teamRolesTable | Task 1, 2, 4 |
| Add levelsTable | Task 1, 2 |
| Add memberRolesTable | Task 1, 2 |
| Add modelTeamMembersTable | Task 1, 2 |
| Modify modelsTable (remove teamId, add levelId/displayNumber/isTeam) | Task 1, 2 |
| Modify categoriesTable (seqId serial) | Task 1, 2 |
| New setting displayNumberPadding | Task 7 |
| Admin CRUD for levels | Task 5 |
| Admin CRUD for member-roles | Task 6 |
| Public GET levels + member-roles | Task 5, 6 |
| model.routes.ts: levelId, displayNumber, isTeam, teamMembers | Task 8 |
| New model code format M{catSeqId}-{displayNum}-{code} | Task 7, 8 |
| displayNumber logic (per-event, per-combo) | Task 8 |
| Seed levels + memberRoles | Task 3 |
| Remove Teams.tsx + route | Task 11 |
| Models.tsx: level select, isTeam, team members form | Task 13 |
| Admin.tsx: Levels + MemberRoles sections | Task 14 |
| i18n new keys | Task 12 |
| admin-models.routes.ts updated | Task 9 |
| export.routes.ts updated | Task 10 |

All spec sections covered. No gaps.
