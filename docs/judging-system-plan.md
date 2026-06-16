# Judging System Implementation Plan

> Source: `docs/judging-system.md` + product owner decisions (2026-06-16)
> Branch: `feat/teams-levels-displaynumber`
> Stack: Bun + Elysia + Drizzle/Postgres, React + MUI + TypeScript

---

## PO Decisions (confirmed)

| # | Decision |
|---|---|
| 1 | **Anonymisation**: judges see only `code`/`displayNumber` — no model name, no participant identity |
| 2 | **Auto-close**: category closes automatically when ALL assigned judges complete their votes; awards frozen at that moment |
| 3 | **Award calculation**: sum all judges' vote values → lookup medal bracket by `lowLimit ≤ total ≤ highLimit` (configurable per event) |
| 4 | Phase 2 / Voting Delta → deferred to v2 |
| 5 | Vote clearing on model category change → paused |

---

## Vote / Medal Example

Event settings: `Max votes per exhibitor = 3`, `Max vote different = 2` (delta — v2).

| Vote Value | Medal | Low | High |
|---|---|---|---|
| 0 | None | 0 | 0 |
| 1 | Highly Commended | 1 | 4 |
| 2 | Bronze | 5 | 7 |
| 3 | Silver | 8 | 10 |
| 4 | Gold | 11 | 12 |

3 judges × max 4 points = 12 max total. Medal = bracket where `lowLimit ≤ sumOfRanks ≤ highLimit`.

---

## 1. Gap Analysis (updated)

| Feature | Status | Notes |
|---|---|---|
| Score exhibitor tile | Partial | `POST /judge/vote` works (rank 0-4 needed, currently 0-3 — fix enum) |
| Anonymised tiles | Missing | Drop `name` from `/judge/models`; return `code`+`displayNumber` only |
| Subtractive list | Missing | Data exists (`currentRank`); need client-side filter + SHOW ALL toggle |
| Block voting on closed category | **Bug** | `VoteModel.execute` never checks `categories.status` |
| "Judging Complete" per judge | Missing | No completion tracking table/endpoint |
| Auto-close when all judges done | Missing | Trigger inside "Judging Complete" handler; closes category + freezes awards |
| Award brackets (configurable) | Missing | New `awardBracketsTable`; admin UI to configure per event |
| Award freeze at close | Missing | New `awardsTable`; populated on auto-close |
| Awards read post-close | Missing | After close: read frozen `awardsTable` instead of live votes |
| Head-judge override | Missing | `PATCH /awards/:id` after category closed |
| Live monitoring (% complete) | Missing | Endpoint + UI: judged/total per category |
| Class Corrections UI | Missing | Admin panel: award list, highlight errors, override action |
| Max votes per exhibitor setting | Missing | New setting key `maxVotesPerExhibitor` (default `"3"`) |

---

## 2. New Schema

### `awardBracketsTable`
```sql
CREATE TABLE award_brackets (
  id uuid PRIMARY KEY,
  event_id uuid NOT NULL,
  low_limit integer NOT NULL,
  high_limit integer NOT NULL,
  medal_label text NOT NULL,   -- "None", "Highly Commended", "Bronze", "Silver", "Gold"
  medal_rank integer NOT NULL, -- 0,1,2,3,4 (for ordering/display)
  created_at timestamptz DEFAULT now()
)
```

### `judgeCompletionsTable`
```sql
CREATE TABLE judge_completions (
  id uuid PRIMARY KEY,
  judge_id uuid NOT NULL,
  category_id uuid NOT NULL,
  completed_at timestamptz DEFAULT now(),
  UNIQUE (judge_id, category_id)
)
```

### `awardsTable`
```sql
CREATE TABLE awards (
  id uuid PRIMARY KEY,
  category_id uuid NOT NULL,
  model_id uuid NOT NULL,
  total_score integer NOT NULL,
  medal_label text NOT NULL,
  medal_rank integer NOT NULL,
  source text NOT NULL DEFAULT 'aggregate', -- 'aggregate' | 'override'
  frozen_at timestamptz DEFAULT now(),
  UNIQUE (category_id, model_id)
)
```

---

## 3. Ordered Task List

