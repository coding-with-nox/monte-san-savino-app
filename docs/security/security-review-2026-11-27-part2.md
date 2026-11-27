# Security review – parte 2 (rotte award, stampe, import, export)

- Repo: `monte-san-savino-app`, branch `sec/phase0-tls`
- Metodo: lettura di codice riga per riga dei file indicati; nessuna modifica al repo, nessun comando che cambi stato. Verifiche su `backend/node_modules/elysia` (v1.4.27) in sola lettura.
- Non eseguiti test di integrazione né runtime: le affermazioni sono verificate da codice, salvo dove indicato "da verificare".

## Riepilogo

| Severità | N. |
|---|---|
| CRITICAL | 0 |
| HIGH | 1 |
| MEDIUM | 2 |
| LOW | 8 |

Nuovi finding: NEW-01 … NEW-11. Nessun finding duplicato di SEC-01..37 (le istanze di SEC-20 e SEC-22 sono indicate come nuove istanze).

## Finding

### NEW-01 – Anonimato violato verso `jury_president` tramite statistiche (HIGH)
- **File:** `backend/src/contest/infra/http/stats.routes.ts:79` (guardia `requireRole("jury_president")`), `:60-63` (`modelsPerUser`: nome e `userId` di ogni espositore), `:72` (`honors`), `:38` (email); `backend/src/contest/domain/honors.ts:130-141` (`list` con `exhibitor`, `categoryName`, `displayNumber`); `backend/src/contest/infra/persistence/ceremony.ts:54` (email usata come nome di fallback).
- **Premessa verificata:** `jury_president` è anche giudice. Le rotte giudice usano `requireRole("judge")` (`backend/src/contest/infra/http/judge.routes.ts:31`), che include i ranghi superiori.
- **Scenario:** durante il giudizio, un `jury_president` chiama `GET /admin/stats/overview?eventId=…` e riceve nome e `userId` di tutti gli espositori (`modelsPerUser`). Con premi speciali già assegnati ottiene anche la coppia categoria + numero display → espositore (`honors.list`). Viola la regola "un giudice non deve mai conoscere nome, email o userId di un espositore".
- **Fix:**
  - Opzione A: portare la rotta a `requireRole("manager")`.
  - Opzione B: per i ruoli sotto `manager` restituire solo aggregati (totali, conteggi per classe, medaglie). Rimuovere `modelsPerUser[].name/userId`, `zeroModelUsers.list` e `honors.list[].exhibitor`.
  - In entrambi i casi non usare l'email come fallback del nome espositore (`ceremony.ts:54`).
  - Aggiungere il caso a `backend/src/__integration__/security.roles-anonymity.test.ts`.
- **Da verificare:** `manager` e `admin` ereditano anch'essi `requireRole("judge")`. Se possono votare, la regola di anonimato vale anche per loro: è una decisione di prodotto.

### NEW-02 – Email di tutti i partecipanti senza modelli esposte a `jury_president` (MEDIUM, GDPR)
- **File:** `backend/src/contest/infra/http/stats.routes.ts:38` (`email: u.email` in `zeroModelList`), `:68` (`zeroModelUsers`), `:92-98` (select con `email`).
- **Scenario:** un `jury_president` riceve email e nome di ogni utente `user` senza modelli, senza che servano al giudizio o alla sua funzione.
- **Fix:** rimuovere `email` dalla risposta (usare `participantNumber`). Se serve, lasciarla solo a `manager`. Risolto anche dalla fix di NEW-01 opzione A.

### NEW-03 – `DELETE` di livelli e ruoli membro senza controllo d'uso e senza FK (MEDIUM)
- **File:** `backend/src/contest/infra/http/levels.routes.ts:36-41` (DELETE livello), `backend/src/contest/infra/http/member-roles.routes.ts:49-54` (DELETE ruolo). Colonne `models.level_id` (`backend/src/contest/infra/persistence/schema.ts:35,72`) e `model_team_members.role_id` senza `REFERENCES` (nessun `REFERENCES` in `backend/src/tenancy/infra/persistence/ensureTenantSchema.ts`).
- **Scenario:**
  - Un `manager` elimina il livello "Standard" usato da N modelli. Il `level_id` resta orfano. `loadLevelUpParticipants` (`level-up.routes.ts:57-58`, `innerJoin`) esclude quei modelli dal report level-up senza avviso. `findOwnerLevelLock` perde il vincolo.
  - Eliminando un ruolo membro, `backend/src/contest/infra/persistence/pricingRepository.ts:24` applica il prezzo di default a tutti i coautori con quel ruolo. L'importo dovuto cambia senza alcun avviso.
