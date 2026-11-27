# API Reference

Base URL (dev): `http://localhost:3000`. The SPA calls the API under `API_BASE`
(default `/api`, reverse-proxied to the backend).

Interactive docs (Swagger UI): **`GET /docs`** — supports an *Authorize* button
for pasting a JWT.

## Conventions

- **Auth**: protected endpoints require `Authorization: Bearer <accessToken>`.
  The "Min role" column gives the minimum role enforced by `requireRole(...)`.
  Endpoints with min role `user` simply require any authenticated account.
- **Tenancy**: every request resolves a tenant DB via `tenantMiddleware`
  (selected by `PG_DB`).
- **Roles**: `user < staff < judge < jury_president < manager < admin`.
- **Money**: amounts are integer **cents**, currency `EUR`.
- **Errors**: failures return `{ "error": "<message>" }` with an appropriate
  status (`400` validation, `401` unauthenticated/invalid credentials, `403`
  forbidden, `404` not found, `409` conflict).
- IDs are UUID strings unless noted. Request bodies are JSON.
- **Permissions**: besides the role hierarchy, some actions are granted per role
  (see [Permissions](#permissions)). Currently only `enrollOnBehalf`.
- **Error codes**: some errors also carry `code` (see [Error codes](#error-codes)).

---

## Health

### `GET /health`
Auth: none. → `200 { "ok": true }`

---

## Auth routes (`/auth`)

No auth required (these issue/refresh tokens). Source: `identity.routes.ts`.

### `POST /auth/register`
Create a new account with default role `user`.

- Body: `{ "email": string, "password": string, "privacyAccepted": boolean, "privacyVersion": string }`
  (password min length 8; `privacyAccepted` must be `true`; `privacyVersion` 1–32 chars, the version of the
  privacy notice shown to the user). The server stores `users.privacy_accepted_at` and
  `users.privacy_policy_version` (GDPR accountability).
- `200`: `{ "id": string, "email": string, "role": "user" }`
- `400`: `{ "error": "The privacy notice must be accepted" }`, `{ "error": "Password must be at least 8 characters long" }` or
  `{ "error": "Email already registered" }` or `{ "error": "Invalid email" }`

```json
// POST /auth/register
{ "email": "mario@example.com", "password": "password123", "privacyAccepted": true, "privacyVersion": "2026-11-26" }
// → 200
{ "id": "8f3c…", "email": "mario@example.com", "role": "user" }
```

### `POST /auth/login`
Authenticate with password, receive tokens.

- Body: `{ "email": string, "password": string }`
- `200`: `{ "accessToken": string, "refreshToken": string, "expiresIn": number, "expires_in": number, "role": string }`
- `401`: `{ "error": "Invalid credentials" }` (wrong/unknown credentials)
- `400`: `{ "error": "User disabled" }`

```json
// POST /auth/login
{ "email": "admin@contest.it", "password": "Admin123!" }
// → 200
{ "accessToken": "eyJ…", "refreshToken": "eyJ…", "expiresIn": 86400, "expires_in": 86400, "role": "admin" }
```

### `POST /auth/refresh`
Exchange a valid refresh token for a fresh access + refresh pair.

- Body: `{ "refreshToken": string }`
- `200`: same shape as `/auth/login`.
- `401`: `{ "error": "Invalid refresh token" }`

**Judge sessions (`JUDGE_SESSION_HOURS`, integer 1..72, default 24).** Login (password, or PKCE `/auth/authorize`)
stamps the session start in the refresh token claim `sst` (epoch seconds); refreshes carry it unchanged.
For a user whose current DB role is `judge`, the refresh token expires at `sst + JUDGE_SESSION_HOURS` and a refresh
after that answers `401 Invalid refresh token`: the judge logs in again. Other roles keep the normal 30-day sliding
refresh. Refresh tokens issued before `sst` existed count from their `iat`. Access tokens (15 min) are not changed:
a judge's access token can outlive the session by at most its own TTL.

### `POST /auth/authorize` (PKCE step 1)
- Body: `{ "email": string, "password": string, "code_challenge": string, "code_challenge_method": "S256" }`
- `200`: `{ "code": string }` · `400` unsupported method/invalid · `401` bad credentials.

### `POST /auth/token` (PKCE step 2)
- Body: `{ "code": string, "code_verifier": string }` (verifier length 43–128).
- `200`: token bundle (same shape as `/auth/login`) · `400` invalid/expired code or verifier.

> There is no `/auth/logout` endpoint. Logout is client-side: the SPA clears
> stored tokens (`clearToken()` in `frontend/src/lib/auth.ts`).

---

## User routes (`/users`)

Min role: `user`. Requires Bearer token. Source: `user.routes.ts`.

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/users/profile` | — | profile object (id, email, role, firstName, lastName, phone, city, address, emergencyContact, emergencyContactName, avatarUrl) or `null` |
| PUT | `/users/profile` | `{ firstName?, lastName?, phone?, city?, address?, emergencyContact?, emergencyContactName? }` | `{ "updated": true }` |

```json
// GET /users/profile → 200
{ "id": "…", "email": "mario@example.com", "role": "user",
  "firstName": "Mario", "lastName": "Rossi", "phone": "+39…",
  "city": "Roma", "address": null, "emergencyContact": null,
  "emergencyContactName": null, "avatarUrl": null }
```

---

## Contest / Models routes (`/models`)

Min role: `user` (operations are scoped to the authenticated owner). Sources:
`model.routes.ts`, `modelUpload.routes.ts`.

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/models?search=<q>` | — | array of `{ id, name, description, code, categoryId, levelId, imageUrl, isTeam, teamId, teamCode, displayNumber }` (code is formatted string or null) |
| POST | `/models` | `{ name, categoryId, levelId, description?, notes?, imageUrl?, isTeam?, teamMembers?: [{ name, surname, email?, roleId }], userId? }` | `{ id, code }` |
| GET | `/models/:modelId` | — | `{ model, images, teamMembers: [{ id, modelId, name, surname, role, roleId, email }] }` or `404` |
| PUT | `/models/:modelId` | `{ name?, categoryId?, levelId?, description?, notes?, imageUrl?, isTeam?, teamMembers? }` | `{ "updated": true }` |
| DELETE | `/models/:modelId` | — | `{ "deleted": true }` |
| POST | `/models/:modelId/images` | `{ url }` | `{ id }` |
| DELETE | `/models/:modelId/images/:imageId` | — | `{ "deleted": true }` |
| POST | `/models/:modelId/image-upload` | `{ contentType }` | `{ uploadUrl, publicUrl }` (presigned MinIO PUT) |

```json
// POST /models
{ "name": "Space Marine", "categoryId": "…", "levelId": "…", "isTeam": false }
// → 200
{ "id": "…", "code": "MSS-00001" }

// POST /models/:id/image-upload
{ "contentType": "image/png" }
// → 200
{ "uploadUrl": "http://localhost:9000/models/…?X-Amz-…", "publicUrl": "http://localhost:9000/models/…" }
```

Model display codes are formatted from `code` + category seq + `displayNumber`
using tenant settings (prefix/digits), see `model-code.ts`. Team models use
`<participant number>T<n>` instead (e.g. `173T1`), in every view and export.

`notes` may be `null` on `POST` and `PUT` (on `PUT` it clears the note).

**Enrolling on behalf of another participant** (`POST /models` with `userId`):
- `userId` (uuid) is the owner; omitted or equal to the caller = own model.
- Needs the `enrollOnBehalf` permission. The owner gets the model, code, display
  number, team code, model limit and fee. A legacy `teamId` must belong to the owner.
- `403 { code: "PERMISSION_DENIED" }` · `404 { code: "USER_NOT_FOUND" }`
  (unknown or disabled user) · `422` if `userId` is not a uuid.
- The enrollment window depends on the **role**: only `manager`/`admin` bypass it
  (`403 { "error": "Enrollment period is closed" }`), the permission alone does not.
- The created model is not listed by the caller's `GET /models`, and the
  `/models/:modelId*` routes stay owner-only. `manager`+ can use
  `/admin/models`; lower roles holding the permission cannot edit or delete it,
  nor upload images for it.

**Inline team** (`POST` / `PUT`):
- `roleId` comes from `GET /public/member-roles`; free-text `role` is accepted
  only for older clients. Omit `email` when empty.
- `teamId` is still accepted (legacy) but no longer required.
- On `PUT`, `teamMembers` replaces the list; `isTeam: false` clears it.
- `422 { error, code: "TEAM_MEMBERS_REQUIRED" | "INVALID_MEMBER_ROLE" }`
- `409 { error, code: "MODEL_LIMIT", limit: 50 }` (max 50 models per
  participant per event).

```json
// POST /models
{ "name": "Diorama", "categoryId": "…", "levelId": "…", "isTeam": true,
  "teamMembers": [{ "name": "Anna", "surname": "Bianchi", "roleId": "…" }] }
// → 200
{ "id": "…", "code": "173T1" }
```

---

## Enrollment routes

Sources: `enrollment.routes.ts`, `event.routes.ts`.

| Method | Path | Min role | Body | Response |
|--------|------|----------|------|----------|
| POST | `/events/:eventId/enroll` | user | `{ modelId?, categoryId? }` | `{ id, status: "accepted" }` (`400 Already enrolled` for duplicate user+event+model) |
| GET | `/enrollments` | user | — | array of own registrations |
| GET | `/enrollments/:enrollmentId` | user | — | registration object or `404` |
| GET | `/admin/enrollments?eventId=<id>` | jury_president | — | all registrations (optionally by event); `403 SECTION_HIDDEN` if `dashboard` is hidden for jury_president |

Registration shape: `{ id, userId, eventId, modelId, categoryId, status, checkedIn }`.

**Enrolling another user's model**: allowed to `manager`/`admin` and to roles with
`enrollOnBehalf`; the registration is owned by the **model owner**. Without either,
another user's `modelId` answers `404 NOT_FOUND`. Only `manager`/`admin` bypass
the enrollment window.

| Status | `code` | Case |
|--------|--------|------|
| 403 | `ENROLLMENT_CLOSED` | enrollment window over |
| 404 | `NOT_FOUND` | event or model not found / not accessible |
| 409 | `EVENT_CLOSED`, `CATEGORY_CLOSED` | event or category closed |
| 422 | `INVALID_CATEGORY`, `CATEGORY_EVENT_MISMATCH`, `CATEGORY_MODEL_MISMATCH` | inconsistent category |

---

## Check-in & QR routes

Sources: `enrollment.routes.ts` (staff), `qr.routes.ts`.

| Method | Path | Min role | Response |
|--------|------|----------|----------|
| POST | `/staff/checkin/:enrollmentId` | staff | `{ "checkedIn": true }` |
| GET | `/staff/print/:enrollmentId` | staff | HTML badge (86×54mm) embedding a QR; `404` if not found |
| GET | `/qr/:enrollmentId` | none | SVG QR (`image/svg+xml`) |
| GET | `/qr/:enrollmentId/png` | none | PNG QR (`image/png`) |
| GET | `/qr/:enrollmentId/data` | none | `{ enrollmentId, qrPayload: "enrollment:<id>" }` |

### Desk attendance (by participant number) — `desk.routes.ts`
Participant number = `users.seq_id`. Presence of a participant in an event = at least one of his registrations of the event has `checked_in = true`. `POST /staff/checkin/:enrollmentId` (single enrollment) is unchanged.

| Method | Path | Min role | Response |
|--------|------|----------|----------|
| GET | `/staff/events/:eventId/participants/:number` | staff | `{ userId, participantNumber, name, country, present, models: [{ id, name, code, categoryName, displayNumber }] }`. `404` no such participant or no registration in the event; `422` invalid uuid or non-numeric number |
| POST | `/staff/events/:eventId/participants/:number/presence` | staff | body `{ "present": boolean }`: sets `checked_in = present` and `absent = !present` on all the participant's registrations in the event. `{ userId, participantNumber, present, updated }`; `404` / `422` as above |
| GET | `/staff/events/:eventId/attendance` | staff | `{ registeredParticipants, presentParticipants }` (distinct participants) |

---

## Payments routes (`/payments`)

Source: `payment.routes.ts`.

| Method | Path | Min role | Body | Response |
|--------|------|----------|------|----------|
| POST | `/payments/checkout` | user | `{ enrollmentId, amount, providerRef? }` | `{ paymentId, status: "pending" }` |
| POST | `/payments/confirm` | user | `{ paymentId, enrollmentId }` | `{ "paid": true }` |
| POST | `/payments/webhook` | none | `{ paymentId, status }` | `{ "received": true }` |

---

## Events / Categories / Levels / Sponsors / Member-roles

### Events (`/events`) — min role `manager` — `event.routes.ts`
`jury_president` reads events via `GET /public/events?status=all`.

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/events` | — | array of events |
| POST | `/events` | `{ name, status, startDate?, endDate? }` | `{ id }` |
| GET | `/events/:eventId` | — | event or `null` |
| PUT | `/events/:eventId` | `{ name?, status?, startDate?, endDate? }` | `{ "updated": true }` |
| DELETE | `/events/:eventId` | — | `{ "deleted": true }` |

### Categories (`/categories`) — min role `manager` — `category.routes.ts`
| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/categories?eventId=<id>` | — | array of categories |
| POST | `/categories` | `{ eventId, name }` | `{ id }` (`409` if name exists in event) |
| PUT | `/categories/:categoryId` | `{ name? }` | `{ "updated": true }` |
| DELETE | `/categories/:categoryId` | — | `{ "deleted": true }` |
| PATCH | `/categories/:categoryId/status` | `{ status: "open" \| "closed" }` | `{ updated, status }` — closing requires at least one assigned judge (`409 NO_JUDGES`); missing votes are allowed (see Awards rules) |

### Public read endpoints (min role `user`)
| Method | Path | Source |
|--------|------|--------|
| GET | `/public/events?status=<active\|all\|…>` | `public.routes.ts` (no auth) |
| GET | `/public/categories?eventId=<id>` | `public-categories.routes.ts` |
| GET | `/public/levels` | `levels.routes.ts` |
| GET | `/public/member-roles` | `member-roles.routes.ts` |

### Levels (`/admin/levels`) — min role `manager` — `levels.routes.ts`
GET `/` → `[{ id, name, sortOrder, freeToEnter }]`,
POST `/` `{ name, sortOrder?, freeToEnter? }`,
PUT `/:id` `{ name?, sortOrder?, freeToEnter? }`, DELETE `/:id`.
Models of a `freeToEnter` level cost nothing.

### Member roles (`/admin/member-roles`) — min role `manager` — `member-roles.routes.ts`
GET `/` → `[{ id, name, price }]` (same shape as `GET /public/member-roles`),
POST `/` `{ name, price? }`, PUT `/:id` `{ name?, price? }`, DELETE `/:id`.
`price` is the coauthor price in cents (0–1000000, default 1500).
Names are unique ignoring case and surrounding spaces: `POST`/`PUT` answer
`409 { "error": "Role name already exists" }`. At startup existing duplicates are
merged and coauthors remapped.

### Sponsors (`/sponsors`) — min role `manager` — `sponsor.routes.ts`
| Method | Path | Body |
|--------|------|------|
| GET | `/sponsors?eventId=<id>` | — |
| POST | `/sponsors` | `{ eventId, name, logoUrl?, websiteUrl?, description?, tier?: bronze\|silver\|gold\|platinum }` |
| PUT | `/sponsors/:sponsorId` | partial of above |
| DELETE | `/sponsors/:sponsorId` | — |

### Event campaigns (`/admin/event-campaigns`) — min role `manager` — `event-campaigns.routes.ts`
GET `/?eventId=<id>`, POST `/` `{ eventId, name, enrollmentOpenDate?, enrollmentCloseDate? }`,
PUT `/:campaignId`, DELETE `/:campaignId`.

---

## Judging routes (`/judge`)

Min role: `judge`. Sources: `judge.routes.ts`, `modification-request.routes.ts`.

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/judge/events` | — | `[{ eventId, eventName }]` (assigned events) |
| GET | `/judge/models?eventId=&search=` | — | judgeable models incl. `currentRank`, `voteCount`, `teamCode` |
| GET | `/judge/models/:modelId` | — | `{ model, images }` |
| GET | `/judge/models/:modelId/votes` | — | `[{ id, rank, createdAt }]` (this judge's history) |
| GET | `/judge/participants/:userId` | — | `{ profile, registrations }` |
| GET | `/judge/categories?eventId=<id>` | — | `[{ id, name }]` |
| POST | `/judge/vote` | `{ modelId, rank: 0..4 }` | `{ voteId, updated }` (`403 OWN_MODEL` on own models) |
| GET | `/judge/displays?eventId=&categoryId=` | — | displays the judge may vote (see below) |
| POST | `/judge/displays/vote` | `{ eventId, displayNumber, rank: 0..4 }` | `{ eventId, displayNumber, rank, votes, skippedClosedModelIds }` |
| POST | `/judge/categories/:categoryId/complete` | — | `{ completed, allDone, totalJudges, completedJudges, phase, discordantModelIds? }` |
| GET | `/judge/categories/:categoryId/completion` | — | `{ categoryId, status, phase, totalJudges, completedJudges, allDone, discordantModelIds? }` |
| GET | `/judge/modification-requests` | — | this judge's category-change requests |
| POST | `/judge/modification-requests` | `{ modelId, reason, suggestedCategoryId? }` | `{ id }` |

```json
// POST /judge/vote
{ "modelId": "…", "rank": 2 }
// → 200
{ "voteId": "…", "updated": false }
```

### Display voting
A *display* is the set of models of one event sharing a `displayNumber`.

```
GET /judge/displays → [{ eventId, displayNumber, votable, currentRank, judged, issues,
  models: [{ id, name, code, categoryId, categoryName, categoryStatus, imageUrl, currentRank }] }]
```

- `votable` is false when every category is closed. The display `currentRank` is
  set only when all its models share it, otherwise `null`.
- `judged` is true when the judge has voted every model of the display in an open category.
- `issues` is `["DISCORDANT_VOTES"]` only for a display holding a discordant model of a category in reconciliation; otherwise `[]`. Owner identity is never returned.
- `POST /judge/displays/vote` applies the rank to every votable model in one
  transaction (own models are skipped). `votes` is `[{ modelId, voteId, updated }]`; models of closed
  categories are listed in `skippedClosedModelIds`.
- `404` unknown display · `403 OWN_MODEL` only own models remain · `403` no model in the judge's scope ·
  `409 CATEGORY_CLOSED` all categories closed.

### Own models, stand-ins and reconciliation
- A judge never sees nor votes a model he owns (excluded from `GET /judge/models` and `GET /judge/displays`; `403 OWN_MODEL` on the vote routes and `GET /judge/models/:modelId`).
- A missing model (see Mark Missing) is excluded from `GET /judge/models`, `GET /judge/displays`, `GET /judge/participants/:userId`, the display vote and the vote routes (`404`); `GET /judge/models/:modelId` answers `{ model: null }` as for an unknown id.
- **Absence register** (setting `absenceRegisterEnabled` = `"true"`): a model whose owner has no checked-in registration in the event is not visible to judges (`GET /judge/models`, `GET /judge/displays`) and not votable (vote routes and `GET /judge/models/:modelId` answer `403`). It is also ignored by expected voters and completion, like a missing model, so it gets no award row. Managers and admins are not filtered. Default `"false"`: no change.
- **Stand-in** (`standingIn` on a category assignment): sees and votes only the models of that category owned by regular (non stand-in) judges assigned to it.
- **Expected voters** of a model owned by `U` in category `C`: regular judges of `C` (directly or event-wide) minus `U`; if `U` is himself a regular judge of `C`, also the stand-ins of `C` minus `U`. Awards rank only from expected voters; `PARTIAL_VOTES` when `0 < v < expected`. A judge's completion needs a vote on every model he is expected to vote; a category waits for the judges who are expected voters of at least one model (`409 NO_JUDGES` when nobody is assigned).
- **Reconciliation**: when every counted judge completed and discordant votes remain, the category stays open (`phase: "reconciliation"`, `discordantModelIds`). Every vote (single or display) re-evaluates it and closes it as soon as no discordance is left. The manager close works at any time.

---

## Awards routes

Sources: `award.routes.ts`, `ceremony.routes.ts`, `special-mention.routes.ts`. Min role: `manager`,
except `/awards/monitoring/:eventId`.

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/awards/events/:eventId` | — | ranking: `[{ id, modelId, modelName, code, displayNumber, categoryId, categoryName, averageRank, votes, totalScore, medalLabel, medalRank, source, issues, overrideNote }]` sorted desc. `source`: `aggregate` (frozen at closing), `override` (changed by the head judge), `live` (open class preview: `id` null, `votes`/`averageRank` set). `issues: string[]` (`[]` when none, always present; live rows always `[]`). Missing models are left out |
| PATCH | `/awards/:awardId` | `{ medalLabel, medalRank, note? }` (`note` max 200) | `{ "updated": true }`. Min role `jury_president` (head judge). The medal must be `None`/0 or a bracket of the event with the same label **and** rank, else `422 INVALID_MEDAL`. Open class: `409 CATEGORY_NOT_CLOSED`. Sets `source: "override"`, clears `issues`, stores `overrideNote` and `overriddenBy` |
| GET | `/awards/categories/:categoryId/review` | — | Min role `jury_president`. Closed class only (`409 CATEGORY_NOT_CLOSED`): `{ categoryId, categoryName, eventId, brackets: [{ medalLabel, medalRank, lowLimit, highLimit }], rows: [{ modelId, name, code, displayNumber, totalScore, issues, source, overrideNote, award: { id, medalLabel, medalRank } \| null, votes: [{ judgeName, rank }] }] }`. `votes` are the latest vote of each judge (`judgeName` = profile name, else `Giudice <n>`). Missing models are left out |
| GET | `/awards/monitoring/:eventId` | — | live judging progress per category. Min role `jury_president`; `403 SECTION_HIDDEN` if `dashboard` is hidden |
| GET | `/awards/events/:eventId/live` | — | live statistics of the event (same role and section rule as monitoring; `422` if `eventId` is not a uuid). `{ updatedAt, totals: { classes, closed, models, votesCast, votesExpected, percent, medals: { [medalLabel]: count } }, classes: [{ categoryId, name, classNumber, presentationOrder, phase, models, votesCast, votesExpected, percent, judgesTotal, judgesCompleted, discordant, medals }] }`. `phase`: `judging` \| `reconciliation` (all judges done, discordant votes left) \| `closed`. `votesExpected` = expected votes of the judged models (missing and absent owners excluded); `votesCast` = those already cast; `percent` = integer 0–100. `discordant` = models with `DISCORDANT_VOTES` on the current votes. `medals`: open class → **projected** from the current votes (same scoring as closing), closed class → **frozen** awards (overrides included); `None` is counted like any label. Classes ordered by `presentationOrder`, `classNumber`, `name` |
| GET | `/awards/events/:eventId/ceremony` | — | ceremony data. `{ classes, honors }`. `classes`: only **closed** classes with at least one medal above None, ordered by `presentationOrder`, then `classNumber` (numeric), then name: `[{ categoryId, name, classNumber, presentationOrder, prizes }]`. `prizes` ordered by the prize-order setting (`GET /settings/prize-order`), then `medalRank`, then display: `[{ medalLabel, medalRank, displayNumber, exhibitor, modelName, modelCode, wholeDisplay }]`. A display whose models (at least two) all got the same medal is one prize with `wholeDisplay: true` (`modelName`/`modelCode` null). `honors`: only assigned special awards, in catalogue order: `[{ code, name, sortOrder, categoryName, displayNumber, exhibitor, modelName, wholeDisplay }]`. Manager only |
| GET | `/awards/mentions` | — | all special mentions |
| GET | `/awards/mentions/events/:eventId` | — | mentions for event |
| POST | `/awards/mentions` | `{ eventId, modelId, title, description? }` | `{ id }` |
| DELETE | `/awards/mentions/:mentionId` | — | `{ "deleted": true }` |

**Judging rules (applied at closing, `closeCategory`):**
- Settings `maxVotesPerExhibitor` = N (default `3`) and `maxVoteDifferent` = D (default `2`); invalid or missing values fall back to the defaults.
- Only the latest vote of each expected voter of the model counts. With `v` voters: `totalScore = round(sum(ranks) * N / v)`; no votes => `0` (`None`).
- Issues: `PARTIAL_VOTES` when `0 < v < expected voters of the model`; `DISCORDANT_VOTES` when `v > 1` and `max(ranks) * v - sum(ranks) > D`. Stored in `awards.issues` (JSON array, null when none).
- Manager close (`PATCH /categories/:id/status`) no longer requires every judge to vote every model. The judge completion path (`POST /judge/categories/:categoryId/complete`) still does.
- **Missing models** (`models.missing`, see Admin models) are not judged: no expected voters, no completion weight, and **no award row** (choice: they are left out of the awards lists, the review and the ranking; they still appear in the manager's admin lists and printouts).
- The head judge may override a frozen award (`PATCH /awards/:awardId`) and reviews a closed class with `GET /awards/categories/:categoryId/review`; a reopen deletes the awards (and the overrides with them).

### Award brackets (`/admin/award-brackets`) — min role `manager` — `award-brackets.routes.ts`
| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/admin/award-brackets/preset` | `{ eventId }` | replaces all brackets of the event (one transaction) with the MSS preset and returns the list: None 0-0, Highly Commended 1-4, Bronze 5-7, Silver 8-10, Gold 11-12; `404` if event missing |
| PUT | `/admin/award-brackets/:bracketId` | `{ medalLabel?, medalRank?, lowLimit?, highLimit? }` | updated row (merged with stored values); `404` if missing |
| POST | `/admin/award-brackets` | `{ eventId, medalLabel, medalRank, lowLimit, highLimit }` | `{ id }` |

Validation (POST and PUT, after merging): `medalLabel` 1–40 chars; `medalRank` integer 0–10; `lowLimit`/`highLimit` integers >= 0 with `lowLimit <= highLimit`; otherwise `422`.

---

### Special awards (`/admin/honors`) — min role `manager` — `honors.routes.ts`
Catalogue of special awards per event (e.g. "Best Of Show"). Each honor is assigned at most once, to a whole display or to one of its models. `code` 1–20 characters, `name` 1–120, unique per event (case-insensitive).

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/admin/honors?eventId=<id>` | — | `[{ id, code, name, sortOrder, assignment }]` in catalogue order. `assignment`: `{ categoryId, categoryName, displayNumber, modelId, modelName, modelCode, wholeDisplay, exhibitor }`, or `null` when not assigned. `422` without a valid `eventId` |
| POST | `/admin/honors` | `{ eventId, code, name, sortOrder? }` | `{ id }`. `sortOrder` defaults to last + 1. `409 DUPLICATE_CODE`; `404` unknown event |
| PUT | `/admin/honors/:id` | `{ code?, name?, sortOrder? }` | updated row (merged with stored values). `404`; `409 DUPLICATE_CODE` |
| DELETE | `/admin/honors/:id` | — | `{ "deleted": true }`. `409 HONOR_ASSIGNED` while assigned |
| POST | `/admin/honors/preset` | `{ eventId }` | adds the MSS catalogue (28 entries, in catalogue order), skipping codes already present: `{ inserted, honors }`. Idempotent. `404` unknown event |
| POST | `/admin/honors/:id/assign` | `{ categoryId, displayNumber, modelId? }` | the honor with its `assignment`. No `modelId` = whole display. `409 ALREADY_ASSIGNED`; `422 CATEGORY_NOT_IN_EVENT`; `422 DISPLAY_NOT_FOUND` (no model with that display number in the class); `404 MODEL_NOT_FOUND`; `422 MODEL_NOT_IN_DISPLAY`; `404` unknown honor |
| DELETE | `/admin/honors/:id/assignment` | — | `{ "deleted": true }`. `404` when not assigned |

MSS catalogue (code — name): bop Best Of Painter, bos Best Of Show, bs Best Of Sculpture, boss Best Of Standard, bomm Best Of Military Modelling, bosf Best Of Sci-Fi, bot Best Of Time Chronicles, boc Best Of Creativity, bof Best Of Fantasy, boh Best Of Historical, ph Platinum Historical, pf Platinum Fantasy, pt Platinum Time Chronicles, hst Handmade Sculpture Trophy, mm72 Military Modelling 1/72 Trophy, mm35 Military Modelling 1/35 Trophy, act Ancient Trophy, mt Medieval Trophy, cup35 1:35 Cup Trophy, rcm Roma Caput Mundi Trophy, jmt Joachim Murat Trophy, acw American Civil War Trophy, aag Aldo & Giorgio Taucer Trophy, lp Legio Pictorum Trophy, vvw Verkos Vault Wargame Trophy, vvc Verkos Vault Cinema Trophy, vvfs Verkos Vault Fantasy Scene, ap Andrea Pivato.

Tables: `honors` (unique `(event_id, lower(code))`) and `honor_assignments` (unique `honor_id`, `model_id` null = whole display). Both are created idempotently by `ensureTenantSchema.ts`.

---

## Admin routes

### User administration (`/admin/users`) — min role `manager` — `admin.routes.ts`
| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/admin/users` | `{ email, password, role? }` (password min 8) | `{ id, email, role }` (`409` duplicate) |
| GET | `/admin/users` | — | `[{ id, email, role, isActive }]` |
| GET | `/admin/users/:userId/profile` | — | full profile or `404` |
| PUT | `/admin/users/:userId/profile` | profile fields | `{ "updated": true }` |
| PATCH | `/admin/users/:userId` | `{ role?, isActive? }` | `{ "updated": true }` |
| POST | `/admin/users/:userId/reset-password` | — | `{ emailSent: true }` (temporary password sent by email only; `503 { error, emailSent: false }` and no change if email is unavailable) |

#### `GET /admin/users/enrollable?q=<text>`
Participants a model can be enrolled for. Min role `user` **plus** the
`enrollOnBehalf` permission (not the manager role), else
`403 { "error": "Forbidden", "code": "PERMISSION_DENIED" }`.

- `q` (optional, max 200): matches email, "first last" or "last first"
  (substring, case-insensitive; `%`, `_` are literal) and, when numeric, also the
  exact participant number. Without `q` all active users are returned (not paginated).
- `200`: `[{ id, email, firstName|null, lastName|null, participantNumber }]`,
  active users only, ordered by last name, first name, email.

### Admin models (`/admin/models`) — min role `manager` — `admin-models.routes.ts`
GET `/?eventId=<id>` (every model carries `missing: boolean`), PUT `/:modelId`
`{ name?, categoryId?, description?, code?, imageUrl?, notes?, internalNotes? }`,
DELETE `/:modelId` (does not remove the model's coauthors and images;
`DELETE /models/:modelId` by the owner does).
- **Mark Missing**: `PATCH /:modelId/missing` `{ missing: boolean }` → `{ updated: true, missing }`. A missing model
  leaves the judging (judge lists and displays, expected votes, completion, awards; its votes are kept). Changing the
  flag clears the judge completions of its class (they must complete again). `404` unknown model, `409 CATEGORY_CLOSED` when
  its class is closed (reopen it first).

### Judge assignments (`/admin/judges`) — min role `manager` — `judge-admin.routes.ts`
| Method | Path | Body |
|--------|------|------|
| GET | `/admin/judges/assignments?eventId=<id>` | — (rows include `standingIn`) |
| POST | `/admin/judges/assignments` | `{ eventId(uuid), judgeId(uuid), categoryId?(uuid), standingIn? }` → `{ id, standingIn }`. One row per category (a judge may have several); `409 DUPLICATE` on an exact duplicate; `422` when `standingIn` has no `categoryId` |
| PATCH | `/admin/judges/assignments/:assignmentId` | `{ eventId, judgeId, categoryId?, standingIn? }`; `standingIn` toggles the stand-in flag (cleared for whole-event rows); `409 DUPLICATE`, `422` as above |
| DELETE | `/admin/judges/assignments/:assignmentId` | — |

### Modification requests (`/admin/modification-requests`) — min role `manager`
GET `/?modelId=<id>`, PATCH `/:requestId/status` `{ status: pending\|resolved\|rejected }`.

### Statistics (`/admin/stats`) — `stats.routes.ts`
`GET /admin/stats/overview?eventId=<id>` — min role `jury_president`;
`403 { code: "SECTION_HIDDEN" }` if `stats` is hidden for jury_president.
Fields added to the response (existing ones unchanged):
- `honors: { total, assigned, list: [{ code, name, exhibitor, categoryName, displayNumber }] }` — catalogue of special awards of the event (`total`), assigned ones (`assigned`), `list` = assigned only. Without `eventId`: all events with special awards.
- `commendedTotal`: number of awards with `medalRank` 1 (commended) in the event.
- `zeroModelUsers`: `{ count, list: [{ userId, participantNumber, name, email }] }` — users with role `user` and no model in the event; `participantNumber` = the user's `seqId` (`null` if missing). **Changed shape**: it was an array of `{ userId, name, email }`; the frontend accepts both.

### Settings
| Method | Path | Min role | Body | Response |
|--------|------|----------|------|----------|
| GET | `/settings` | user | — | settings map (defaults merged) incl. `modelImages, printCodePrefix, printCodeDigits, appTheme, themePreset` (default `savino`), `baseFeeCents` (default `"2500"`), `maxVotesPerExhibitor` (default `"3"`), `maxVoteDifferent` (default `"2"`), `export*`, `absenceRegisterEnabled` (default `"false"`), `minPhotoMedalRank` (default `"4"`, Gold) |
| PUT | `/admin/settings` | admin | `Record<string,string>` | `{ "updated": true }`; `422` if `baseFeeCents` is not a non-negative integer, `maxVotesPerExhibitor` is not an integer 1–10, `maxVoteDifferent` is not an integer 0–40, `absenceRegisterEnabled` is not `"true"`/`"false"`, or `minPhotoMedalRank` is not an integer 0–10 |
| GET | `/settings/section-visibility` | user | — | `{ role, sections: [], permissions: [] }` for the caller |
| GET | `/admin/settings/section-visibility` | admin | — | `{ sections, roles, visibility: { <role>: [] }, permissions: { <role>: [] }, availablePermissions: [] }` |
| PUT | `/admin/settings/section-visibility` | admin | `{ visibility: { <role>: [] }, permissions?: { <role>: [] } }` (both partial by role; `visibility` is required, may be `{}`) | `{ updated, visibility, permissions }`; `422` unknown role/section |
| GET | `/settings/prize-order` | user | — | `{ order: [] }` (first = presented first) |
| PUT | `/admin/settings/prize-order` | admin | `{ order: [] }` (1–20 labels, max 60 chars each) | `{ updated, order }` |

**Sections:** `dashboard, stats, judge, podium, enrollments, models, labels,
checkin, users, teams, settings, admin`. Defaults: `user` = dashboard, models,
enrollments, teams; `staff` = + checkin; `judge` = + judge; `jury_president` =
+ stats; `manager` = all but settings; `admin` = all (cannot be restricted).
Visibility only narrows: role minimums still apply. Server-side `SECTION_HIDDEN`
enforcement applies to `jury_president` only.

### Permissions
| Key | Allows | Default |
|-----|--------|---------|
| `enrollOnBehalf` | `userId` on `POST /models`, `GET /admin/users/enrollable`, enrolling others' models | `manager`, `admin` |

Stored in the `rolePermissions` setting and read at each request. `admin` always
has every permission. Unknown roles or permissions in `permissions` are ignored
(no `422`).

**Prize order** values are award `medalLabel`s; default
`["Highly Commended", "Bronze", "Silver", "Gold"]`. Clients present unlisted
labels first, by `medalRank`.

---

## Pricing routes

Source: `pricing.routes.ts`. Totals are computed at request time from current
prices. One base fee per participant per event (only if at least one model is
paid). Each distinct coauthor of the paid models is charged **once** per event
across all of the participant's models (matched by email, otherwise name +
surname, ignoring case and spaces); with different roles the highest price applies.

| Method | Path | Min role | Response |
|--------|------|----------|----------|
| GET | `/pricing/me?eventId=<uuid?>` | user | `{ currency, totalCents, events: [] }` |
| GET | `/admin/pricing?eventId=&userId=` | manager | `{ currency, totalCents, entries: [] }` |

```
events[] = { eventId, eventName, currency, baseFeeCents, coauthorsTotalCents,
  totalCents, modelCount, paidModelCount,
  coauthorLines: [{ modelId, modelName, modelCode, name, surname, email, roleId, roleName, priceCents,
                    models: [{ modelId, modelName, modelCode }] }],  // one per distinct person
  freeModels:    [{ modelId, modelName, modelCode }] }
entries[] = { userId, participantNumber, name, email, …same fields as events[] }
```

`baseFeeCents` is the fee actually applied (`0` with only free models). Without
models the arrays are empty.

---

## Labels & Exports routes (`/exports`)

Every print/export endpoint (here and in class prints) accepts `?lang=it|en` (default `it`):
page titles, headings, column headers, empty states, sheet names and the fee block follow it.
The frontend sends the current UI language automatically.

Source: `export.routes.ts`. Manager endpoints need min role `manager`; the
`my-*` and `model-card` endpoints need min role `user`. Outputs are XLSX
(binary), HTML (print-on-load), or JSON.

| Method | Path | Min role | Output |
|--------|------|----------|--------|
| GET | `/exports/enrollments?eventId=<id>` | manager | XLSX of enrollments |
| GET | `/exports/models?categoryId=<id>` | manager | XLSX of models |
| GET | `/exports/users/by-event/excel?eventId=<id>` | manager | XLSX users + models (deduped) |
| GET | `/exports/users/by-event/pdf?eventId=<id>` | manager | printable HTML |
| GET | `/exports/labels/data?eventId=<id>` | manager | JSON label rows (DYMO) |
| GET | `/exports/labels/excel?eventId=<id>` | manager | XLSX labels |
| GET | `/exports/labels/pdf?eventId=<id>` | manager | printable HTML labels |
| GET | `/exports/events/:eventId/desk/stats?from&to` | manager | JSON `{ participants, models, labels, listPages, envelopes }` for the range |
| GET | `/exports/events/:eventId/desk/labels?from&to` | manager | printable HTML labels, one per model (QR, model code) |
| GET | `/exports/events/:eventId/desk/labels/data?from&to` | manager | JSON label rows, same as `/exports/labels/data` (DYMO flow) |
| GET | `/exports/events/:eventId/desk/lists?from&to` | manager | printable HTML "check your entries": one page per participant (participant no., name, country, models with code, class, display no.) |
| GET | `/exports/events/:eventId/desk/envelopes?from&to` | manager | printable HTML, one 220×110 mm envelope page per participant (participant no., name, email, country) |
| GET | `/exports/events/:eventId/photography` | manager | printable HTML: awarded models with medal ≥ `minPhotoMedalRank` in closed classes, in presentation order then display no. (participant no., exhibitor, model or "whole display", code, medal). `422` invalid uuid, `404` unknown event |
| GET | `/exports/events/:eventId/photography/excel` | manager | XLSX of the same list |
| GET | `/exports/my-enrollments` | user | XLSX of own enrollments |
| GET | `/exports/model-card/pdf?eventId=<id>` | user | printable HTML model card, including the registration fee breakdown and total |
| GET | `/exports/events/:eventId/judge-sheets` | manager | printable HTML, one page per judge of the event: name, login email, app address, assigned classes (class no., `[Stand-in]` marker for stand-in judges) and one QR per class encoding `${PUBLIC_APP_URL}/judge?eventId=<id>&categoryId=<id>`. A whole-event judge gets every class of the event. `422` invalid uuid, `404` unknown event |
| GET | `/exports/events/:eventId/presentation-medals` | manager | printable HTML of the ceremony medals: one section per awarded class, in presentation order (medal, display no., exhibitor, model or "whole display", code). `422` invalid uuid, `404` unknown event |
| GET | `/exports/events/:eventId/presentation-honors` | manager | printable HTML of the assigned special awards, in catalogue order (code, award, class, display no., exhibitor, model or "whole display"). `422` invalid uuid, `404` unknown event |
| GET | `/exports/classes/:categoryId/jury-qr` | manager | printable HTML: the judges of the class with the class QR. The QR encodes the same judge page URL as above (it no longer encodes a `jury:<judgeId>:<categoryId>` payload) |

Desk prints (`/desk/*`): `from` / `to` are participant numbers (`users.seq_id`), inclusive; both optional. `422` if a bound is not a non-negative integer or `from > to`. The participants are the users with a registration in the event; models are the models of those participants. Labels are one per model, lists and envelopes one page per participant, in participant-number order.

Photography list: a display whose models (at least two) all have the same medal is one "whole display" row; otherwise one row per model above the cut-off.

`PUBLIC_APP_URL` (default `http://localhost:5173`, trailing slashes removed) is the base of the judge app URL printed and encoded in the QR codes.
The judge sheet tells the judge the session length from `JUDGE_SESSION_HOURS` (see `POST /auth/refresh`).

XLSX content is shaped by tenant settings (`exportIncludeModelCode`,
`exportIncludeModelDescription`, `exportIncludeParticipantEmail`,
`excelSheetName`, `excelFilePrefix`). Endpoints requiring `eventId` return `400
{ "error": "eventId is required" }` when omitted.

---

## Error codes

| `code` | Status | Where |
|--------|--------|-------|
| `PERMISSION_DENIED` | 403 | `POST /models` with another `userId`, `GET /admin/users/enrollable` |
| `USER_NOT_FOUND` | 404 | `POST /models` with unknown/disabled `userId` |
| `TEAM_MEMBERS_REQUIRED` | 422 | `POST`/`PUT /models` |
| `INVALID_MEMBER_ROLE` | 422 | `POST`/`PUT /models` |
| `MODEL_LIMIT` | 409 | `POST`/`PUT /models` beyond 50 per participant per event |
| `ENROLLMENT_CLOSED` | 403 | `POST /events/:eventId/enroll` |
| `NOT_FOUND` | 404 | `POST /events/:eventId/enroll` |
| `EVENT_CLOSED` | 409 | `POST /events/:eventId/enroll` |
| `CATEGORY_CLOSED` | 409 | `POST /events/:eventId/enroll`, `POST /judge/displays/vote` |
| `OWN_MODEL` | 403 | `POST /judge/vote`, `POST /judge/displays/vote` (only own models left), `GET /judge/models/:modelId` |
| `INCOMPLETE_VOTES` | 409 | `POST /judge/categories/:categoryId/complete` (`missingModelIds`) |
| `CATEGORY_NOT_CLOSED` | 409 | `PATCH /awards/:awardId`, `GET /awards/categories/:categoryId/review` |
| `INVALID_MEDAL` | 422 | `PATCH /awards/:awardId` (medal is neither `None`/0 nor a bracket of the event) |
| `INVALID_CATEGORY`, `CATEGORY_EVENT_MISMATCH`, `CATEGORY_MODEL_MISMATCH` | 422 | `POST /events/:eventId/enroll` |
| `SECTION_HIDDEN` | 403 | `jury_president` on a hidden section |
