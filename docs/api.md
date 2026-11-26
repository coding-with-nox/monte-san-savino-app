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

- Body: `{ "email": string, "password": string }` (password min length 8).
- `200`: `{ "id": string, "email": string, "role": "user" }`
- `400`: `{ "error": "Password must be at least 8 characters long" }` or
  `{ "error": "Email already registered" }` or `{ "error": "Invalid email" }`

```json
// POST /auth/register
{ "email": "mario@example.com", "password": "password123" }
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
| PATCH | `/categories/:categoryId/status` | `{ status: "open" \| "closed" }` | `{ updated, status }` — closing requires **all judges to have voted all models** else `400` with `{ error, expected, actual }` |

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
| POST | `/judge/vote` | `{ modelId, rank: 0..4 }` | `{ voteId, updated }` |
| GET | `/judge/displays?eventId=&categoryId=` | — | displays in the judge's scope (see below) |
| POST | `/judge/displays/vote` | `{ eventId, displayNumber, rank: 0..4 }` | `{ eventId, displayNumber, rank, votes, skippedClosedModelIds }` |
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
GET /judge/displays → [{ eventId, displayNumber, votable, currentRank,
  models: [{ id, name, code, categoryId, categoryName, categoryStatus, imageUrl, currentRank }] }]
```

- `votable` is false when every category is closed. The display `currentRank` is
  set only when all its models share it, otherwise `null`.
- `POST /judge/displays/vote` applies the rank to every in-scope model in one
  transaction. `votes` is `[{ modelId, voteId, updated }]`; models of closed
  categories are listed in `skippedClosedModelIds`.
- `404` unknown display · `403` no model in the judge's scope ·
  `409 CATEGORY_CLOSED` all categories closed.

---

## Awards routes

Sources: `award.routes.ts`, `special-mention.routes.ts`. Min role: `manager`,
except `/awards/monitoring/:eventId`.

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/awards/events/:eventId` | — | ranking: `[{ modelId, modelName, categoryId, averageRank, votes }]` sorted desc |
| GET | `/awards/monitoring/:eventId` | — | live judging progress per category. Min role `jury_president`; `403 SECTION_HIDDEN` if `dashboard` is hidden |
| GET | `/awards/mentions` | — | all special mentions |
| GET | `/awards/mentions/events/:eventId` | — | mentions for event |
| POST | `/awards/mentions` | `{ eventId, modelId, title, description? }` | `{ id }` |
| DELETE | `/awards/mentions/:mentionId` | — | `{ "deleted": true }` |

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
GET `/?eventId=<id>`, PUT `/:modelId`
`{ name?, categoryId?, description?, code?, imageUrl?, notes?, internalNotes? }`,
DELETE `/:modelId` (does not remove the model's coauthors and images;
`DELETE /models/:modelId` by the owner does).

### Judge assignments (`/admin/judges`) — min role `manager` — `judge-admin.routes.ts`
| Method | Path | Body |
|--------|------|------|
| GET | `/admin/judges/assignments?eventId=<id>` | — |
| POST | `/admin/judges/assignments` | `{ eventId(uuid), judgeId(uuid), categoryId?(uuid) }` |
| PATCH | `/admin/judges/assignments/:assignmentId` | `{ eventId, judgeId, categoryId? }` |
| DELETE | `/admin/judges/assignments/:assignmentId` | — |

### Modification requests (`/admin/modification-requests`) — min role `manager`
GET `/?modelId=<id>`, PATCH `/:requestId/status` `{ status: pending\|resolved\|rejected }`.

### Statistics (`/admin/stats`) — `stats.routes.ts`
`GET /admin/stats/overview?eventId=<id>` — min role `jury_president`;
`403 { code: "SECTION_HIDDEN" }` if `stats` is hidden for jury_president.

### Settings
| Method | Path | Min role | Body | Response |
|--------|------|----------|------|----------|
| GET | `/settings` | user | — | settings map (defaults merged) incl. `modelImages, printCodePrefix, printCodeDigits, appTheme, themePreset` (default `savino`), `baseFeeCents` (default `"2500"`), `export*` |
| PUT | `/admin/settings` | admin | `Record<string,string>` | `{ "updated": true }`; `422` if `baseFeeCents` is not a non-negative integer |
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
| GET | `/exports/my-enrollments` | user | XLSX of own enrollments |
| GET | `/exports/model-card/pdf?eventId=<id>` | user | printable HTML model card, including the registration fee breakdown and total |

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
| `INVALID_CATEGORY`, `CATEGORY_EVENT_MISMATCH`, `CATEGORY_MODEL_MISMATCH` | 422 | `POST /events/:eventId/enroll` |
| `SECTION_HIDDEN` | 403 | `jury_president` on a hidden section |
