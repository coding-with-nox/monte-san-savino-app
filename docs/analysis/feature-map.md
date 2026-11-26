# Mappa funzionale: Monte San Savino App

- Data: 2026-11-26 · Branch: `feat/login-gdpr-i18n` · Commit: `b109afa`
- Scopo: baseline funzionale da confrontare con il sito legacy Emperor (Monte San Savino Show).
- Metodo: solo comportamento verificato nel codice. Percorsi relativi alla radice repo. Le sezioni 3 e 4 citano `file:riga`.
- Glossario (termini del codice): **categoria** = classe di concorso (in stampa "Classe"); **livello** = fascia (seed: Juniors, Standard, Masters, All); **modello** = miniatura; **display / vetrina** = insieme dei modelli con lo stesso `displayNumber` nello stesso evento; **iscrizione** (`registrations`) = una riga per (utente, evento, modello); **numero partecipante** = `users.seqId`.

---

## 1. Ruoli e permessi

### 1.1 Ruoli e gerarchia

Ordine lineare: `user < staff < judge < jury_president < manager < admin` (`backend/src/identity/domain/Role.ts:1-2`). `requireRole(min)` accetta il ruolo se `>= min` (`backend/src/identity/infra/http/role.middleware.ts:5-20`, `backend/src/identity/domain/Role.ts:4-9`). Ogni ruolo eredita quindi le API dei ruoli inferiori (un judge può fare check-in, un manager crea modelli propri).

| Ruolo | Minimo nelle API | Funzioni principali |
|---|---|---|
| `user` | `user` | Profilo; modelli propri (CRUD, immagini, coautori); iscrizioni a eventi; team; export delle proprie iscrizioni e scheda modelli; prezzo personale |
| `staff` | `staff` | Check-in iscritti; stampa badge HTML. Pagina `/staff-checkin` |
| `judge` | `judge` | Giudizio su eventi/categorie assegnati: voto per modello o per vetrina (rank 0-4), dichiarazione di completamento categoria. Vede solo nome e numero espositore dei partecipanti. Pagina `/judge` |
| `jury_president` | `jury_president` | Statistiche (`/stats`), monitoraggio giudici, elenco iscrizioni per evento incluse assenze. Dashboard in versione manager |
| `manager` | `manager` | Eventi, categorie, livelli, ruoli coautore (prezzi), campagne iscrizione, assegnazione giudici, tutti i modelli, assenze, import CSV, export e stampe, prezzi totali, premi (fasce, correzioni, menzioni), sponsor, richieste di modifica, utenti (creazione, ruolo, reset password), etichette, podio |
| `admin` | `admin` | Impostazioni globali (`/settings`), visibilità sezioni e permessi, ordine premi, gestione ruoli di chiunque. Ha sempre tutti i permessi |

