# Analisi funzionalità mancanti rispetto al diagramma UML

## Scopo
Questa analisi confronta il backlog UML fornito con ciò che è attualmente presente nella repository, per evidenziare le funzionalità già implementate, parziali o mancanti.

## Implementazioni trovate (baseline)

### Backend (API)
Endpoint attualmente esposti:
- **Auth**: `POST /auth/register`, `POST /auth/login`.
- **Judging**: `POST /judge/vote`.
- **Models**: `POST /models/:modelId/image-upload` (solo richiesta URL firmata per upload).
- **Health**: `GET /health`.

### Frontend (UI)
Pagine attualmente presenti:
- **Login**: pagina di accesso.
- **Dashboard**: pagina principale utente.
- **Judge**: pagina per il flusso di voto giudici.

## Funzionalità core (utente) mancanti o parziali

### UC_PROFILE — Gestione Profilo Utente
**Stato**: ❌ Non implementato
- Backend: mancano `GET /users/profile`, `PUT /users/profile`, `PATCH /users/profile/contacts`, `PATCH /users/profile/avatar`.
- Frontend: manca pagina profilo e form per dati anagrafici, contatti e avatar.

### UC_TEAM_CREATE — Creazione Team/Gruppo
**Stato**: ❌ Non implementato
- Backend: manca endpoint `POST /teams`, schema Team e validazioni nome.
- Frontend: manca pagina `/teams/new` con form e validazioni.

### UC_TEAM_MANAGE — Gestione Team/Gruppo
**Stato**: ❌ Non implementato
- Backend: mancano CRUD team, gestione membri e ruoli.
- Frontend: mancano pagina gestione team, lista team utente e inviti.

### UC_MODELS_USER — Gestione Modelli Utente
**Stato**: ⚠️ Parziale (solo upload immagine)
- Backend: manca CRUD modelli, metadata, associazione team, upload multiplo immagini.
- Frontend: mancano liste e pagine create/edit con upload multiplo e filtri.

### UC_EVENT_ENROLL — Iscrizione ad Evento/Contest
**Stato**: ❌ Non implementato
- Backend: manca schema Enrollment, endpoint iscrizione e validazioni.
- Frontend: manca pagina iscrizione evento con selezione modelli/categorie.

### UC_PAYMENT — Pagamento Iscrizione
**Stato**: ❌ Non implementato
- Backend: mancano endpoint pagamento e webhook provider.
- Frontend: manca checkout e flusso post-pagamento.

### UC_ENROLL_STATUS — Visualizza Stato Iscrizioni
**Stato**: ❌ Non implementato
- Backend: mancano endpoint lista/dettaglio iscrizioni.
- Frontend: manca pagina `/my-enrollments` con filtri e stati.

## Funzionalità manager mancanti

### UC_CAT_CRUD — Gestione Categorie
**Stato**: ❌ Non implementato
- Backend: manca CRUD categorie e middleware ruolo manager.
- Frontend: manca pagina admin per categorie.

### UC_EVENT_CRUD — Gestione Eventi/Contest
**Stato**: ❌ Non implementato
- Backend: manca CRUD eventi, schema Event e gestione stato.
- Frontend: mancano pagine admin per eventi e form completo.

### UC_ENROLL_MGMT — Gestione Iscrizioni Manager
**Stato**: ❌ Non implementato
- Backend: mancano endpoint per validazione e cambio stato iscrizioni.
- Frontend: manca pagina admin iscrizioni con filtri/export.

### UC_AWARDS — Calcolo Premiazioni
**Stato**: ❌ Non implementato
- Backend: mancano ranking/awards endpoint e schema.
- Frontend: manca pagina classifiche e gestione premi.

### UC_EXPORT — Viste/Export
**Stato**: ❌ Non implementato
- Backend: mancano endpoint export CSV/XLSX/PDF.
- Frontend: mancano bottoni export e gestione download.

### UC_MODELS_FIX — Modifica Anagrafiche Modelli Admin
**Stato**: ❌ Non implementato
- Backend: manca admin models CRUD/merge.
- Frontend: manca pagina admin modelli.

## Funzionalità giudici mancanti

### UC_J_LIST — Elenco Concorsi/Partecipanti con Filtri
**Stato**: ❌ Non implementato
- Backend: mancano endpoint eventi assegnati e modelli giudicabili.
- Frontend: manca dashboard giudice con filtri.

### UC_J_SEARCH — Ricerca Concorrente/Modello
**Stato**: ❌ Non implementato
- Backend: manca search testuale/immagine.
- Frontend: manca UI ricerca.

### UC_J_QR — Scansione QR/Codice
**Stato**: ❌ Non implementato
- Backend: manca generazione QR e redirect.
- Frontend: manca scanner QR.

### UC_J_DETAIL_USER — Dettaglio Concorrente
**Stato**: ❌ Non implementato
- Backend: mancano dettagli partecipante e suoi modelli.
- Frontend: manca pagina dettaglio partecipante.

### UC_J_DETAIL_MODEL — Dettaglio Modello
**Stato**: ❌ Non implementato
- Backend: manca endpoint dettaglio modello per giudice.
- Frontend: manca pagina dettaglio modello con galleria.

### UC_J_VOTE — Votazione Modello
**Stato**: ✅ Backend implementato, frontend mancante
- Backend: presente `POST /judge/vote`.
- Frontend: manca form voto e feedback post-voto.

## Funzionalità staff/admin mancanti

### UC_CHECKIN — Check-in / Gestione Accoglienza
**Stato**: ❌ Non implementato
- Backend: mancano endpoint check-in e badge.
- Frontend: manca pagina staff check-in.

### UC_PRINT — Stampa Liste/Badge
**Stato**: ❌ Non implementato
- Backend: mancano endpoint stampa PDF.
- Frontend: manca preview e download PDF.

### UC_USER_MGMT — Gestione Utenti & Ruoli
**Stato**: ❌ Non implementato
- Backend: manca admin users CRUD e reset password.
- Frontend: manca pagina admin utenti.

### UC_ASSIGN_JUDGES — Assegnazione Giudici
**Stato**: ❌ Non implementato
- Backend: mancano endpoint judge assignment.
- Frontend: manca pagina assegnazione giudici.

## Funzionalità pubbliche mancanti

### Visualizzazione Pubblica Eventi
**Stato**: ❌ Non implementato
- Backend: manca `/public/events` e dettagli pubblici.
- Frontend: manca landing page pubblica.

## Task infrastrutturali e miglioramenti

### Autenticazione & Autorizzazione
**Stato**: ⚠️ Parziale
- Mancano refresh token, logout, reset password, verifica email e RBAC completo.

### File Upload & Storage
**Stato**: ⚠️ Parziale
- Presente solo richiesta URL firmata per singola immagine.
- Mancano upload multiplo, resizing, limiti formato e CDN.

### Notifiche
**Stato**: ❌ Non implementato
- Mancano email/in-app/push.

### Testing
**Stato**: ❌ Non implementato
- Mancano unit/integration/E2E tests.

### Documentazione
**Stato**: ⚠️ Parziale
- Swagger e README base presenti, manca copertura completa e guide aggiuntive.

## Note finali
Le uniche funzionalità effettivamente presenti al momento sono login/register, voto giudice e richiesta URL firmata per upload immagini del modello; tutto il resto risulta non implementato o parziale rispetto al backlog UML fornito.