- **Fix:** rispondere `409 IN_USE` se la risorsa è referenziata, come già fatto per i premi (`honors.routes.ts:153-156`). In alternativa aggiungere FK `ON DELETE RESTRICT` nel DDL tenant.
- **Da verificare:** se la UI impedisce già l'eliminazione di livelli e ruoli in uso.

### NEW-04 – UUID non validati: 500 con messaggio interno (istanza di SEC-20) (LOW)
- **File e righe:**
  - `award.routes.ts:78-83` (GET `/awards/events/:eventId`), `:218-222` (PATCH `/awards/:awardId`), `:280-284` (GET `/categories/:categoryId/review`), `:367-371` (GET `/monitoring/:eventId`).
  - `levels.routes.ts:26-27`, `:36-37` (PUT/DELETE `:id`).
  - `member-roles.routes.ts:34-35`, `:49-50` (PUT/DELETE `:id`).
  - `export.routes.ts:515` e `:547` (GET `/exports/enrollments`, `eventId` non validato); `:588` e `:607` (GET `/exports/models`, `categoryId`, nessuno schema di query); `:638` e `:664` (`/users/by-event/excel`); `:736` e `:747` (`/users/by-event/pdf`).
- **Scenario:** `?eventId=abc` produce l'errore Postgres "invalid input syntax for type uuid", che viene restituito con il testo interno (SEC-20). Solo ruoli `manager`/`jury_president`, impatto basso.
- **Fix:** `isUuid` con `422`, come fanno `honors.routes.ts` e `ceremony.routes.ts`. Per le rotte export riusare `parseExportFilters` (`export.routes.ts:428`) o `UUID_RE` (come già fa `export.routes.ts:1189`).

### NEW-05 – Social e sito esportati sempre, senza opt-in (nuova istanza di SEC-22) (LOW)
- **File:** `backend/src/contest/infra/http/export.routes.ts:716-721` (XLSX `/users/by-event/excel`: instagram, facebook, website, patreon, pinterest, tiktok valorizzati indipendentemente da `includeParticipantEmail`); `:807` (PDF `/users/by-event/pdf` via `renderSocialHtml`); select `:654-659` e `:757-762`.
- **Fix:** come SEC-22, dietro un'impostazione dedicata con default `false`, oppure rimuovere le colonne.

### NEW-06 – Stampe HTML senza CSP né `nosniff` (difesa in profondità) (LOW)
- **File:** `backend/src/contest/infra/http/class-print.routes.ts:49-63` (`page()`), `export.routes.ts:811-814`, `:908-911`, `:1012-1015`, `:1094-1095` e altre; `desk-print.ts:44-71`. Solo il badge ha CSP (`enrollment.routes.ts:14-18`).
- **Scenario:** oggi ogni campo utente passa da `escapeHtml` (verificato) e `lang` è in whitelist. Ma se sfugge un solo campo, lo script gira nell'origin dell'API.
- **Fix:** aggiungere header `content-security-policy: default-src 'none'; style-src 'unsafe-inline'; script-src 'sha256-…'` e `x-content-type-options: nosniff`, con hash dello script `window.print` (inline). Riusare `BADGE_HEADERS` in un helper comune.

### NEW-07 – Validazione dei nomi incompleta (livelli e ruoli membro) (LOW)
- **File:** `levels.routes.ts:18-25` (POST: `name` senza `minLength`/`maxLength`, nessun controllo di unicità); `:26-35` (PUT: `name` opzionale, anche vuoto); `:23` e `:33` (`sortOrder: t.Number()`, non intero; da verificare il tipo della colonna). `member-roles.routes.ts:31` e `:46` (`name` senza `maxLength`; dopo `trim()` può diventare `""`, e `nameTaken` non blocca il vuoto).
- **Scenario:** due livelli con lo stesso nome. `import.routes.ts:155` (`levelByName`) e `level-up.routes.ts:58` (filtro su `'standard'`) diventano ambigui.
- **Fix:** `minLength: 1`, `maxLength` ragionevole, `trim()` prima della validazione, unicità come `nameTaken` in `member-roles`, `sortOrder: t.Integer()`.

