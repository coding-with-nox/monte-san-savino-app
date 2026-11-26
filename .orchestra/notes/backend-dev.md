# Contratto API backend-dev (feat/team-pricing-jury-theme)

Stato: IMPLEMENTATO (contratto invariato). `GET /judge/models` aggiunge anche `teamCode`. Importi sempre in **centesimi interi**, valuta `EUR`.

## 1. Team inline nel modello
- `POST /models`, `PUT /models/:modelId`: `{ name, categoryId, levelId, description?, notes?, imageUrl?, isTeam?, teamMembers?: [{ name, surname, email?, roleId }] }`
  - `roleId` = id da `GET /public/member-roles` (`role` testuale accettato solo per compatibilità). `email`: omettere se vuota.
  - `teamId` resta accettato (legacy) ma NON è più richiesto. In PUT `teamMembers` sostituisce l'elenco; `isTeam:false` lo cancella.
  - `POST` → `{ id, code }`; per i team `code` = `<n. partecipante>T<progressivo>` (es. `173T1`).
  - Errori: 422 `{error, code:"TEAM_MEMBERS_REQUIRED"|"INVALID_MEMBER_ROLE"}`; 409 `{error, code:"MODEL_LIMIT", limit:50}` (max 50 modelli per partecipante per evento).
- `GET /models` aggiunge `teamCode`; `GET /models/:id` → `teamMembers:[{id,modelId,name,surname,role,roleId,email}]`.

## 2. Prezzi
- `GET /public/member-roles`, `GET /admin/member-roles` → `[{id,name,price}]` (price cent, default 1500).
- `POST /admin/member-roles` `{name, price?}`; `PUT /admin/member-roles/:id` `{name?, price?}`.
- Livelli: `[{id,name,sortOrder,freeToEnter}]`; `POST/PUT /admin/levels` accettano `freeToEnter?: boolean`.
- Quota base: setting `baseFeeCents` (stringa, default `"2500"`) via `GET /settings` e `PUT /admin/settings`.
- `GET /pricing/me?eventId=<uuid opzionale>` →
  ```
  { currency:"EUR", totalCents, events:[{ eventId, eventName, currency:"EUR", baseFeeCents, coauthorsTotalCents, totalCents,
    modelCount, paidModelCount,
    coauthorLines:[{modelId,modelName,modelCode,name,surname,roleId,roleName,priceCents}],
    freeModels:[{modelId,modelName,modelCode}] }] }
  ```
  (`baseFeeCents` = quota applicata: 0 se solo modelli gratuiti; senza modelli `events:[]`.)
- `GET /admin/pricing?eventId=&userId=` (manager+) → `{ currency, totalCents, entries:[{ userId, participantNumber, name, email, ...stessi campi di events[] }] }`

## 3. Stampa iscrizione
- Lato server: `GET /exports/model-card/pdf?eventId=` include già il totale. **Nessuna modifica frontend richiesta.**

## 4. Voto a display (judge+)
- `GET /judge/displays?eventId=&categoryId=` → `[{ eventId, displayNumber, votable, currentRank, models:[{id,name,code,categoryId,categoryName,categoryStatus,imageUrl,currentRank}] }]`
  - `code` stringa formattata; `currentRank` del display = valore solo se uguale su tutti i modelli, altrimenti `null`.
- `POST /judge/displays/vote` `{ eventId, displayNumber, rank:0..4 }` → `{ eventId, displayNumber, rank, votes:[{modelId,voteId,updated}], skippedClosedModelIds:[] }`
  - 404 display inesistente; 403 nessun modello nel proprio scope; 409 `CATEGORY_CLOSED` se tutte chiuse.
- `POST /judge/vote` invariato.

## 5. Ruolo `jury_president` e visibilità sezioni
- Gerarchia: `user < staff < judge < jury_president < manager < admin`.
- jury_president legge: `GET /awards/monitoring/:eventId` e `GET /admin/enrollments` (sezione `dashboard`), `GET /admin/stats/overview` (sezione `stats`). Sezione nascosta → 403 `{code:"SECTION_HIDDEN"}`.
- `GET /events` resta manager+: per jury_president usare `GET /public/events?status=all`.
- Sezioni: `dashboard, stats, judge, podium, enrollments, models, labels, checkin, users, teams, settings, admin`.
- `GET /settings/section-visibility` (autenticato) → `{ role, sections:[] }`
- `GET /admin/settings/section-visibility` (admin) → `{ sections:[tutte], roles:[...], visibility:{ <role>:[...] } }`
- `PUT /admin/settings/section-visibility` `{ visibility:{ <role>:[...] } }` (parziale per ruolo; `admin` vede sempre tutto) → `{ updated:true, visibility }`; 422 su ruolo/sezione ignoti.
- Default: user = dashboard,models,enrollments,teams; staff = +checkin; judge = +judge; jury_president = +stats; manager = tutto tranne settings; admin = tutto.
  La visibilità filtra soltanto: i vincoli di ruolo esistenti restano.

## 6. Ordine premiazione
- `GET /settings/prize-order` → `{ order:["Highly Commended","Bronze","Silver","Gold"] }` (default; sono i `medalLabel`, primo = presentato per primo).
- `PUT /admin/settings/prize-order` `{ order:[...] }` (admin) → `{ updated:true, order }`.
- Frontend: i `medalLabel` non in elenco vanno presentati prima, in ordine di `medalRank`.

## Tema (richiesta frontend-dev)
- Default `themePreset` = `"savino"`; nessuna validazione server che lo rifiuti.

## Permessi / iscrizione per conto di

Stato: IMPLEMENTATO, contratto rispettato. Precisazioni e aggiunte:
- Chiave `enrollOnBehalf` (`backend/src/identity/domain/permissions.ts`). Default: admin (fisso) e manager. Setting `rolePermissions`.
- `GET /settings/section-visibility` -> `{ role, sections, permissions }`.
- `GET /admin/settings/section-visibility` -> `{ sections, roles, visibility, permissions:{<role>:[]}, availablePermissions:[] }`.
- `PUT /admin/settings/section-visibility` `{ visibility, permissions? }` (`visibility` resta obbligatorio, anche `{}`; `permissions` parziale per ruolo) -> `{ updated, visibility, permissions }`.
- `GET /admin/users/enrollable?q=` -> `[{ id, email, firstName|null, lastName|null, participantNumber }]`; `q` cerca su email, "nome cognome", "cognome nome". 403 `{code:"PERMISSION_DENIED"}`.
- `POST /models` `userId?`: 403 `PERMISSION_DENIED`, 404 `USER_NOT_FOUND`, 422 se non uuid. Risposta invariata `{id, code}`.
- `POST /events/:eventId/enroll` con `modelId` altrui: ora ammesso anche a chi ha `enrollOnBehalf` (registrazione intestata al titolare).
- La finestra iscrizioni resta legata al ruolo: solo manager/admin la ignorano, il permesso da solo no.
- Modello altrui dopo la creazione: non compare in `GET /models` del chiamante e le route `/models/:id*` restano solo del titolare. Esistono per manager+ (ruolo, non permesso): `GET /admin/models`, `PUT /admin/models/:id` (name, categoryId, description, code, imageUrl, notes, internalNotes), `DELETE /admin/models/:id`, `POST /models/:id/image-upload`. Un ruolo sotto manager con il permesso non può modificare, cancellare né caricare foto.
- Preesistente, non toccato: `DELETE /admin/models/:id` non cancella coautori e immagini collegati (`DELETE /models/:id` sì).
