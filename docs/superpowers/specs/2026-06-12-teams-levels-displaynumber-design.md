# Design: Refactor Teams + Levels + DisplayNumber

**Date:** 2026-06-12  
**Status:** Approved

---

## 1. Obiettivo

Rimuovere il sistema Team come entità separata, integrare il concetto di "team" inline nel form di registrazione modello, aggiungere livelli configurabili da admin, e implementare una logica di `displayNumber` per raggruppare modelli dello stesso partecipante nella stessa combo categoria+livello.

---

## 2. Schema Changes

### Tabelle rimosse
- `teamsTable`
- `teamMembersTable`
- `teamRolesTable`

### Nuove tabelle

```sql
-- Livelli configurabili da admin
levelsTable (
  id         uuid PRIMARY KEY,
  name       text NOT NULL,
  sortOrder  integer           -- nullable, per ordinamento UI
)

-- Ruoli predefiniti per membri di team inline
memberRolesTable (
  id   uuid PRIMARY KEY,
  name text NOT NULL
)

-- Membri del team inline associati a un modello
modelTeamMembersTable (
  id        uuid PRIMARY KEY,
  modelId   uuid NOT NULL,     -- FK → models.id
  name      text NOT NULL,
  surname   text NOT NULL,
  role      text NOT NULL      -- stringa copiata da memberRoles.name al momento del salvataggio
)
```

> `role` è copiato come stringa (denormalizzato) per preservare il dato storico se il ruolo viene rinominato/eliminato in seguito.

### Modifiche a tabelle esistenti