### NEW-08 – Import premi e giurie: duplicati nel file non gestiti (LOW)
- **File:** `backend/src/shared/domain/csvImport.ts:259-293` (`parseHonorsCsv` non controlla i duplicati, a differenza di levels `:121`, classes `:153`, medals `:248`). `backend/src/contest/infra/http/import.routes.ts:248-266`: due righe con lo stesso codice in maiuscole/minuscole diverse finiscono entrambe in `inserts`, quindi violazione unique e 500 con messaggio DB (SEC-20). `import.routes.ts:59-74` e `:108`: stessa coppia giudice/classe ripetuta produce insert duplicati.
- **Fix:** rifiutare i duplicati nel parser, come le altre fonti, con errore di riga e 422.
- **Da verificare:** unique index su `honors(event, lower(code))` e su `judge_assignments`.

### NEW-09 – Import livelli e classi non atomici, successo parziale con HTTP 200 (LOW)
- **File:** `import.routes.ts:126-136` (livelli: insert per riga senza transazione), `:161-179` (classi: idem; le righe con livello sconosciuto finiscono in `errors` con status 200 mentre le altre vengono create).
- **Scenario:** un errore DB a metà lascia l'import parziale. Un client che ignora `errors` crea solo una parte delle classi.
- **Fix:** transazione unica e `422` se `errors` non è vuoto, come `/medals` e `/honors`.

### NEW-10 – Import giurie: controllo "già votato" non atomico rispetto ai voti concorrenti (LOW, da verificare)
- **File:** `import.routes.ts:78-111`. Il controllo dei voti (`:85-91`) e il `delete` (`:106`) stanno nella stessa transazione in `READ COMMITTED`. Un voto inserito tra controllo e delete può restare orfano, oppure un giudice può perdere l'assegnazione dopo aver votato.
- **Fix:** `SELECT … FOR UPDATE` sulle assegnazioni dell'evento, oppure advisory lock per evento, e ricontrollo dei voti nella stessa transazione.

### NEW-11 – Export etichette e stampe: un QR per riga fino a 50.000 righe per richiesta (LOW)
- **File:** `export.routes.ts:467-501` (`getLabelRows`: `QRCode.toDataURL` per riga con `mapInChunks`, limite `exportMaxRows` = 50.000 in `exportLimits.ts:1`). Usato da `/labels/data`, `/labels/excel`, `/labels/pdf`, `/events/:eventId/desk/labels*`, e da `/models/print` (`:892-894`).
- **Scenario:** una richiesta di `manager` genera fino a 50.000 QR: carico CPU e memoria elevato, senza limite per richiesta.
- **Fix:** limite più basso per le rotte che generano QR (es. 2.000), oppure cache dei QR per `modelId`.

## Osservazioni sul report esistente (`docs/security/security-review-2026-11-27.md`)

- **SEC-02 probabilmente già corretto su questo ramo.** `desk.routes.ts:18` e `enrollment.routes.ts:127` usano `requireAnyRole(DESK_ROLES)`, e `backend/src/identity/domain/Role.ts:11` esclude `judge` e `jury_president`. Il finding cita `requireRole("staff")` a `desk.routes.ts:17`. Verificare che la modifica sia committata e aggiornare il report.
- **SEC-03 parzialmente mitigato.** `judge.routes.ts:78-79` e `:182` rimuovono `userId` dai modelli. Resta valido per `GET /judge/participants/:userId`, fuori scope di questa parte.
- **SEC-20 confermato** per i UUID mancanti (NEW-04).
- **SEC-22 confermato ed esteso** (NEW-05).
- **SEC-35 resta valido.** Nessun `bodyLimit` / `maxRequestBodySize` trovato in `backend/src/bootstrap`. Il guard CSV di 256 KB (`csvImport.ts:96`) viene applicato solo dopo la lettura dell'intero body.

## Verificato corretto (una riga per rotta)

**award.routes.ts**
- GET `/awards/events/:eventId` (manager): solo dati di classifica, nessun `userId`/email espositore (UUID mancante: NEW-04).
- PATCH `/awards/:awardId` (jury_president): body esplicito (nessun mass assignment), medaglia limitata alle fasce dell'evento, richiede categoria chiusa.
- GET `/awards/categories/:categoryId/review` (jury_president): nessun espositore (solo `modelName`, `code`, `displayNumber`); nomi giudici visibili solo a `jury_president`; richiede categoria chiusa.
- GET `/awards/monitoring/:eventId` (jury_president): solo conteggi.
- GET `/awards/events/:eventId/live` (jury_president): payload costruito campo per campo (`contest/domain/liveJudging.ts:110-154`), nessun `ownerId` né espositore.

