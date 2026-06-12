# Team Inline + Levels + DisplayNumber Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove standalone team management, add inline team members on models, add configurable levels, and compute per-category display numbers with new model code format.

**Architecture:** Schema-first approach using Drizzle ORM with `drizzle-kit push`. No migration files — schema.ts is the source of truth. Backend uses Elysia routes with hexagonal structure. Frontend is React/MUI with i18n.

**Tech Stack:** Bun + Elysia, Drizzle ORM + PostgreSQL, React + TypeScript + MUI, `drizzle-kit push` for schema sync.

---

## File Map

### Modified (Backend)
- `backend/src/contest/infra/persistence/schema.ts` — remove teams tables, add levelsTable, modelTeamMembersTable, modify modelsTable and categoriesTable
- `backend/src/bootstrap/app.ts` — remove teamRoutes, teamRolesRoutes, teamRolesPublicRoutes; add levelsRoutes
- `backend/src/contest/infra/http/model.routes.ts` — remove teamId, add levelId, compute displayNumber on insert
- `backend/src/contest/infra/http/admin-models.routes.ts` — update model listing to include levelId, displayNumber, teamMembers
- `backend/src/contest/infra/http/model-code.ts` — update formatModelCode to use new format M{categorySeqId}-{displayNumber}-{modelCode}

### Created (Backend)
- `backend/src/contest/infra/http/levels.routes.ts` — CRUD for levels (admin), GET public

### Deleted (Backend)
- `backend/src/contest/infra/http/team.routes.ts`
- `backend/src/contest/infra/http/team-roles.routes.ts`

### Modified (Frontend)
- `frontend/src/App.tsx` — remove Teams import/route/navItem
- `frontend/src/pages/Models.tsx` — remove teamId field, add levelId selector, add team members inline form (checkbox + dynamic member list)
- `frontend/src/lib/i18n.ts` — add/update translation keys for levels and team members

### Deleted (Frontend)
- `frontend/src/pages/Teams.tsx`

---

## Task 1: Schema — Remove Teams, Add Levels + ModelTeamMembers + Modify Models + Categories

**Files:**
- Modify: `backend/src/contest/infra/persistence/schema.ts`

- [ ] **Step 1: Update schema.ts**

Replace the entire file content with:

```typescript
import { pgTable, uuid, text, integer, timestamp, boolean, uniqueIndex, index, serial } from "drizzle-orm/pg-core";

// REMOVED: teamsTable, teamMembersTable, teamRolesTable

export const levelsTable = pgTable("levels", {
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
  status: text("status").default("open").notNull(), // open | closed
  seqId: serial("seq_id")
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
  levelId: uuid("level_id"),
  name: text("name").notNull(),
  description: text("description"),
  code: integer("code"),
  displayNumber: integer("display_number"),
  imageUrl: text("image_url")
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
  rank: integer("rank").notNull(), // 0..3
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

- [ ] **Step 2: Push schema to DB**

```bash
cd backend
bun run drizzle-kit push
```

Expected: tables `teams`, `team_members`, `team_roles` dropped (or warned); `levels`, `model_team_members` created; `categories.seq_id` added; `models.level_id`, `models.display_number` added; `models.team_id` removed.

- [ ] **Step 3: Commit**

```bash
git add backend/src/contest/infra/persistence/schema.ts
git commit -m "feat: update schema — remove teams tables, add levels + model_team_members, add seqId to categories, add levelId + displayNumber to models"
```

---

## Task 2: Backend — Remove Team Routes Files + App Wiring

**Files:**
- Delete: `backend/src/contest/infra/http/team.routes.ts`
- Delete: `backend/src/contest/infra/http/team-roles.routes.ts`
- Modify: `backend/src/bootstrap/app.ts`

- [ ] **Step 1: Remove team route files**

Delete the two files:
```bash
rm backend/src/contest/infra/http/team.routes.ts
rm backend/src/contest/infra/http/team-roles.routes.ts
```

- [ ] **Step 2: Update app.ts — remove team imports and .use() calls**

In `backend/src/bootstrap/app.ts`:

Remove these import lines:
```typescript
import { teamRoutes } from "../contest/infra/http/team.routes";
import { teamRolesRoutes, teamRolesPublicRoutes } from "../contest/infra/http/team-roles.routes";
```

Remove these `.use()` calls:
```typescript
    .use(teamRoutes)
    // ...
    .use(teamRolesRoutes)
    .use(teamRolesPublicRoutes)
```

Also remove `{ name: "Teams", description: "Gestione team." }` from the swagger tags array.

- [ ] **Step 3: Verify build compiles**

```bash
cd backend
bun run --watch src/bootstrap/server.ts &
# wait 3 seconds, then kill
# OR just type-check:
bun tsc --noEmit
```

Expected: no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add backend/src/bootstrap/app.ts
git commit -m "feat: remove team routes from app"
```