- Gestione utenti (`backend/src/identity/domain/adminUserPolicy.ts:11-14`): l'admin gestisce tutti. Gli altri solo ruoli strettamente inferiori (creazione, cambio ruolo, reset password). Nessuno può cambiare il proprio ruolo né disattivarsi (`adminUserPolicy.ts:33-34`).
- Account disattivato: login e refresh rifiutati (`backend/src/identity/application/LoginWithPassword.ts:19`, `RefreshSession.ts:21`). Il JWT di accesso resta valido fino alla scadenza, 15 min di default (`backend/src/identity/infra/tokens/jwtTokenService.ts:3`). Non esiste revoca.
- Ambito giudice (`backend/src/contest/domain/judgeScope.ts:78-89`): admin e manager sono privilegiati. Il giudice vede solo le categorie assegnate (assegnazione di evento = tutte le categorie dell'evento; assegnazione di categoria = solo quella).

### 1.2 Permessi configurabili

Unico permesso configurabile: `enrollOnBehalf` (`backend/src/identity/domain/permissions.ts:4-15`). Default: `manager` e `admin`. Configurabile dalla tab Regole (solo admin) tramite `PUT /admin/settings/section-visibility` (`backend/src/contest/infra/http/settings.routes.ts:102-124`).

Effetto: permette di creare modelli e iscrivere modelli di altri utenti (`GET /admin/users/enrollable`, `admin.routes.ts:53`; `POST /models` con `userId`, `model.routes.ts:152-157`; iscrizione di modello altrui, `backend/src/contest/domain/enrollment.ts:40`). La finestra di iscrizione resta valida per questi ruoli.

### 1.3 Visibilità sezioni (menu e rotte)

Sezioni configurabili (`backend/src/identity/domain/sectionVisibility.ts:38-41`): `dashboard, stats, judge, podium, enrollments, models, labels, checkin, users, teams, settings, admin`.

Default (`sectionVisibility.ts:45-57`), ✓ = visibile:

| Sezione | user | staff | judge | jury_president | manager | admin |
|---|---|---|---|---|---|---|
| dashboard, models, enrollments, teams | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| checkin | | ✓ | ✓ | ✓ | ✓ | ✓ |
| judge | | | ✓ | ✓ | ✓ | ✓ |
| stats | | | | ✓ | ✓ | ✓ |
| podium, labels, users, admin | | | | | ✓ | ✓ |
| settings | | | | | | ✓ |

Enforcement:
- **Frontend**: nasconde menu e blocca la rotta (`frontend/src/App.tsx:209-212`, `409-422`). L'admin bypassa sempre.
- **Backend**: solo per `jury_president` e solo su tre endpoint (`backend/src/identity/infra/http/section.middleware.ts:17-25`): `GET /admin/enrollments` (`enrollment.routes.ts:84`), `GET /awards/monitoring/:eventId` (`award.routes.ts:280`), `GET /admin/stats/overview` (`stats.routes.ts:122`). Per gli altri ruoli la visibilità è solo UI: l'API resta raggiungibile dal ruolo minimo.
- Rotte senza guard di sezione: `/` e `/teams` (`App.tsx:409`, `414`).
- `GET /settings/section-visibility` (user) restituisce sezioni e permessi del proprio ruolo (`settings.routes.ts:57-63`).

---

## 2. Pagine frontend

Rotte in `frontend/src/App.tsx:400-425`. Voci di menu in `App.tsx:227-242`; barra mobile per ruolo in `App.tsx:251-256`.

| Path (App.tsx) | Accesso | Azioni principali | Dati mostrati |
|---|---|---|---|
| `/login` (402) | pubblica | Login email/password (fallback PKCE S256 se `/auth/login` risponde 404/405, `Login.tsx:98-120`). Registrazione in 3 step: account; anagrafica (nome, cognome, telefono, paese, città); indirizzo, contatto emergenza, consenso privacy. Poi login e `PUT /users/profile` (`Login.tsx:171-200`) | nessuno |
| `/` Dashboard (409) | autenticato | Contenuto per ruolo (`Dashboard.tsx:280-293`): manager/jury → riepilogo evento e monitoraggio giudici; judge → eventi e modelli assegnati; user/staff → miei modelli e iscrizioni | eventi, iscrizioni evento, monitoraggio, modelli propri |
| `/profile` (410) | autenticato | Modifica profilo: anagrafica, indirizzo, social, paese, flag `publicProfile` (senza effetto su endpoint pubblici) | profilo |
| `/models` (411) | user (+ sezione models) | Lista e ricerca modelli propri; nuovo modello (nome, categoria, livello, descrizione, note, immagine, coautori con ruolo, proprietario se `enrollOnBehalf`); modifica; elimina; immagini (upload diretto su MinIO); stampa scheda (HTML). Manager: note interne. Prezzo corrente evento (`/pricing/me`) | modelli, codice, numero display, prezzo, limite modelli |
| `/enrollments` (412) | user (+ enrollments) | Lista iscrizioni proprie. Nuova iscrizione: evento → modello (opzionale) → categoria. Stampa scheda evento (HTML con prezzo). Export XLSX delle proprie. Manager: iscrizioni per evento, toggle assente, export XLSX per evento, iscrizione per conto (utenti da `/admin/users/enrollable`) | iscrizioni (stato, check-in, assente), totale |
| `/staff-checkin` (413) | staff+ (+ checkin) | Inserimento manuale ID iscrizione → check-in. Stampa badge HTML. Nessuno scanner QR (`StaffCheckin.tsx:20-84`) | solo l'ID digitato |
| `/teams` (414) | autenticato, senza guard di sezione. Non in menu | Crea, modifica, elimina team (nome, categoria, membri con ruolo ed email). Numero team `MX-nnn-nnnn` | team e membri |
| `/public-events` (415) | pubblica | Elenco eventi (`/public/events`, default status `active`) | eventi |
| `/judge` (416) | judge+ (+ judge) | Scelta evento e categoria. Vetrine raggruppate per numero display. Voto a vetrina (su tutti i modelli o sui spuntati) e voto singolo modello, rank 0-4. "Completa giudizio" per categoria (409 se modelli non votati). Progresso giudici. Scala: 0 Nessuno, 1 Alta Menzione, 2 Bronzo, 3 Argento, 4 Oro (`Judge.tsx:56-69`, `i18n.ts:386-390`) | modelli (nome, codice, immagine, categoria), voto corrente |
| `/users` (417) | manager+ (+ users) | Lista utenti. Crea utente (email, password, ruolo inferiore). Modifica profilo, ruolo, attivo/disattivo. Reset password con email. Export utenti per evento XLSX e HTML stampabile | utenti, profili, eventi |
| `/admin` (418) | manager+ (+ admin) | Tab **Eventi**: eventi (crea, stato `draft/active/closed`), categorie (crea, modifica, apri/chiudi, gratuita), campagne iscrizione, fasce premi (`EventsTab.tsx:83-85`). Tab **Giudici**: assegnazioni e monitor. Tab **Premi**: menzioni speciali, richieste di modifica categoria, correzione premi su categorie chiuse. Tab **Sponsor**: CRUD. Tab **Catalogo**: livelli, ruoli coautore con prezzo. Tab **Regole** (solo admin): visibilità sezioni, permessi, ordine premi | come elencato |
| `/labels` (419) | manager+ (+ labels) | Etichette per evento: export XLSX, HTML stampabile, stampa diretta su DYMO LabelWriter (SDK da labelwriter.com, `lib/dymo.ts:1-25`) | righe etichetta (utente, categoria, modello, codice) |
| `/stats` (420) | jury_president+ (+ stats) | Statistiche per evento: utenti per paese, top utenti per numero modelli, modelli per classe, medaglie, menzioni. Modalità proiezione a schermo intero | `/admin/stats/overview` |
| `/podium` (421) | manager+ (+ podium) | Presentazione premi passo-passo (frecce, spazio, Esc). Per classe, ordine medaglie da `prizeOrder` | righe premi di categorie chiuse |
| `/settings` (422) | admin (+ settings) | Nome app; tema (chiaro/scuro, preset); export (toggle codice, descrizione, email; nome foglio; prefisso file); prefisso e cifre codici stampa; max modelli per utente (solo UI, §8); toggle immagini (solo UI); tab Team: modalità nome salvata in `localStorage` | impostazioni |
| `/help` (423) | pubblica | Guida generata dai tour, filtrata per ruolo (`Help.tsx:22-40`) | nessuno |
| `/privacy` (424) | pubblica | Informativa IT/EN con segnaposti `[TODO]` (`frontend/src/lib/privacyNotice.ts`) | nessuno |
| `*` (425) | — | Redirect a `/` | — |

---

## 3. API backend

Convenzioni: "Ruolo" = minimo richiesto (`requireRole`) salvo diversa indicazione; "pubblico" = nessuna autenticazione. Liste admin: paginazione opzionale con `limit` (1-500) e `offset`, header `X-Total-Count`; senza parametri restituiscono tutto (`backend/src/shared/infra/http/pagination.ts:1-20`). Montaggio in `backend/src/bootstrap/app.ts:129-171`.

### 3.1 Auth (`identity.routes.ts`, prefix `/auth`)

Rate limit per IP+email: 10 tentativi / 15 min, backoff 30 s (`backend/src/shared/infra/http/rateLimiter.ts:91-96`). Applicato a register, login, authorize, token; non a refresh.

| Metodo | Path | Ruolo | Scopo |
|---|---|---|---|
| POST | `/auth/register` | pubblico | Crea utente `user`. Richiede consenso privacy e versione informativa |
| POST | `/auth/login` | pubblico | Login con password → access + refresh token |
| POST | `/auth/authorize` | pubblico | Flusso PKCE: credenziali → codice (solo S256) |
| POST | `/auth/token` | pubblico | Scambio codice + `code_verifier` → token |
| POST | `/auth/refresh` | refresh token | Nuovi token; rilegge ruolo e stato attivo |

Non esistono: reset password self-service, cambio password dell'utente.

### 3.2 Utenti e profilo (`user.routes.ts`, `admin.routes.ts`)

| Metodo | Path | Ruolo | Scopo |
|---|---|---|---|
| GET | `/users/profile` | user | Profilo proprio |
| PUT | `/users/profile` | user | Aggiorna profilo (social normalizzati) |
| GET | `/admin/users/enrollable?q=` | user + enrollOnBehalf | Utenti attivi per cui iscrivere |
| POST | `/admin/users` | manager | Crea utente con ruolo inferiore al proprio |
| GET | `/admin/users` | manager | Lista utenti |
| GET | `/admin/users/:userId/profile` | manager | Profilo di un utente |
| PUT | `/admin/users/:userId/profile` | manager | Modifica profilo di un utente |
| PATCH | `/admin/users/:userId` | manager | Cambia ruolo e/o stato attivo |
| POST | `/admin/users/:userId/reset-password` | manager | Password temporanea via email; 503 se email non disponibile (password non cambiata) |

### 3.3 Eventi, campagne, pubblico

| Metodo | Path | Ruolo | Scopo |
|---|---|---|---|
| GET | `/events` | manager | Lista eventi |
| POST | `/events` | manager | Crea evento (status libero; UI usa `draft` di default) |
| GET | `/events/:eventId` | manager | Dettaglio |
| PUT | `/events/:eventId` | manager | Modifica nome, status, date |
| DELETE | `/events/:eventId` | manager | Elimina riga evento (§8) |
| GET | `/public/events?status=` | pubblico | Eventi; default `active`; `status=all` tutti |
| GET | `/admin/event-campaigns` | manager | Campagne iscrizione (apertura, chiusura) |
| POST | `/admin/event-campaigns` | manager | Crea campagna |
| PUT | `/admin/event-campaigns/:campaignId` | manager | Modifica campagna |
| DELETE | `/admin/event-campaigns/:campaignId` | manager | Elimina campagna |

### 3.4 Categorie, livelli, ruoli coautore

| Metodo | Path | Ruolo | Scopo |
|---|---|---|---|
| GET | `/categories` | manager | Lista categorie (classi) |
| POST | `/categories` | manager | Crea categoria |
| PUT | `/categories/:categoryId` | manager | Modifica nome, `freeToEnter` |
| DELETE | `/categories/:categoryId` | manager | Elimina categoria (§8) |
| PATCH | `/categories/:categoryId/status` | manager | `closed` calcola e congela premi; `open` elimina premi e completamenti |
| GET | `/public/categories?eventId=` | user | Categorie per il form di iscrizione |
| GET/POST | `/admin/levels` | manager | Lista, crea livelli |
| PUT/DELETE | `/admin/levels/:id` | manager | Modifica, elimina livello |
| GET | `/public/levels` | user | Livelli |
| GET/POST | `/admin/member-roles` | manager | Ruoli coautore (nome, prezzo in cent, default 1500) |
| PUT/DELETE | `/admin/member-roles/:id` | manager | Modifica prezzo, elimina ruolo |
| GET | `/public/member-roles` | user | Ruoli coautore |
| POST | `/admin/import/levels` | manager | Import CSV livelli (`Level Name,Free To Enter(1/0)`) |
| POST | `/admin/import/classes?eventId=` | manager | Import CSV classi (6 colonne) |

Limiti import: 256 KB, 2000 righe, celle max 200 caratteri (`backend/src/shared/domain/csvImport.ts:1-3`).

### 3.5 Modelli

| Metodo | Path | Ruolo | Scopo |
|---|---|---|---|
| GET | `/models?search=` | user | Modelli propri |
| POST | `/models` | user (+ enrollOnBehalf se `userId` altrui) | Crea modello con coautori o team. Immagine solo da base consentita |
| GET | `/models/:modelId` | user (owner) | Dettaglio con immagini e coautori |
| PUT | `/models/:modelId` | user (owner) | Modifica. Bloccata a iscrizioni chiuse per i non-manager. Cambio categoria cancella i voti del modello |
| DELETE | `/models/:modelId` | user (owner) | Elimina modello (nessun controllo di finestra) |
| POST | `/models/:modelId/images` | user (owner) | Registra URL immagine |
| DELETE | `/models/:modelId/images/:imageId` | user (owner) | Rimuove immagine |
| POST | `/models/:modelId/image-upload` | user (owner/manager) | URL firmato MinIO per PUT (jpeg, png, webp) |
| GET | `/admin/models` | manager | Tutti i modelli |
| PUT | `/admin/models/:modelId` | manager | Modifica, incluse note interne |
| DELETE | `/admin/models/:modelId` | manager | Elimina modello |

### 3.6 Iscrizioni, check-in, badge, prezzi

| Metodo | Path | Ruolo | Scopo |
|---|---|---|---|
| POST | `/events/:eventId/enroll` | user | Iscrive (modelId e categoryId opzionali). Vedi §4.3 |
| GET | `/enrollments` | user | Mie iscrizioni |
| GET | `/enrollments/:enrollmentId` | user | Dettaglio iscrizione propria |
| GET | `/admin/enrollments?eventId=` | jury_president (+ dashboard) | Tutte le iscrizioni, incluse assenti |
| PATCH | `/admin/enrollments/:id/absent` | manager | Segna assente o presente (nessun effetto su check-in o premi) |
| POST | `/staff/checkin/:enrollmentId` | staff | Imposta `checkedIn = true` (nessun annullo) |
| GET | `/staff/print/:enrollmentId` | staff | Badge HTML 86×54 mm con QR `enrollment:<id>` |
| GET | `/pricing/me?eventId=` | user | Totale iscrizione per evento |
| GET | `/admin/pricing?eventId=&userId=` | manager | Totali per iscritto e evento |
| GET | `/qr/:enrollmentId`, `/png`, `/data` | pubblico | QR SVG, PNG, JSON per `enrollment:<id>` (`qr.routes.ts:4-37`) |

### 3.7 Giudizio

| Metodo | Path | Ruolo | Scopo |
|---|---|---|---|
| GET | `/judge/events` | judge | Eventi assegnati (manager: tutti) |
| GET | `/judge/models?eventId=&categoryId=` | judge | Modelli in ambito con mio voto corrente |
| GET | `/judge/models/:modelId` | judge | Dettaglio modello (non usato in UI) |
| GET | `/judge/models/:modelId/votes` | judge | Storico miei voti (non usato in UI) |
| GET | `/judge/participants/:userId` | judge | Solo nome e numero espositore (non usato in UI) |
| GET | `/judge/displays` | judge | Vetrine raggruppate per `displayNumber` |
| POST | `/judge/displays/vote` | judge | Rank su tutti i modelli della vetrina in ambito. Categorie chiuse saltate. 404, 403, 409 |
| POST | `/judge/vote` | judge | Voto su singolo modello (append-only, vale l'ultimo) |
| GET | `/judge/categories?eventId=` | judge | Categorie di un evento |
| GET | `/judge/categories/:categoryId/completion` | judge | Stato completamento giudici |
| POST | `/judge/categories/:categoryId/complete` | judge | Dichiara giudizio completato. 409 `INCOMPLETE_VOTES` se mancano voti |
| GET/POST | `/judge/modification-requests` | judge | Richiesta cambio categoria di un modello (nessuna UI) |
| GET/POST | `/admin/judges/assignments` | manager | Lista, assegna giudice a evento (categoria null) o categoria |
| PATCH/DELETE | `/admin/judges/assignments/:assignmentId` | manager | Modifica, rimuovi assegnazione |
| GET | `/admin/modification-requests` | manager | Richieste di modifica |
| PATCH | `/admin/modification-requests/:requestId/status` | manager | `pending`, `resolved`, `rejected` (non verifica esistenza) |

### 3.8 Premi, menzioni, statistiche

| Metodo | Path | Ruolo | Scopo |
|---|---|---|---|
| GET | `/awards/events/:eventId` | manager | Classifica: congelata per categorie chiuse, live (media rank) per aperte |
| PATCH | `/awards/:awardId` | manager | Correzione medaglia (solo categorie chiuse; nessuna validazione) |
| GET | `/awards/monitoring/:eventId` | jury_president (+ dashboard) | Avanzamento per categoria: % modelli votati, giudici completati |
| GET/POST | `/admin/award-brackets?eventId=` | manager | Fasce punteggio → medaglia |
| DELETE | `/admin/award-brackets/:bracketId` | manager | Elimina fascia |
| GET | `/awards/mentions`, `/awards/mentions/events/:eventId` | manager | Menzioni speciali |
| POST | `/awards/mentions` | manager | Assegna menzione (titolo, descrizione, modello) |
| DELETE | `/awards/mentions/:mentionId` | manager | Rimuove menzione |
| GET | `/admin/stats/overview?eventId=` | jury_president (+ stats) | Statistiche generali |
| GET/POST/PUT/DELETE | `/sponsors[/:sponsorId]` | manager | CRUD sponsor (nessun output pubblico) |

### 3.9 Team (coautori legacy)

| Metodo | Path | Ruolo | Scopo |
|---|---|---|---|
| GET/POST | `/teams` | user | Lista, crea team (numero `MX-nnn-nnnn`) |
| GET/PUT/DELETE | `/teams/:id` | user (owner) | Dettaglio, modifica, elimina |
| GET/POST | `/teams/:id/mates` | user (owner) | Membri del team |
| DELETE | `/teams/:id/mates/:mateId` | user (owner) | Rimuove membro |

### 3.10 Impostazioni

| Metodo | Path | Ruolo | Scopo |
|---|---|---|---|
| GET | `/settings` | user | Tutte le impostazioni (default in `settings.routes.ts:23-38`) |
| GET | `/settings/section-visibility` | user | Sezioni e permessi del proprio ruolo |
| GET | `/settings/prize-order` | user | Ordine presentazione premi |
| PUT | `/admin/settings` | admin | Salva chiavi arbitrarie, senza whitelist (`settings.routes.ts:75-90`) |
| GET | `/admin/settings/section-visibility` | admin | Matrice visibilità, permessi, elenco |
| PUT | `/admin/settings/section-visibility` | admin | Aggiorna visibilità e permessi |
| PUT | `/admin/settings/prize-order` | admin | Ordine premi (1-20 voci) |
| POST | `/admin/reminders/incomplete-registrations` | manager | Stub: risponde `{sent: 0}` (§7) |

### 3.11 Export e stampe (`export.routes.ts`, `class-print.routes.ts`)

Tutti sotto `/exports`. "HTML" = pagina stampabile con `window.print()`, quindi PDF via browser (`export.routes.ts:782, 879, 983, 1150`). Nessuna libreria PDF nelle dipendenze. XLSX generato a mano in XML (`export.routes.ts:196-299`).

| Metodo | Path | Ruolo | Output |
|---|---|---|---|
| GET | `/exports/enrollments?eventId=` | manager | XLSX iscrizioni |
| GET | `/exports/models` | manager | XLSX modelli |
| GET | `/exports/users/by-event/excel` | manager | XLSX utenti per evento |
| GET | `/exports/users/by-event/pdf` | manager | HTML utenti per evento |
| GET | `/exports/models/print` | manager | HTML modelli con QR e note |
| GET | `/exports/labels/data` | manager | JSON righe etichetta (per DYMO) |
| GET | `/exports/labels/excel` | manager | XLSX etichette |
| GET | `/exports/labels/pdf` | manager | HTML etichette |
| GET | `/exports/classes/:categoryId/exhibitors` | manager | HTML espositori e modelli della classe |
| GET | `/exports/classes/:categoryId/jury-list` | manager | HTML giudici della classe |
| GET | `/exports/classes/:categoryId/jury-qr` | manager | HTML QR giudici (`jury:<userId>:<categoryId>`) |
| GET | `/exports/my-enrollments` | user | XLSX iscrizioni proprie |
| GET | `/exports/model-card/pdf?eventId=` | user | HTML scheda: modelli e prezzo (usata da "stampa iscrizione") |

Limite: `EXPORT_MAX_ROWS` (default 50 000) → 413 (`backend/src/contest/infra/http/exportLimits.ts:1-22`, `export.routes.ts:520-521`).

### 3.12 Altro

`GET /health` pubblico (`app.ts:120`). `GET /docs` (Swagger) solo fuori da produzione (`app.ts:72-73`). `/payments/*` definiti ma non montati (§5).

---

## 4. Flussi principali end-to-end

### 4.1 Registrazione e accesso
1. Registrazione in 3 step (`Login.tsx:171-200`). `POST /auth/register` richiede password ≥ 8 caratteri, `privacyAccepted: true` e `privacyVersion` (`identity.routes.ts:62-80`). Versione informativa corrente: `2026-11-26` (`frontend/src/lib/privacyNotice.ts:10`).
2. Email già registrata: risposta uguale a un successo, senza rivelare l'esistenza (`identity.routes.ts:83-87`).
3. Il nuovo utente ha ruolo `user`. Dopo la registrazione: login e `PUT /users/profile` con l'anagrafica.
4. Login: JWT access 15 min, refresh 30 giorni (`jwtTokenService.ts:3-4`). Rinnovo automatico sotto soglia; logout su 401/403 (`frontend/src/lib/api.ts:72-74, 87`). Token in `localStorage` (`frontend/src/lib/auth.ts`).

### 4.2 Modelli e coautori
1. `POST /models`: categoria e livello obbligatori; coautori `{name, surname, roleId, email}` (`model.routes.ts:149-276`).
2. Controlli: finestra chiusa per non-manager (`model.routes.ts:172-175`, `enrollment-guard.ts:8-25`). Limite 50 modelli per partecipante per evento (`pricing.ts:5`, `model.routes.ts:182-185`). Team senza membri → 422 (`model.routes.ts:188-191`). Ruolo coautore deve esistere in `member_roles` (`backend/src/contest/infra/persistence/modelTeam.ts:13-31`).
3. Numerazione (`model.routes.ts:31-85, 214-219`):
   - `displayNumber`: riusato per la stessa combinazione (utente, categoria, livello); altrimenti progressivo nell'evento.
   - `code`: progressivo globale.
   - Codice mostrato: `M{seqCategoria}-{displayNumber con padding}-{code}` (`backend/src/contest/infra/http/model-code.ts:18-31`). Per team: `<numeroPartecipante>T<n>` (`backend/src/contest/domain/teamCode.ts:1-9`).
4. Immagini: `POST /models/:id/image-upload` → URL firmato MinIO → `PUT` diretto dal browser → `POST /models/:id/images` con l'URL pubblico (`Models.tsx:393-406`, `modelUpload.routes.ts:13-51`, `minioStorage.ts:44-49`).
5. Cambio categoria (`model-category-change.ts:26-36`): vietato se una delle due categorie è chiusa. Altrimenti cancella i voti del modello e i completamenti della categoria di partenza.

### 4.3 Iscrizione evento e per conto terzi
1. `POST /events/:eventId/enroll` con `modelId` e/o `categoryId` (`frontend/src/pages/Enrollments.tsx:149-168`).
2. Regole (`backend/src/contest/domain/enrollment.ts:29-68`):
   - evento inesistente → 404;
   - stato evento `closed`, `archived`, `cancelled`, `canceled`, `completed` (`enrollment.ts:3`) → 409 per **tutti i ruoli**, manager compresi;
   - modello non proprio senza privilegi → 404 (non rivela l'esistenza);
   - categoria del modello diversa dalla richiesta → 422;
   - categoria di altro evento o chiusa → 422 / 409;
   - finestra chiusa per non-manager → 403.
   La finestra è chiusa se **una qualsiasi** campagna dell'evento ha data di chiusura passata (`enrollment-guard.ts:8-12`).
3. Duplicato (stessa utente, evento, modello) → 400 "Already enrolled" (`event.routes.ts:123-154`, con advisory lock).
4. Inserimento: `status = "accepted"`, `checkedIn = false` (`event.routes.ts:141-149`).
5. Per conto terzi: admin, manager o `enrollOnBehalf` possono iscrivere un modello altrui; la riga è intestata al proprietario del modello, con log (`event.routes.ts:155-160`). Il modello si crea con `POST /models` e `userId` (`model.routes.ts:152-168`).
6. Assenza: `absent` si imposta a mano, ma non influisce su check-in, prezzi o premi. Compare solo in lista ed export.

### 4.4 Coautori e prezzo
1. Coautori = membri del modello (`model_team_members`: nome, cognome, ruolo, email). I team legacy (`teams`) sono usati solo come fallback nel calcolo prezzi (`backend/src/contest/infra/persistence/pricingRepository.ts:70`).
2. Calcolo (`backend/src/contest/domain/pricing.ts:61-96`):
   - quota base (`baseFeeCents`, default 2500 cent) una sola volta, se c'è almeno un modello a pagamento;
   - una riga per coautore distinto (chiave: email, altrimenti nome+cognome). Prezzo = prezzo del ruolo (`member_roles.price`, default 1500), il più alto se presente su più modelli;
   - modelli in una categoria `freeToEnter` sono gratuiti, coautori inclusi (`pricingRepository.ts:47`).
3. Output: `/pricing/me`, `/admin/pricing`, e riga di totale nella scheda HTML (`export.routes.ts:363-386`). Non esiste incasso (vedi §5).

### 4.5 Stato iscrizione
Campi di `registrations`: `status` (text, sempre `accepted` dal flusso), `checkedIn`, `absent` (`backend/src/contest/infra/persistence/schema.ts:53-66`). Nessun campo di pagamento.

### 4.6 Check-in e badge
1. Lo staff digita l'UUID dell'iscrizione (nessuno scanner) → `POST /staff/checkin/:id` → `checkedIn = true` (`enrollment.routes.ts:127-149`). Nessun controllo su `absent` o stato evento. Nessun annullo.
2. Badge: `GET /staff/print/:id` → HTML 86×54 mm con nome, città, primi 8 caratteri dell'ID e QR `enrollment:<id>` (`enrollment.routes.ts:19-39, 150-192`). Testo non localizzato.
3. I QR sono generati (`qr.routes.ts`, `class-print.routes.ts:18-20`), ma nessuna schermata del frontend li legge.

### 4.7 Giudizio
1. Assegnazione: manager assegna giudice a evento (tutte le categorie) o a categoria (`judge-admin.routes.ts:26-47`).
2. Ambito: giudice fuori ambito → 403 su voto, 404 su dettaglio partecipante (`judgeScope.ts:98-111`, `judge.routes.ts:367-384`).
3. Voto: rank 0-4 per modello (`POST /judge/vote`) o applicato a tutti i modelli della vetrina (`POST /judge/displays/vote`). Vetrina = modelli con stesso `displayNumber` nell'evento (`backend/src/contest/domain/display.ts:14-31`). Voti append-only, vale l'ultimo (`VoteModel.ts:53-71`). Categorie chiuse: 409 su singolo modello, saltate in vetrina (`VoteDisplay.ts:12-35`).
4. Completamento del giudice: richiede voto su tutti i modelli della categoria, altrimenti 409 `INCOMPLETE_VOTES` (`backend/src/contest/infra/persistence/categoryClosure.ts:66-70`).
5. Chiusura categoria (`closeCategory`, `categoryClosure.ts:48-105`): si chiude quando **tutti** i giudici assegnati hanno completato (`evaluateCompletion`, `backend/src/contest/domain/categoryClosure.ts:176-184`). Manager: chiusura manuale solo se ogni giudice assegnato ha votato ogni modello (`categoryClosure.ts:77-90`). Senza giudici assegnati: 409 `NO_JUDGES`.
6. Monitoraggio: `GET /awards/monitoring/:eventId` (`award.routes.ts:224-286`).

### 4.8 Premi e ordine di presentazione
1. Punteggio modello = somma dei rank, un voto per giudice assegnato (`computeAwards`, `domain/categoryClosure.ts:140-152`).
2. Medaglia (`selectBracket`, `domain/categoryClosure.ts:128-133`): fasce per evento con limiti inclusivi. Se più fasce combaciano vince il `medalRank` più basso. Nessuna fascia → `"None"` / 0.
3. Congelamento: nella stessa transazione di `status = closed` si scrivono le righe `awards` con `source = aggregate` (`categoryClosure.ts:94-105`). Riapertura (`PATCH status open`): elimina premi e completamenti (`categoryClosure.ts:107-122`).
4. Categorie aperte: la classifica live mostra la media dei rank, senza medaglia, ordinata per media (`award.routes.ts:98-174`).
5. Correzione manuale: `PATCH /awards/:awardId`, solo su categorie chiuse, senza validazione contro fasce o ordine (`award.routes.ts:183-222`).
6. Presentazione (`/podium`, `frontend/src/pages/Podium.tsx:22-80`):
   - evento → `GET /awards/events/:id`, solo righe con `medalLabel` (categorie chiuse);
   - `buildPodiums` (`frontend/src/lib/podium.ts`): premi per classe nell'ordine `prizeOrder` (default `["Highly Commended","Bronze","Silver","Gold"]`, `backend/src/contest/domain/prizeOrder.ts:33`), poi per `medalRank`;
   - le classi appaiono nell'ordine delle righe, non in base a `presentationOrder` (§8);
   - una vincita per passo, avanzamento da tastiera.
7. Menzioni speciali: tabella separata, non entrano nel podio (`special-mention.routes.ts`).

### 4.9 Stampe ed export
- XLSX generati lato server (`export.routes.ts:196-299`). Il foglio e il prefisso file dipendono dalle impostazioni export.
- Stampe HTML con `window.print()` (`export.routes.ts:818, 901, 1021, 1197`). Dal frontend si aprono con `openHtmlExport` / `downloadAuthenticatedFile` (`frontend/src/lib/exports.ts:26-30`, `download.ts`).
- Lingua: parametro `lang=it|en` (default `it`) su export e stampe (`printI18n.ts:146-149`; `lib/exports.ts:5-17` lo aggiunge dalla UI).
- Etichette DYMO: dati JSON da `/exports/labels/data`, stampa con SDK DYMO (`lib/dymo.ts`).

---

## 5. Pagamenti

| Elemento | Stato nel codice |
|---|---|
| Provider di pagamento (Stripe, PayPal, Satispay, PagoPA, bonifico) | **Nessuno**. Nessuna dipendenza in `backend/package.json` |
| Tabella `payments` (id, registrationId, amount int, status text, providerRef) | Esiste (`schema.ts:132-141`), nessun dato scritto dal flusso attivo |
| `POST /payments/checkout`, `/confirm`, `/webhook` | Definiti in `payment.routes.ts:7-56`, **non montati** (`app.ts:142-146`). Il commento elenca i difetti: nessun controllo di proprietà, webhook senza firma, importo dal client, nessuna transazione |
| Stato iscrizione `paid` | Impostato solo da `/payments/confirm` (disattivato). Il flusso attivo scrive sempre `accepted` (`event.routes.ts:147`) |
| Segnatura manuale "pagato" | **Assente**: nessun endpoint, nessuna colonna in UI |
| Importi | Calcolati e mostrati: quota base, prezzi ruolo coautore, categorie gratuite. Valuta EUR, valori in centesimi (`pricing.ts:2`). Impostazioni: `baseFeeCents` (admin), prezzo ruolo (Catalogo) |
| UI | Nessun riferimento allo stato di pagamento nel frontend |

Conclusione: l'app calcola il dovuto ma non traccia alcun pagamento.

---

## 6. Lingue e localizzazione

- **UI**: italiano e inglese (`Language = "it" | "en"`, `frontend/src/lib/i18n.ts:1`). Primo accesso: `it` se il browser è italiano, altrimenti `en` (`App.tsx:95-101`). Selettore nella barra superiore (`App.tsx:330-341`). Tour e guida in IT/EN (`lib/tours.ts`).
- **Messaggi API**: in inglese (es. `identity.routes.ts:64-70` "Password must be at least 8 characters long"; `event.routes.ts` "Already enrolled"). Alcuni toast mostrano il messaggio grezzo (`Settings.tsx`, `err?.message`).
- **Stampe e export**: `lang` supportato in XLSX, HTML di classe (espositori, giudici, QR), scheda modelli, etichette, utenti PDF (`printI18n.ts:1-12`). Default `it`.
- **Non localizzati**: badge staff (testo fisso "ID:", `enrollment.routes.ts:33-35`, nessun parametro `lang`); email di reset (inglese, `emailService.ts:26-35`); payload DYMO con chiavi in italiano (`lib/dymo.ts:5`).
- **Medaglie**: nomi in IT ("Alta Menzione", "Bronzo", "Argento", "Oro") e EN ("Highly Commended", "Bronze", "Silver", "Gold") in `i18n.ts:386-390` e `1345-1349`. La medaglia salvata è però una stringa libera, impostata da fasce e correzioni (§8). Il valore `"None"` è fisso nel dominio (`categoryClosure.ts:132`).
- **Privacy**: testi IT e EN con segnaposti `[TODO]` (`privacyNotice.ts`).

---

## 7. Notifiche ed email

- Provider: **Resend** (`backend/src/shared/infra/email/emailService.ts:1-15`). Mittente `RESEND_FROM_EMAIL` (default `noreply@example.com`). Senza `RESEND_API_KEY` gli invii restituiscono `false` senza errore.
- **Inviate**:
  1. Password temporanea dopo reset admin (`identity/infra/http/admin.routes.ts:245-277`, `emailService.ts:17-47`). Se l'invio fallisce: 503 e password non cambiata. La password (16 caratteri) non compare nella risposta (`identity/domain/temporaryPassword.ts:6-12`).
- **Non inviate**: conferma registrazione, conferma iscrizione, notifiche di giudizio o premi, cambio password utente (non esiste).
- **Stub**:
  - reminder iscrizioni incomplete: `POST /admin/reminders/incomplete-registrations` risponde `{sent: 0}` (`reminder.routes.ts:10-22`). `sendIncompleteRegistrationReminder` (`emailService.ts:49-77`) non è mai chiamato; il template è `TODO`;
  - scheduler: job giornaliero alle 08:00 registrato ma con handler vuoto (`backend/src/bootstrap/server.ts:8-16`); `scheduler.ts:16-18` non avvia alcun cron.
- Nessun SMS, nessuna push, nessun webhook in uscita.

---

## 8. Limiti noti, stub, TODO

### 8.1 Stub, codice morto, funzioni non montate
| # | Area | Evidenza | Impatto |
|---|---|---|---|
| 1 | Pagamenti | Route definite, non montate (`app.ts:142-146`) | Nessun pagamento tracciato |
| 2 | Reminder | Handler stub (`reminder.routes.ts:13-16`) | Nessun sollecito |
| 3 | Scheduler | Cron non attivo, handler vuoto (`server.ts:12-14`, `scheduler.ts:16-18`) | Nessun job periodico |
| 4 | Email incomplete | Template TODO (`emailService.ts:65`), mai chiamato | — |
| 5 | Award UI | `AwardsTab.tsx:261` TODO su `awardId` (funziona per righe congelate) | Basso |
| 6 | Impostazioni senza lettore | `maxVotesPerExhibitor`, `maxVoteDifferent` (`settings.routes.ts:34-35`): solo default | Nessun vincolo di voto |
| 7 | Impostazioni senza lettore | `printCodePrefix`, `printCodeDigits` salvate da Settings (`Settings.tsx:118-155`), nessun lettore backend. Il padding dei codici legge `displayNumberPadding`, chiave che nessuna UI scrive (default 4, `model-code.ts`) | Impostazione inutile |
| 8 | Impostazione lato client | `maxModelsPerUser` salvato da Settings, letto solo da `Models.tsx:446-512`. Il backend applica la costante 50 per evento (`pricing.ts:5`) | Limite admin non applicato dal server |
| 9 | Impostazione lato client | `modelImages` (`Models.tsx:443`), nessun lettore backend | Toggle senza effetto server |
| 10 | Campo inutilizzato | `levels.freeToEnter` (import e seed); il prezzo usa solo `categories.freeToEnter` (`pricingRepository.ts:47`). Commento di `pricing.ts:20-21` dice "level": incoerente | Confusione |
| 11 | Campi classe inutilizzati | `classNumber`, `classGroup`, `outOfCompetition`, `presentationOrder` importati (`import.routes.ts:65-74`), mai usati in logica, podio, stampe | "Fuori concorso" non implementato |
| 12 | Campagna | `enrollment_open_date` salvata, mai applicata (`enrollment-guard.ts` usa solo la chiusura) | Finestra solo di chiusura |
| 13 | Profilo | `publicProfile` senza effetto (nessun endpoint pubblico di profili); `avatarUrl` letto, mai scritto | Campi morti |
| 14 | Judge | Richiesta cambio categoria: API presente, nessuna UI | Funzione mancante lato giudice |
| 15 | Team | CRUD utente, non usato in iscrizione, giudizio, premi, export; solo fallback prezzi legacy (`pricingRepository.ts:70`). Non in menu (`App.tsx:227-242`) | Modulo residuo |
| 16 | Menzioni e sponsor | Solo tab admin e statistiche. Nessun output pubblico o nel podio | — |
| 17 | Ordine classi nel podio | Non da `presentationOrder`: ordine delle righe API | Ordine di premiazione non controllato |
| 18 | Stato evento | UI `draft/active/closed` (`EventsTab.tsx:13`); DB default `accepted` (`schema.ts:23`); chiusura su `closed/archived/cancelled/canceled/completed`; pubblico `active` di default (`public.routes.ts:13`) | Evento `draft` non visibile al pubblico |

### 8.2 Controllo accessi e sicurezza
| # | Evidenza | Impatto |
|---|---|---|
| 1 | Visibilità sezioni applicata lato server solo a `jury_president`, su tre endpoint (`section.middleware.ts:17-25`) | Per gli altri ruoli la sezione nascosta resta accessibile via API |
| 2 | `GET /qr/:enrollmentId` senza autenticazione (`qr.routes.ts`) | Genera QR di qualsiasi ID |
| 3 | `PUT /admin/settings` accetta chiavi arbitrarie (`settings.routes.ts:75-90`) | Nessuna whitelist |
| 4 | Upload: presigned PUT senza vincolo di tipo e dimensione (`minioStorage.ts:40-44`, nota nel codice) | Validazione solo sul content-type dichiarato |
| 5 | Account disattivato: access token valido fino a 15 min (`jwtTokenService.ts:3`) | Nessuna revoca immediata |
| 6 | PKCE store in memoria (`identity/infra/tokens/pkceStore.ts:1-20`); rate limiter per processo (`identity.routes.ts:19-20`) | Non valido con più repliche |
| 7 | Token in `localStorage` (`frontend/src/lib/auth.ts`) | Esposto a XSS |
| 8 | Seed con credenziali note (`bootstrap/seed.ts:75-78`), solo se DB vuoto e non in produzione (`server.ts:26-28`) | Da verificare in ambienti di prova |
| 9 | Segreti di produzione: `PG_PASSWORD`, `MINIO_*` con valori di default vietati (`shared/infra/config/productionEnv.ts:5-31`) | Presidio attivo |
| 10 | Richiesta di modifica: `PATCH` non verifica l'esistenza (`modification-request.routes.ts:69-79`) | Risposta `updated` anche se assente |

### 8.3 Integrità dati
| # | Evidenza | Impatto |
|---|---|---|
| 1 | Schema senza foreign key (0 `references` nel backend): integrità solo applicativa | Righe orfane possibili |
| 2 | `DELETE /models/:id` (owner) rimuove modello, immagini, coautori; non rimuove voti né premi (`model.routes.ts:434-455`) | Voti orfani |
| 3 | `DELETE /admin/models/:id` rimuove solo il modello (`admin-models.routes.ts:136-147`) | Immagini, coautori, voti orfani |
| 4 | `DELETE /categories/:id` e `DELETE /events/:id` non verificano dipendenze (`category.routes.ts:59-66`, `event.routes.ts:80-83`) | Modelli o categorie orfani |
| 5 | Eliminazione modello per owner senza controllo di finestra o categoria chiusa (commento `model.routes.ts:433`) | Premi possibili su modelli eliminati |
| 6 | Correzione premio senza validazione su fasce o ordine (`award.routes.ts:183-222`) | Medaglie libere |
| 7 | Classifica: `GET /awards/events/:id` assegna `source: "frozen"` a tutte le righe congelate, anche le correzioni (`award.routes.ts:82-93`) | La correzione non risulta come tale nella lista |