| # | Title | Scope | Key files | Cx | Wave |
|---|---|---|---|---|---|
| 1 | Fix vote rank enum 0-4 (was 0-3) | BACKEND | `judge.routes.ts` body schema; `votesTable` check | S | A |
| 2 | Block voting on closed categories | BACKEND | `application/VoteModel.ts`, `modelReadRepository.drizzle.ts` | S | A |
| 3 | Add `maxVotesPerExhibitor` setting default | BACKEND | `infra/http/settings.routes.ts` DEFAULTS | S | A |
| 4 | Add i18n keys (judging-complete, waiting, show-all, override, corrections, monitor, brackets) | FRONTEND | `lib/i18n.ts` | S | A |
| 5 | Schema: `awardBracketsTable`, `judgeCompletionsTable`, `awardsTable` + migration | BACKEND | `schema.ts`, `ensureTenantSchema.ts` | M | B |
| 6 | Anonymise `/judge/models` (code + displayNumber, no name/participant) | BACKEND | `judge.routes.ts` GET /models | M | B |
| 7 | Award brackets CRUD (admin) | BACKEND | new `award-brackets.routes.ts` | M | B |
| 8 | Award brackets UI in Admin | FRONTEND | `pages/Admin.tsx` new tab or section under "Gara" | M | B |
| 9 | Judge completion endpoint (`POST /judge/categories/:id/complete`) + auto-close + award freeze | BACKEND | `judge.routes.ts`, `category.routes.ts` (extract close logic), `award-freeze.ts` (new helper) | L | C |
| 10 | Subtractive tile UI + SHOW ALL toggle + "Judging Complete" button | FRONTEND | `pages/Judge.tsx` | M | C |
| 11 | Completion poll UI (waiting for other judges) | FRONTEND | `pages/Judge.tsx` | M | C |
| 12 | Awards read: post-close returns frozen `awardsTable` | BACKEND | `infra/http/award.routes.ts` | M | D |
| 13 | Head-judge override (`PATCH /awards/:id`) | BACKEND | `award.routes.ts` | M | D |
| 14 | Live monitoring endpoint (% complete per category) | BACKEND | new route in `award.routes.ts` or `monitoring.routes.ts` | M | D |
| 15 | Live monitoring UI (admin, auto-refresh) | FRONTEND | `pages/Admin.tsx` "Giudici" tab | M | D |
| 16 | Class Corrections UI (post-close override screen) | FRONTEND | `pages/Admin.tsx` "Premi" tab | M | D |
| 17 | Tests (tasks 2, 9, 12, 13) | BACKEND | new test files | M | E |

### Wave execution order
- **Wave A** (correctness, no deps): 1 → 2 → 3 → 4 (all small, sequential)
- **Wave B** (schema + admin foundation): 5 → 6/7/8 (6+7+8 parallel after 5)
- **Wave C** (Phase 1 flow, requires B): 9 → 10/11 (10+11 parallel after 9)
- **Wave D** (awards + monitoring, requires C): 12 → 13 → 14/15/16 parallel
- **Wave E** (tests): 17 after D complete

---

## 4. Auto-Close Logic (Task 9 detail)

```
POST /judge/categories/:categoryId/complete
  1. Mark judge as complete in judgeCompletionsTable (upsert)
  2. Count assigned judges for this category (judgeAssignmentsTable, scoped to category or event)
  3. Count completions for this category (judgeCompletionsTable)
  4. If completions >= assigned judges:
     a. For each model in category:
        - SELECT SUM(rank) WHERE modelId AND judgeId IN (assigned judges)
        - Lookup bracket: find bracket where lowLimit <= sum <= highLimit
        - INSERT INTO awardsTable (or UPDATE if exists)
     b. UPDATE categories SET status='closed' WHERE id=categoryId
  5. Return { completed: true, allDone: boolean, totalJudges: n, completedJudges: n }
```

---

## 5. Architectural Notes

- **Re-open semantics**: if admin manually re-opens a closed category (existing `PATCH .../status`), frozen awards and completions should be cleared. Add guard / cascade delete in the status-change handler.
- **Judge scope**: `judgeAssignmentsTable` has optional `categoryId`. When `categoryId IS NULL`, judge is assigned to whole event (all categories). Auto-close must check both scoped and event-wide assignments.
- **Award brackets per event**: brackets are event-level, not category-level. All categories in the same event share brackets.
- **Recommend**: short `software-architect` review of the freeze transaction (task 9 step 4) before implementation — concurrency between two judges completing simultaneously could cause double-freeze.

---

## 6. File Map

| File | Task(s) |
|---|---|
| `backend/src/contest/application/VoteModel.ts` | 1, 2 |
| `backend/src/contest/infra/persistence/modelReadRepository.drizzle.ts` | 2 |
| `backend/src/contest/infra/http/settings.routes.ts` | 3 |
| `frontend/src/lib/i18n.ts` | 4 |
| `backend/src/contest/infra/persistence/schema.ts` | 5 |
| `backend/src/tenancy/infra/persistence/ensureTenantSchema.ts` | 5 |
| `backend/src/contest/infra/http/judge.routes.ts` | 6, 9 |
| `backend/src/contest/infra/http/award-brackets.routes.ts` | 7 (new) |
| `frontend/src/pages/Admin.tsx` | 8, 15, 16 |
| `frontend/src/pages/Judge.tsx` | 10, 11 |
| `backend/src/contest/infra/http/award.routes.ts` | 12, 13, 14 |