---

## Task 3: Backend — Levels CRUD Route

**Files:**
- Create: `backend/src/contest/infra/http/levels.routes.ts`
- Modify: `backend/src/bootstrap/app.ts`

- [ ] **Step 1: Create levels.routes.ts**

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
    return await tenantDb.select().from(levelsTable);
  }, {
    detail: { summary: "Lista livelli (admin)", tags: ["Admin"], security: [{ bearerAuth: [] }] }
  })
  .post("/", async ({ tenantDb, body }) => {
    const id = crypto.randomUUID();
    await tenantDb.insert(levelsTable).values({ id, name: body.name });
    return { id };
  }, {
    body: t.Object({ name: t.String() }),
    detail: { summary: "Crea livello", tags: ["Admin"], security: [{ bearerAuth: [] }] }
  })
  .put("/:levelId", async ({ tenantDb, params, body }) => {
    await tenantDb.update(levelsTable).set({ name: body.name }).where(eq(levelsTable.id, params.levelId as any));
    return { updated: true };
  }, {
    params: t.Object({ levelId: t.String() }),
    body: t.Object({ name: t.String() }),
    detail: { summary: "Aggiorna livello", tags: ["Admin"], security: [{ bearerAuth: [] }] }
  })
  .delete("/:levelId", async ({ tenantDb, params }) => {
    await tenantDb.delete(levelsTable).where(eq(levelsTable.id, params.levelId as any));
    return { deleted: true };
  }, {
    params: t.Object({ levelId: t.String() }),
    detail: { summary: "Elimina livello", tags: ["Admin"], security: [{ bearerAuth: [] }] }
  });

export const publicLevelsRoutes = new Elysia({ prefix: "/levels" })
  .use(tenantMiddleware)
  .use(requireRole("user"))
  .get("/", async ({ tenantDb }) => {
    return await tenantDb.select().from(levelsTable);
  }, {
    detail: { summary: "Lista livelli", tags: ["Public"], security: [{ bearerAuth: [] }] }
  });
```

- [ ] **Step 2: Wire into app.ts**

Add import:
```typescript
import { adminLevelsRoutes, publicLevelsRoutes } from "../contest/infra/http/levels.routes";
```

Add `.use()` calls after `adminModelsRoutes`:
```typescript
    .use(adminLevelsRoutes)
    .use(publicLevelsRoutes)
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/contest/infra/http/levels.routes.ts backend/src/bootstrap/app.ts
git commit -m "feat: add levels CRUD route (admin) and public GET /levels"
```

---

## Task 4: Backend — Update model-code.ts for New Format

**Files:**
- Modify: `backend/src/contest/infra/http/model-code.ts`

The new format is `M{categorySeqId}-{displayNumber}-{modelCode}` (e.g. `M2-0315-865`).

`categorySeqId` is the `seqId` serial from `categoriesTable`.
`displayNumber` is stored on the model (computed at insert time).
`modelCode` is the existing `code` integer.

- [ ] **Step 1: Update model-code.ts**

```typescript
import { eq } from "drizzle-orm";
import { settingsTable, categoriesTable } from "../persistence/schema";

const DEFAULT_DISPLAY_DIGITS = 4;
const DEFAULT_CODE_DIGITS = 3;

export type ModelCodeFormat = {
  displayDigits: number;
  codeDigits: number;
};

export async function loadModelCodeFormatSettings(tenantDb: any): Promise<ModelCodeFormat> {
  const [displayDigitsRow] = await tenantDb
    .select({ value: settingsTable.value })
    .from(settingsTable)
    .where(eq(settingsTable.key, "printDisplayDigits" as any))
    .limit(1);

  const [codeDigitsRow] = await tenantDb
    .select({ value: settingsTable.value })
    .from(settingsTable)
    .where(eq(settingsTable.key, "printCodeDigits" as any))
    .limit(1);

  const parseDigits = (v: string | undefined, def: number) => {
    const n = Number.parseInt(String(v ?? ""), 10);
    return Number.isFinite(n) && n >= 1 && n <= 10 ? n : def;
  };

  return {
    displayDigits: parseDigits(displayDigitsRow?.value, DEFAULT_DISPLAY_DIGITS),
    codeDigits: parseDigits(codeDigitsRow?.value, DEFAULT_CODE_DIGITS)
  };
}

export async function getCategorySeqId(tenantDb: any, categoryId: string): Promise<number | null> {
  const [row] = await tenantDb
    .select({ seqId: categoriesTable.seqId })
    .from(categoriesTable)
    .where(eq(categoriesTable.id, categoryId as any))
    .limit(1);
  return row?.seqId ?? null;
}