**ceremony.routes.ts**
- GET `/awards/events/:eventId/ceremony` (manager): UUID validato; identità espositori solo a manager.

**stats.routes.ts**
- GET `/admin/stats/overview` (jury_president): vedi NEW-01 e NEW-02.

**honors.routes.ts** (tutte, manager)
- UUID validati, duplicati controllati, body esplicito, `assign` verifica evento, categoria, display e modello (`:212-251`), DELETE blocca le assegnazioni.

**presentation-print.routes.ts** (2 rotte, manager)
- `escapeHtml` su ogni campo, `lang` in whitelist (`shared/domain/printI18n.ts:203-206`), UUID validato.

**class-print.routes.ts** (5 rotte, manager)
- `escapeHtml` su ogni campo, UUID validato, QR solo con URL della pagina giudice (nessun token).

**desk-print.ts** (renderer e rotte in `export.routes.ts:1061-1186`)
- `escapeHtml` completo; `deskRange` valida l'UUID; i caricamenti sono filtrati per evento (`persistence/deskPrint.ts:40,73,85`).

**photography-print.ts** (renderer) + `export.routes.ts:1188-1229`
- UUID validato, `escapeHtml`, manager.

**enrollment.routes.ts** `GET /print/:enrollmentId` (DESK_ROLES: staff, manager, admin)
- `escapeHtml` su nome e città; CSP e `nosniff` (`:14-18`); nessun ruolo giudice.

**import.routes.ts** (manager)
- CSV: 256 KB, 2000 righe, 200 caratteri per cella, applicati a tutti e 6 i parser (`csvImport.ts:1-3`, `:96-102`).
- Nessun SQL costruito da input (`inArray` parametrizzato).
- `applyJuryImport` blocca la rimozione di giudici con voti (`:83-103`).
- Ruolo verificato: solo utenti con rango `judge` o superiore (`:63`).
- Auto-voto filtrato in `judge.routes.ts:74`, quindi un giudice espositore non vota i propri modelli.

**levels.routes.ts** (`/public/levels` user): sola lettura.

**pricing.routes.ts**
- GET `/pricing/me` (user): filtro `userId = user.id`, campi personali rimossi (`:15`).
- GET `/admin/pricing` (manager): ok.
- `format: "uuid"` è applicato: Elysia registra il formato (`node_modules/elysia/dist/type-system/format.js:47`).

**member-roles.routes.ts**
- GET `/public/member-roles` (user): sola lettura.

**level-up.routes.ts**
- GET `/admin/reports/level-up` (manager): UUID e 404 validati; email solo a manager.
- GET `/admin/reports/level-up/excel` (manager): UUID validato; XLSX con `inlineStr` (nessuna formula injection).
- GET `/users/me/level-up` (user): restituisce solo un booleano, sul proprio utente.

**export.routes.ts**
- GET `/exports/models/print`, `/labels/data`, `/labels/excel`, `/labels/pdf` (manager): `parseExportFilters` valida gli UUID, tutto escapato.
- Desk (`/events/:eventId/desk/*`) e photography: vedi sopra.
- GET `/exports/my-enrollments` (user): solo le proprie iscrizioni.
- GET `/exports/model-card/pdf` (user): solo dati del proprio utente, prezzi filtrati per `userId`, tutto escapato.
- Builder XLSX (`:157-279`): `xmlEscape` su tutti i valori, celle `t="inlineStr"` (quindi nessuna formula injection), `sanitizeSheetName`, `Content-Disposition` con `normalizeFilePart` (nessuna header injection).
- Nessun export CSV nel backend (grep `text/csv`: solo test e parser di input).

**Route guard generali**: `requireRole` e `requireAnyRole` usano `.as("scoped")` (`identity/infra/http/role.middleware.ts:20`, `:36`), quindi nessuna guardia si propaga tra plugin.

## Da verificare (riassunto)

1. NEW-01: se `manager`/`admin` possono votare (ereditano `judge`), l'anonimato vale anche per loro.
2. Stampe desk (`/exports/events/:eventId/desk/*`): oggi solo `manager`. Se lo staff di sportello deve stamparle, serve `requireAnyRole(DESK_ROLES)`. Decisione di prodotto.
3. NEW-03: se la UI blocca già l'eliminazione di livelli e ruoli in uso.
4. NEW-08: presenza di unique index su honors e judge_assignments.
5. NEW-10: race condition dell'import giurie, da confermare con un test di concorrenza.
