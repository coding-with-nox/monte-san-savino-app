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
- **Errors**: failures return `{ "error": "<message>" }` with an appropriate
  status (`400` validation, `401` unauthenticated/invalid credentials, `403`
  forbidden, `404` not found, `409` conflict).
- IDs are UUID strings unless noted. Request bodies are JSON.

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
| GET | `/models?search=<q>` | — | array of `{ id, name, description, code, categoryId, levelId, imageUrl, isTeam, displayNumber }` (code is formatted string or null) |
| POST | `/models` | `{ name, categoryId, levelId, description?, imageUrl?, isTeam?, teamMembers?: [{ name, surname, role }] }` | `{ id, code }` |
| GET | `/models/:modelId` | — | `{ model, images, teamMembers }` or `404` |
| PUT | `/models/:modelId` | `{ name?, categoryId?, levelId?, description?, imageUrl?, isTeam?, teamMembers? }` | `{ "updated": true }` |
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
using tenant settings (prefix/digits), see `model-code.ts`.

---

## Enrollment routes

Sources: `enrollment.routes.ts`, `event.routes.ts`.

| Method | Path | Min role | Body | Response |
|--------|------|----------|------|----------|
| POST | `/events/:eventId/enroll` | user | `{ modelId?, categoryId? }` | `{ id, status: "accepted" }` (`400 Already enrolled` for duplicate user+event+model) |
| GET | `/enrollments` | user | — | array of own registrations |
| GET | `/enrollments/:enrollmentId` | user | — | registration object or `404` |
| GET | `/admin/enrollments?eventId=<id>` | manager | — | all registrations (optionally by event) |

Registration shape: `{ id, userId, eventId, modelId, categoryId, status, checkedIn }`.

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
GET `/`, POST `/` `{ name, sortOrder? }`, PUT `/:id` `{ name?, sortOrder? }`,
DELETE `/:id`.

### Member roles (`/admin/member-roles`) — min role `manager` — `member-roles.routes.ts`
GET `/`, POST `/` `{ name }`, PUT `/:id` `{ name? }`, DELETE `/:id`.

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
| GET | `/judge/models?eventId=&search=` | — | judgeable models incl. `currentRank`, `voteCount` |
| GET | `/judge/models/:modelId` | — | `{ model, images }` |
| GET | `/judge/models/:modelId/votes` | — | `[{ id, rank, createdAt }]` (this judge's history) |
| GET | `/judge/participants/:userId` | — | `{ profile, registrations }` |
| GET | `/judge/categories?eventId=<id>` | — | `[{ id, name }]` |
| POST | `/judge/vote` | `{ modelId, rank: 0\|1\|2\|3 }` | `{ voteId, updated }` |
| GET | `/judge/modification-requests` | — | this judge's category-change requests |
| POST | `/judge/modification-requests` | `{ modelId, reason, suggestedCategoryId? }` | `{ id }` |

```json
// POST /judge/vote
{ "modelId": "…", "rank": 2 }
// → 200
{ "voteId": "…", "updated": false }
```

---

## Awards routes

Sources: `award.routes.ts`, `special-mention.routes.ts`. Min role: `manager`.

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/awards/events/:eventId` | — | ranking: `[{ modelId, modelName, categoryId, averageRank, votes }]` sorted desc |
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
| POST | `/admin/users/:userId/reset-password` | — | `{ temporaryPassword, emailSent }` |

### Admin models (`/admin/models`) — min role `manager` — `admin-models.routes.ts`
GET `/?eventId=<id>`, PUT `/:modelId` `{ name?, categoryId?, description?, code?, imageUrl? }`,
DELETE `/:modelId`.

### Judge assignments (`/admin/judges`) — min role `manager` — `judge-admin.routes.ts`
| Method | Path | Body |
|--------|------|------|
| GET | `/admin/judges/assignments?eventId=<id>` | — |
| POST | `/admin/judges/assignments` | `{ eventId(uuid), judgeId(uuid), categoryId?(uuid) }` |
| PATCH | `/admin/judges/assignments/:assignmentId` | `{ eventId, judgeId, categoryId? }` |
| DELETE | `/admin/judges/assignments/:assignmentId` | — |

### Modification requests (`/admin/modification-requests`) — min role `manager`
GET `/?modelId=<id>`, PATCH `/:requestId/status` `{ status: pending\|resolved\|rejected }`.

### Settings
| Method | Path | Min role | Body | Response |
|--------|------|----------|------|----------|
| GET | `/settings` | user | — | settings map (defaults merged) incl. `modelImages, printCodePrefix, printCodeDigits, appTheme, themePreset, export*` |
| PUT | `/admin/settings` | admin | `Record<string,string>` | `{ "updated": true }` |

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
| GET | `/exports/model-card/pdf?eventId=<id>` | user | printable HTML model card |

XLSX content is shaped by tenant settings (`exportIncludeModelCode`,
`exportIncludeModelDescription`, `exportIncludeParticipantEmail`,
`excelSheetName`, `excelFilePrefix`). Endpoints requiring `eventId` return `400
{ "error": "eventId is required" }` when omitted.