export function formatModelCode(
  categorySeqId: number | null | undefined,
  displayNumber: number | null | undefined,
  code: number | null | undefined,
  format: ModelCodeFormat
): string {
  if (code === null || code === undefined) return "";
  const numCode = Math.max(0, Math.trunc(Number(code)));
  const numDisplay = Math.max(0, Math.trunc(Number(displayNumber ?? 0)));
  const catSeq = Math.max(0, Math.trunc(Number(categorySeqId ?? 0)));

  const paddedDisplay = String(numDisplay).padStart(format.displayDigits, "0");
  const paddedCode = String(numCode).padStart(format.codeDigits, "0");
  return `M${catSeq}-${paddedDisplay}-${paddedCode}`;
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/contest/infra/http/model-code.ts
git commit -m "feat: update model code format to M{catSeqId}-{displayNumber}-{modelCode}"
```

---

## Task 5: Backend — Update model.routes.ts (DisplayNumber Logic + Team Members)

**Files:**
- Modify: `backend/src/contest/infra/http/model.routes.ts`

DisplayNumber logic: for a given `(userId, categoryId, levelId)` combo, find the first model with that combo. If exists, reuse its `displayNumber`. If not, compute `MAX(displayNumber) + 1` globally (across all models).

- [ ] **Step 1: Rewrite model.routes.ts**

```typescript
import { Elysia, t } from "elysia";
import { and, desc, eq, ilike, isNotNull, max } from "drizzle-orm";
import { requireRole } from "../../../identity/infra/http/role.middleware";
import { tenantMiddleware } from "../../../tenancy/infra/http/tenant.middleware";
import { formatModelCode, loadModelCodeFormatSettings, getCategorySeqId } from "./model-code";
import { modelsTable, modelImagesTable, modelTeamMembersTable } from "../persistence/schema";

async function resolveDisplayNumber(
  tenantDb: any,
  userId: string,
  categoryId: string,
  levelId: string | null
): Promise<number> {
  // Check if combo (userId, categoryId, levelId) already has a displayNumber
  const clauses = [
    eq(modelsTable.userId, userId as any),
    eq(modelsTable.categoryId, categoryId as any),
    isNotNull(modelsTable.displayNumber)
  ];
  if (levelId) {
    clauses.push(eq(modelsTable.levelId, levelId as any));
  }
  const [existing] = await tenantDb
    .select({ displayNumber: modelsTable.displayNumber })
    .from(modelsTable)
    .where(and(...clauses))
    .limit(1);

  if (existing?.displayNumber != null) return existing.displayNumber;

  // New combo: MAX + 1
  const [maxRow] = await tenantDb
    .select({ val: max(modelsTable.displayNumber) })
    .from(modelsTable)
    .where(isNotNull(modelsTable.displayNumber));

  return (Number(maxRow?.val ?? 0)) + 1;
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
    const rows = await tenantDb.select().from(modelsTable).where(and(...clauses));

    return await Promise.all(rows.map(async (row: any) => {
      const catSeqId = await getCategorySeqId(tenantDb, row.categoryId);
      return {
        ...row,
        code: formatModelCode(catSeqId, row.displayNumber, row.code, codeFormat) || null
      };
    }));
  }, {
    detail: { summary: "Lista modelli", tags: ["Models"], security: [{ bearerAuth: [] }] }
  })
  .post("/", async ({ tenantDb, user, body }) => {
    const modelId = crypto.randomUUID();
    const levelId = body.levelId ?? null;
    const displayNumber = await resolveDisplayNumber(tenantDb, user!.id, body.categoryId, levelId);
    const codeFormat = await loadModelCodeFormatSettings(tenantDb);
    let lastError: unknown = null;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = await generateModelCode(tenantDb);
      try {
        await tenantDb.insert(modelsTable).values({
          id: modelId,
          userId: user!.id as any,
          categoryId: body.categoryId,
          levelId,
          name: body.name,
          description: body.description ?? null,
          code,
          displayNumber,
          imageUrl: body.imageUrl ?? null
        });

        // Insert team members if provided
        if (body.teamMembers && body.teamMembers.length > 0) {
          for (const member of body.teamMembers) {
            await tenantDb.insert(modelTeamMembersTable).values({
              id: crypto.randomUUID(),
              modelId,
              name: member.name,
              surname: member.surname,
              role: member.role
            });
          }
        }

        const catSeqId = await getCategorySeqId(tenantDb, body.categoryId);
        return {
          id: modelId,
          code: formatModelCode(catSeqId, displayNumber, code, codeFormat)
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
      levelId: t.Optional(t.String()),
      description: t.Optional(t.String()),
      imageUrl: t.Optional(t.String()),
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
      .select()
      .from(modelsTable)
      .where(and(eq(modelsTable.id, params.modelId as any), eq(modelsTable.userId, user!.id as any)));
    if (!rows.length) { set.status = 404; return { error: "Not found" }; }

    const codeFormat = await loadModelCodeFormatSettings(tenantDb);
    const catSeqId = await getCategorySeqId(tenantDb, rows[0].categoryId);
    const images = await tenantDb.select().from(modelImagesTable).where(eq(modelImagesTable.modelId, params.modelId as any));
    const teamMembers = await tenantDb.select().from(modelTeamMembersTable).where(eq(modelTeamMembersTable.modelId, params.modelId as any));

    return {
      model: {
        ...rows[0],
        code: formatModelCode(catSeqId, (rows[0] as any).displayNumber, (rows[0] as any).code, codeFormat) || null
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

    const updateData: Record<string, any> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.categoryId !== undefined) updateData.categoryId = body.categoryId;
    if (body.levelId !== undefined) updateData.levelId = body.levelId;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.imageUrl !== undefined) updateData.imageUrl = body.imageUrl;

    await tenantDb.update(modelsTable).set(updateData).where(eq(modelsTable.id, params.modelId as any));

    // Replace team members if provided
    if (body.teamMembers !== undefined) {
      await tenantDb.delete(modelTeamMembersTable).where(eq(modelTeamMembersTable.modelId, params.modelId as any));
      for (const member of body.teamMembers) {
        await tenantDb.insert(modelTeamMembersTable).values({
          id: crypto.randomUUID(),
          modelId: params.modelId,
          name: member.name,
          surname: member.surname,
          role: member.role
        });
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

    await tenantDb.delete(modelImagesTable).where(and(eq(modelImagesTable.id, params.imageId as any), eq(modelImagesTable.modelId, params.modelId as any)));
    return { deleted: true };
  }, {
    params: t.Object({ modelId: t.String(), imageId: t.String() }),
    detail: { summary: "Elimina immagine", tags: ["Models"], security: [{ bearerAuth: [] }] }
  });
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd backend
bun tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/contest/infra/http/model.routes.ts
git commit -m "feat: update model routes — add levelId, displayNumber logic, inline team members, new code format"
```

---

## Task 6: Frontend — Remove Teams Page + Route + Nav

**Files:**
- Delete: `frontend/src/pages/Teams.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Delete Teams.tsx**

```bash
rm frontend/src/pages/Teams.tsx
```

- [ ] **Step 2: Update App.tsx — remove Teams**

In `frontend/src/App.tsx`:

Remove import:
```typescript
import Teams from "./pages/Teams";
```

Remove nav item from `allNavItems`:
```typescript
{ label: t(language, "navTeams"), path: "/teams", minRole: "user" as Role },
```

Remove route:
```typescript
<Route path="/teams" element={<Protected><Teams language={language} /></Protected>} />
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: remove Teams tab and route from frontend"
```

---

## Task 7: Frontend — Update Models.tsx (LevelId + Inline Team Members)

**Files:**
- Modify: `frontend/src/pages/Models.tsx`

Key changes:
1. Remove `editTeamId` state, replace with `isTeam` boolean + `teamMembers` array state
2. Add level selector (fetch `/levels`)
3. Add team checkbox + dynamic member form (name, surname, role fields + add/remove)
4. Pass `levelId` and `teamMembers` on create/save

- [ ] **Step 1: Update Models.tsx**

Replace the file with this updated version:

```typescript
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Collapse,
  Container,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import CloseIcon from "@mui/icons-material/Close";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import PrintIcon from "@mui/icons-material/Print";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import ImageIcon from "@mui/icons-material/Image";
import HideImageIcon from "@mui/icons-material/HideImage";
import PeopleIcon from "@mui/icons-material/People";
import { api } from "../lib/api";
import { Language, t } from "../lib/i18n";

type TeamMember = { name: string; surname: string; role: string };
type TeamMemberWithId = TeamMember & { id: string };

type Model = {
  id: string;
  name: string;
  description?: string | null;
  code?: string | null;
  categoryId: string;
  levelId?: string | null;
  imageUrl?: string | null;
};
type ModelDetail = {
  model: Model;
  images: { id: string; url: string }[];
  teamMembers: TeamMemberWithId[];
};
type Category = { id: string; eventId: string; name: string; status: string };
type Level = { id: string; name: string };

interface ModelsProps {
  language: Language;
}

const emptyMember = (): TeamMember => ({ name: "", surname: "", role: "" });

export default function Models({ language }: ModelsProps) {
  const [models, setModels] = useState<Model[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ModelDetail | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savingModel, setSavingModel] = useState(false);
  const [message, setMessage] = useState("");
  const [imagesEnabled, setImagesEnabled] = useState(false);
  const [maxModelsPerUser, setMaxModelsPerUser] = useState<number | null>(null);

  const [editName, setEditName] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editLevelId, setEditLevelId] = useState("");
  const [isTeam, setIsTeam] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [attachName, setAttachName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    setModels(await api<Model[]>("/models"));
  }

  async function printScheda() {
    try {
      const html = await api<string>("/exports/model-card/pdf");
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err: any) {
      setMessage(err.message || "Error");
    }
  }

  async function loadCategories() {
    try { setCategories(await api<Category[]>("/public/categories")); }
    catch { setCategories([]); }
  }

  async function loadLevels() {
    try { setLevels(await api<Level[]>("/levels")); }
    catch { setLevels([]); }
  }

  async function openModel(modelId: string) {
    if (expandedId === modelId) { setExpandedId(null); setDetail(null); return; }
    const d = await api<ModelDetail>(`/models/${modelId}`);
    setDetail(d);
    setEditName(d.model.name);
    setEditCategoryId(d.model.categoryId);
    setEditLevelId(d.model.levelId || "");
    const hasMembers = d.teamMembers.length > 0;
    setIsTeam(hasMembers);
    setTeamMembers(hasMembers ? d.teamMembers.map(({ name, surname, role }) => ({ name, surname, role })) : []);
    setExpandedId(modelId);
    setIsCreating(false);
    setAttachName("");
  }

  function closePanel() {
    setExpandedId(null);
    setDetail(null);
    setIsCreating(false);
  }

  function startCreate() {
    setExpandedId(null);
    setDetail(null);
    setEditName("");
    setEditCategoryId("");
    setEditLevelId("");
    setIsTeam(false);
    setTeamMembers([]);
    setIsCreating(true);
    setAttachName("");
  }

  function addMember() {
    setTeamMembers((prev) => [...prev, emptyMember()]);
  }

  function removeMember(idx: number) {
    setTeamMembers((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateMember(idx: number, field: keyof TeamMember, value: string) {
    setTeamMembers((prev) => prev.map((m, i) => i === idx ? { ...m, [field]: value } : m));
  }

  async function createModel() {
    setSavingModel(true);
    try {
      await api<{ id: string }>("/models", {
        method: "POST",
        body: JSON.stringify({
          name: editName.trim(),
          categoryId: editCategoryId,
          levelId: editLevelId || undefined,
          teamMembers: isTeam ? teamMembers.filter((m) => m.name.trim() || m.surname.trim()) : undefined
        })
      });
      setIsCreating(false);
      await load();
    } catch (err: any) {
      setMessage(err.message || "Unable to create model");
    } finally {
      setSavingModel(false);
    }
  }

  async function saveModelChanges() {
    if (!detail?.model) return;
    setSavingModel(true);
    try {
      await api(`/models/${detail.model.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: editName.trim(),
          categoryId: editCategoryId,
          levelId: editLevelId || undefined,
          teamMembers: isTeam ? teamMembers.filter((m) => m.name.trim() || m.surname.trim()) : []
        })
      });
      closePanel();
      await load();
    } catch (err: any) {
      setMessage(err.message || "Unable to save model");
    } finally {
      setSavingModel(false);
    }
  }

  async function deleteModel(modelId: string) {
    await api(`/models/${modelId}`, { method: "DELETE" });
    if (expandedId === modelId) closePanel();
    await load();
  }

  async function resizeImageForUpload(file: File): Promise<File | Blob> {
    const maxDimension = 1920;
    const targetMaxBytes = 1.5 * 1024 * 1024;
    const outputType = file.type === "image/png" ? "image/jpeg" : (file.type || "image/jpeg");
    if (!["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(file.type)) return file;
    let bitmap: ImageBitmap;
    try { bitmap = await createImageBitmap(file); } catch { return file; }
    let { width, height } = bitmap;
    const needsResize = width > maxDimension || height > maxDimension;
    if (needsResize) {
      const ratio = Math.min(maxDimension / width, maxDimension / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) { bitmap.close(); return file; }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    if (!needsResize && file.size <= targetMaxBytes) return file;
    const qualities = [0.85, 0.75, 0.65, 0.55];
    let candidate: Blob | null = null;
    for (const quality of qualities) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, outputType, quality));
      if (!blob) continue;
      candidate = blob;
      if (blob.size <= targetMaxBytes) break;
    }
    return candidate || file;
  }

  async function uploadFile(file: File) {
    if (!detail?.model) return;
    setUploading(true);
    try {
      const optimizedFile = await resizeImageForUpload(file);
      const contentType = optimizedFile.type || file.type || "image/jpeg";
      const { uploadUrl, publicUrl } = await api<{ uploadUrl: string; publicUrl: string }>(
        `/models/${detail.model.id}/image-upload`,
        { method: "POST", body: JSON.stringify({ contentType }) }
      );
      await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body: optimizedFile });
      await api(`/models/${detail.model.id}/images`, { method: "POST", body: JSON.stringify({ url: publicUrl }) });
      const d = await api<ModelDetail>(`/models/${detail.model.id}`);
      setDetail(d);
      setAttachName("");
    } catch (err: any) {
      setMessage(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) { setAttachName(file.name); uploadFile(file); }
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  }

  async function deleteImage(imageId: string) {
    if (!detail?.model) return;
    await api(`/models/${detail.model.id}/images/${imageId}`, { method: "DELETE" });
    const d = await api<ModelDetail>(`/models/${detail.model.id}`);
    setDetail(d);
  }

  async function loadSettings() {
    try {
      const s = await api<Record<string, string>>("/settings");
      setImagesEnabled(s.modelImages === "true");
      const max = Number.parseInt(s.maxModelsPerUser ?? "", 10);
      setMaxModelsPerUser(Number.isFinite(max) && max > 0 ? max : null);
    } catch { setImagesEnabled(false); }
  }

  useEffect(() => { load(); loadCategories(); loadLevels(); loadSettings(); }, []);

  const openCategories = categories.filter((c) => c.status === "open");
  const getCategoryName = (catId: string) => categories.find((c) => c.id === catId)?.name ?? catId;
  const getLevelName = (lvlId: string | null | undefined) => lvlId ? (levels.find((l) => l.id === lvlId)?.name ?? lvlId) : null;

  const showMediaPanel = !isCreating && Boolean(detail);
  const tableColumnCount = 5;
  const atMaxModels = maxModelsPerUser !== null && models.length >= maxModelsPerUser;

  const teamMembersForm = (
    <Box>
      <FormControlLabel
        control={<Checkbox checked={isTeam} onChange={(e) => { setIsTeam(e.target.checked); if (!e.target.checked) setTeamMembers([]); }} />}
        label={t(language, "modelsIsTeam")}
      />
      <Collapse in={isTeam}>
        <Stack spacing={1} sx={{ mt: 1 }}>
          {teamMembers.map((member, idx) => (
            <Paper key={idx} variant="outlined" sx={{ p: 1.5 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <TextField
                  label={t(language, "modelsMemberName")}
                  value={member.name}
                  onChange={(e) => updateMember(idx, "name", e.target.value)}
                  size="small"
                  sx={{ flex: 1 }}
                />
                <TextField
                  label={t(language, "modelsMemberSurname")}
                  value={member.surname}
                  onChange={(e) => updateMember(idx, "surname", e.target.value)}
                  size="small"
                  sx={{ flex: 1 }}
                />
                <TextField
                  label={t(language, "modelsMemberRole")}
                  value={member.role}
                  onChange={(e) => updateMember(idx, "role", e.target.value)}
                  size="small"
                  sx={{ flex: 1 }}
                />
                <IconButton size="small" color="error" onClick={() => removeMember(idx)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Stack>
            </Paper>
          ))}
          <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={addMember}>
            {t(language, "modelsAddMember")}
          </Button>
        </Stack>
      </Collapse>
    </Box>
  );

  const editPanel = (
    <Box sx={{ p: 2 }}>
      <Grid container spacing={2} alignItems="flex-start">
        <Grid item xs={12} md={showMediaPanel ? 7 : 12}>
          <Stack spacing={1.5}>
            <Typography variant="subtitle2">
              {isCreating ? t(language, "modelsCreateButton") : t(language, "modelsEditSection")}
            </Typography>
            <TextField label={t(language, "modelsNamePlaceholder")} value={editName} onChange={(e) => setEditName(e.target.value)} fullWidth size="small" />
            <FormControl fullWidth size="small">
              <InputLabel>{t(language, "modelsCategoryPlaceholder")}</InputLabel>
              <Select value={editCategoryId} label={t(language, "modelsCategoryPlaceholder")} onChange={(e) => setEditCategoryId(e.target.value)}>
                {openCategories.map((cat) => <MenuItem key={cat.id} value={cat.id}>{cat.name}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl fullWidth size="small">
              <InputLabel>{t(language, "modelsLevelPlaceholder")}</InputLabel>
              <Select value={editLevelId} label={t(language, "modelsLevelPlaceholder")} onChange={(e) => setEditLevelId(e.target.value)}>
                <MenuItem value=""><em>{t(language, "modelsNoLevel")}</em></MenuItem>
                {levels.map((lvl) => <MenuItem key={lvl.id} value={lvl.id}>{lvl.name}</MenuItem>)}
              </Select>
            </FormControl>
            {teamMembersForm}
            <Button
              variant="contained"
              onClick={isCreating ? createModel : saveModelChanges}
              disabled={savingModel || !editName.trim() || !editCategoryId}
              fullWidth
            >
              {savingModel ? t(language, "modelsUploading") : isCreating ? t(language, "modelsCreateButton") : t(language, "modelsSaveButton")}
            </Button>
          </Stack>
        </Grid>
        {showMediaPanel && (
          <Grid item xs={12} md={5}>
            <Paper variant="outlined" sx={{ p: 1.5, borderStyle: "dashed", borderColor: "divider", bgcolor: "background.default" }}>
              <Stack spacing={1.5}>
                <Typography variant="subtitle2" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <AttachFileIcon fontSize="small" />
                  {t(language, "modelsImagesSection")}
                </Typography>
                {!imagesEnabled && (
                  <Alert severity="info" variant="outlined">{t(language, "modelsImagesDisabledHint")}</Alert>
                )}
                {imagesEnabled && (
                  <>
                    {detail?.images.length ? (
                      <List dense disablePadding>
                        {detail.images.map((img) => (
                          <ListItem key={img.id} disableGutters secondaryAction={
                            <IconButton size="small" color="error" onClick={() => deleteImage(img.id)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          }>
                            <ListItemText primary={img.url.split("/").pop() || img.url} primaryTypographyProps={{ variant: "body2", noWrap: true }} />
                          </ListItem>
                        ))}
                      </List>
                    ) : (
                      <Box sx={{ p: 2, border: "1px dashed", borderColor: "divider", borderRadius: 1.5, textAlign: "center" }}>
                        <ImageIcon sx={{ mb: 0.5, color: "text.secondary" }} />
                        <Typography variant="body2" color="text.secondary">{t(language, "modelsNoImages")}</Typography>
                      </Box>
                    )}
                    <Divider />
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      <input type="file" accept="image/*" ref={fileInputRef} style={{ display: "none" }} onChange={handleFileChange} />
                      <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} style={{ display: "none" }} onChange={handleFileChange} />
                      <Button variant="outlined" size="small" startIcon={uploading ? <CircularProgress size={16} /> : <UploadFileIcon />} onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                        {uploading ? t(language, "modelsUploading") : t(language, "modelsUploadButton")}
                      </Button>
                      <Button variant="outlined" size="small" startIcon={<PhotoCameraIcon />} onClick={() => cameraInputRef.current?.click()} disabled={uploading}>
                        {t(language, "modelsCameraButton")}
                      </Button>
                    </Stack>
                    {attachName && <Typography variant="caption" color="text.secondary">{attachName}</Typography>}
                  </>
                )}
              </Stack>
            </Paper>
          </Grid>
        )}
      </Grid>
    </Box>
  );

  return (
    <Container maxWidth="lg">
      <Stack spacing={2}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h4">{t(language, "modelsTitle")}</Typography>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" startIcon={<PrintIcon />} onClick={printScheda}>
              {t(language, "modelsPrintCard")}
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={startCreate} disabled={atMaxModels}>
              {t(language, "modelsCreateButton")}
            </Button>
          </Stack>
        </Stack>
        {!imagesEnabled && (
          <Alert severity="info" variant="outlined">{t(language, "modelsImagesDisabledHint")}</Alert>
        )}
        {message && <Alert severity="error" onClose={() => setMessage("")}>{message}</Alert>}
        <Collapse in={isCreating}>
          <Paper variant="outlined" sx={{ mb: 1 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 2, pt: 1.5 }}>
              <Typography variant="subtitle2">{t(language, "modelsCreateButton")}</Typography>
              <IconButton size="small" onClick={() => setIsCreating(false)}><CloseIcon fontSize="small" /></IconButton>
            </Stack>
            {editPanel}
          </Paper>
        </Collapse>
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, width: 72 }}>{t(language, "modelsPreviewColumn")}</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>{t(language, "modelsNamePlaceholder")}</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>{t(language, "modelsCodeColumn")}</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>{t(language, "modelsCategoryPlaceholder")}</TableCell>
                <TableCell align="right" sx={{ width: 100 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {models.map((model) => (
                <React.Fragment key={model.id}>
                  <TableRow
                    hover
                    sx={{ cursor: "pointer", "& > td": { borderBottom: expandedId === model.id ? "none" : undefined } }}
                    onClick={() => openModel(model.id)}
                    selected={expandedId === model.id}
                  >
                    <TableCell sx={{ width: 72, p: 1 }}>
                      {model.imageUrl ? (
                        <Avatar variant="rounded" src={model.imageUrl} sx={{ width: 40, height: 40 }} />
                      ) : (
                        <Avatar variant="rounded" sx={{ width: 40, height: 40, bgcolor: imagesEnabled ? "action.hover" : "action.disabledBackground" }}>
                          {imagesEnabled ? <ImageIcon fontSize="small" color="disabled" /> : <HideImageIcon fontSize="small" color="disabled" />}
                        </Avatar>
                      )}
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <Typography fontWeight={600}>{model.name}</Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Chip size="small" variant="outlined" label={model.code || "-"} sx={{ "& .MuiChip-label": { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" } }} />
                    </TableCell>
                    <TableCell>
                      <Stack spacing={0.5}>
                        <Chip size="small" label={getCategoryName(model.categoryId)} />
                        {model.levelId && <Chip size="small" variant="outlined" label={getLevelName(model.levelId)} />}
                      </Stack>
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); openModel(model.id); }} color="primary"><EditIcon fontSize="small" /></IconButton>
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); deleteModel(model.id); }} color="error"><DeleteIcon fontSize="small" /></IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={tableColumnCount} sx={{ p: 0 }}>
                      <Collapse in={expandedId === model.id} unmountOnExit>
                        <Divider />
                        {editPanel}
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              ))}
              {models.length === 0 && (
                <TableRow>
                  <TableCell colSpan={tableColumnCount} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>{t(language, "modelsSelectHint")}</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Stack>
    </Container>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd frontend
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Models.tsx
git commit -m "feat: update Models page — add level selector, inline team members form, remove teamId field"
```

---

## Task 8: Frontend + i18n — Add Missing Translation Keys

**Files:**
- Modify: `frontend/src/lib/i18n.ts`

- [ ] **Step 1: Add keys to both `it` and `en` translations in i18n.ts**

In the `it` block, add after `modelsTeamPlaceholder`:
```typescript
    modelsLevelPlaceholder: "Livello",
    modelsNoLevel: "Nessun livello",
    modelsIsTeam: "È un team?",
    modelsAddMember: "Aggiungi membro",
    modelsMemberName: "Nome",
    modelsMemberSurname: "Cognome",
    modelsMemberRole: "Ruolo",
```

In the `en` block, add the same keys:
```typescript
    modelsLevelPlaceholder: "Level",
    modelsNoLevel: "No level",
    modelsIsTeam: "Is a team?",
    modelsAddMember: "Add member",
    modelsMemberName: "First name",
    modelsMemberSurname: "Last name",
    modelsMemberRole: "Role",
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd frontend
npx tsc --noEmit
```

Expected: no errors about missing translation keys.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/i18n.ts
git commit -m "feat: add i18n keys for levels and team members"
```

---

## Task 9: Admin — Add Levels Management to Admin Page

**Files:**
- Modify: `frontend/src/pages/Admin.tsx`

The Admin page already manages categories, events, team-roles etc. Add a new section for Levels CRUD.

- [ ] **Step 1: Read Admin.tsx to understand existing pattern**

Read `frontend/src/pages/Admin.tsx` fully before editing to follow the existing section pattern (accordion or tab-based).

- [ ] **Step 2: Add Levels section**

Find where team-roles section is defined (search for `team-roles` or `teamRoles`). Add a Levels section following the same UI pattern (list + add form + delete). The API calls are:
- `GET /admin/levels` → `Level[]`
- `POST /admin/levels` body `{ name: string }` → `{ id: string }`
- `PUT /admin/levels/:levelId` body `{ name: string }` → `{ updated: true }`
- `DELETE /admin/levels/:levelId` → `{ deleted: true }`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Admin.tsx
git commit -m "feat: add levels management section to Admin page"
```

---

## Task 10: Verify End-to-End

- [ ] **Step 1: Start backend**

```bash
cd backend
bun run src/bootstrap/server.ts
```

Expected: server starts on port 3000, no errors.

- [ ] **Step 2: Start frontend**

```bash
cd frontend
npm run dev
```

Expected: dev server starts, no build errors.

- [ ] **Step 3: Manual smoke test**

1. Login as admin → Admin page → Levels section → create level "Principiante"
2. Navigate to Models → click "Iscrivi modello"
3. Verify: level selector shows "Principiante"
4. Verify: "È un team?" checkbox present
5. Check "È un team?" → add 2 members → fill name/surname/role
6. Submit → verify model created
7. Click model row → verify level chip shown, team members editable
8. Verify no "Teams" tab in navigation

- [ ] **Step 4: Final commit (if any loose changes)**

```bash
git add -A
git status  # review before committing
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Task 1 — Remove teams tables, add levels + model_team_members, seqId on categories, levelId + displayNumber on models
- [x] Task 2 — Delete Teams.tsx, team.routes.ts, team-roles.routes.ts; remove from app.ts
- [x] Task 3 — New levels CRUD route (admin + public)
- [x] Task 4 — New model code format M{catSeqId}-{displayNumber}-{modelCode}
- [x] Task 5 — DisplayNumber computation logic in POST /models; inline team members CRUD
- [x] Task 6 — Remove Teams from frontend nav + routes
- [x] Task 7 — Models.tsx: level selector + inline team members form
- [x] Task 8 — i18n keys for new UI
- [x] Task 9 — Admin UI for levels CRUD
- [x] Task 10 — Smoke test

**Gaps noted:**
- `admin-models.routes.ts` — still imports `teamsTable` / references `teamId`. Fix in Task 2 or as a follow-up — check imports after schema change and remove team references.
- `export.routes.ts` — may reference `teamId` in model card PDF generation. Verify and update if needed.
- `public.routes.ts` — may JOIN models with teams. Remove JOIN after schema change.

These should be verified in Task 2 (build step) — TypeScript errors will surface them.