**`modelsTable`:**
- Rimuovi: `teamId uuid`
- Aggiungi: `levelId uuid NOT NULL` (FK → levels.id)
- Aggiungi: `displayNumber integer` (nullable; assegnato al momento dell'insert)
- Aggiungi: `isTeam boolean NOT NULL DEFAULT false`

**`categoriesTable`:**
- Aggiungi: `seqId serial NOT NULL` (auto-increment, usato nel prefisso modello)

**`settingsTable` (nuova chiave):**
- `displayNumberPadding` → valore intero come stringa (default `"4"`), controlla zero-padding del `displayNumber` nel codice modello

---

## 3. Display Number Logic

### Definizione

`displayNumber` è un numero sequenziale che identifica una combinazione unica `(userId, categoryId, levelId)` all'interno di un evento.

### Algoritmo (eseguito su ogni `POST /models`)

```
eventId = SELECT eventId FROM categories WHERE id = body.categoryId

existing = SELECT displayNumber FROM models
           WHERE userId = currentUser.id
             AND categoryId = body.categoryId
             AND levelId = body.levelId
           LIMIT 1

if existing:
    displayNumber = existing.displayNumber
else:
    maxInEvent = SELECT MAX(displayNumber) FROM models m
                 JOIN categories c ON c.id = m.categoryId
                 WHERE c.eventId = eventId
    displayNumber = (maxInEvent ?? 0) + 1
```

### Invarianti
- Due modelli con stessa combo `(userId, categoryId, levelId)` hanno sempre lo stesso `displayNumber`.
- Modelli di utenti/categorie/livelli diversi hanno `displayNumber` diversi all'interno dello stesso evento.
- Il contatore non si azzera tra eventi diversi (eventi separati in DB).

---

## 4. Model Code Format

Nuovo formato: `M{categorySeqId}-{displayNumberPadded}-{code}`

Esempio con `categorySeqId=2`, `displayNumber=315`, `padding=4`, `code=865`:
```
M2-0315-865
```

Implementato in `model-code.ts`. Il padding di `displayNumber` viene letto da `settingsTable.displayNumberPadding`.

---

## 5. Backend

### Route rimosse
- `team.routes.ts` (tutti gli endpoint `/teams/*`)
- `team-roles.routes.ts` (tutti gli endpoint `/team-roles/*`)
- Import e `.use()` corrispondenti in `app.ts`

### Nuove route

**Admin (richiedono ruolo `admin` o `manager`):**
```
GET    /admin/levels
POST   /admin/levels         body: { name, sortOrder? }
PUT    /admin/levels/:id     body: { name?, sortOrder? }
DELETE /admin/levels/:id

GET    /admin/member-roles
POST   /admin/member-roles   body: { name }
PUT    /admin/member-roles/:id  body: { name }
DELETE /admin/member-roles/:id
```

**Public (no auth):**
```
GET /public/levels          → [{ id, name, sortOrder }] ordered by sortOrder, name
GET /public/member-roles    → [{ id, name }]
```

### Modifiche a route esistenti

**`model.routes.ts`:**

`POST /models` — body aggiornato:
```typescript
{
  name: string
  categoryId: string
  levelId: string           // obbligatorio
  description?: string
  imageUrl?: string
  isTeam?: boolean          // default false
  teamMembers?: Array<{
    name: string
    surname: string
    role: string
  }>
}
```

Logica:
1. Calcola `displayNumber` secondo l'algoritmo §3
2. Insert in `modelsTable` con `levelId`, `displayNumber`, `isTeam`
3. Se `isTeam && teamMembers.length > 0`: insert in `modelTeamMembersTable`

`PUT /models/:id` — aggiorna `name`, `categoryId`, `levelId`, `description`, `imageUrl`, `isTeam`. Per `teamMembers`: delete existing + re-insert (replace strategy).

`GET /models` e `GET /models/:id` — includono `levelId`, `displayNumber`, `isTeam` nella risposta. Il dettaglio include anche `teamMembers[]`.

**`admin-models.routes.ts`:** aggiungere `levelId`, `displayNumber` alla risposta.

**`export.routes.ts`:** aggiornare export con nuovi campi (levelId→levelName, displayNumber, teamMembers).

---

## 6. Frontend

### Rimozioni
- `frontend/src/pages/Teams.tsx` — eliminare file
- Route `/teams` in `App.tsx`
- Nav item "Teams" in `allNavItems`
- Import `Teams` in `App.tsx`

### Modifiche a `Models.tsx`

Nuovi campi nel form (create + edit):

1. **Select Level** (obbligatorio): carica da `GET /public/levels`, mostra opzioni ordinate per `sortOrder`.
2. **Checkbox "È un team?"**: toggle `isTeam`.
3. **Sezione membri** (visibile solo se `isTeam === true`):
   - Lista membri correnti con possibilità di rimozione
   - Form inline per aggiungere membro: `name` (text), `surname` (text), `role` (Select da `GET /public/member-roles`)
   - Nessun limite al numero di membri

State aggiuntivo: `editLevelId`, `editIsTeam`, `editTeamMembers`.

### Modifiche ad `Admin.tsx`

Due nuove sezioni nella pagina admin:

**Levels:**
- Lista livelli con nome, sortOrder
- Form add: `name` (text), `sortOrder` (number, opzionale)
- Azioni: edit inline, delete

**Member Roles:**
- Lista ruoli con nome
- Form add: `name` (text)
- Azioni: edit inline, delete

---

## 7. Migrations / Seed

Le migration Drizzle vanno generate dopo le modifiche allo schema. Seed iniziale in `bootstrap/seed.ts`:

```typescript
// Livelli iniziali
await db.insert(levelsTable).values([
  { id: uuid(), name: "Junior", sortOrder: 1 },
  { id: uuid(), name: "Senior", sortOrder: 2 },
  { id: uuid(), name: "Open", sortOrder: 3 },
]).onConflictDoNothing()

// Ruoli iniziali
await db.insert(memberRolesTable).values([
  { id: uuid(), name: "Pilota" },
  { id: uuid(), name: "Co-pilota" },
  { id: uuid(), name: "Meccanico" },
]).onConflictDoNothing()
```

> I valori di seed sono indicativi — l'admin può modificarli dopo il deploy.

---

## 8. Scope Out

- Nessuna logica di validazione del numero massimo di membri per team
- Nessun vincolo di unicità su `memberRolesTable.name` (evitare breaking migrations)
- Il `displayNumber` non viene ricalcolato retroattivamente su modelli esistenti
- La rimozione delle tabelle teams/team_members/team_roles include DROP delle tabelle; backup da fare prima del deploy in produzione

---

## 9. File Impacted

| File | Tipo modifica |
|------|--------------|
| `backend/src/contest/infra/persistence/schema.ts` | Schema changes |
| `backend/src/contest/infra/http/model.routes.ts` | Aggiorna body, logica displayNumber |
| `backend/src/contest/infra/http/admin-models.routes.ts` | Aggiorna response |
| `backend/src/contest/infra/http/model-code.ts` | Nuovo formato prefisso |
| `backend/src/contest/infra/http/export.routes.ts` | Aggiorna export |
| `backend/src/contest/infra/http/app.ts` → `bootstrap/app.ts` | Rimuovi team routes, aggiungi nuove |
| `backend/src/bootstrap/seed.ts` | Seed levels + memberRoles |
| `backend/src/contest/infra/http/team.routes.ts` | **ELIMINA** |
| `backend/src/contest/infra/http/team-roles.routes.ts` | **ELIMINA** |
| `frontend/src/App.tsx` | Rimuovi Teams route/nav/import |
| `frontend/src/pages/Teams.tsx` | **ELIMINA** |
| `frontend/src/pages/Models.tsx` | Aggiungi level, isTeam, teamMembers |
| `frontend/src/pages/Admin.tsx` | Aggiungi sezioni Levels + Member Roles |
| `frontend/src/lib/i18n.ts` | Nuove chiavi traduzione |
