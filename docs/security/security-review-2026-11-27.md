# Security review – monte-san-savino-app

- **Data:** 2026-11-27
- **Branch analizzato:** `feat/step11-languages` (HEAD `aed0e0c`, working tree pulito; nessun cambio di branch, commit o push)
- **Tipo:** analisi statica read-only del codice, della configurazione (Docker, nginx, Helm, GitHub Actions) e delle dipendenze. Nessun test dinamico, nessun exploit, nessuna richiesta verso il deploy.
- **Perimetro:** applicazione esposta su internet (concorso con iscrizione pubblica, dati personali GDPR, giudici, staff, manager, admin; pagamenti non attivi).
- **Convenzioni:** i percorsi sono relativi alla radice del repo. I valori di segreti, password e token non sono riportati. Dove un fatto non è confermabile dal solo codice è marcato **da verificare**.

---

## 1. Executive summary

**Valutazione complessiva: NON pronto per restare online nello stato attuale.** Il codice applicativo ha basi solide (SQL parametrizzato, escape HTML sistematico, allowlist degli URL immagine, JWT HS256 con algoritmo fissato, token di reset robusti, controlli di ownership su modelli/team/iscrizioni, Swagger e CORS disattivati in produzione). I problemi bloccanti riguardano:

1. **Nessun TLS nel percorso pubblico** fornito dal repo (credenziali e JWT in chiaro se non c'è un terminatore esterno) – SEC-01.
2. **Escalation dei giudici sul perimetro staff**: la gerarchia dei ruoli fa ereditare ai giudici le guardie `staff`; un giudice può leggere nome e paese di qualunque partecipante per numero e modificarne la presenza – SEC-02.
3. **Anonimato del giudizio non garantito via API**: `GET /judge/participants/:userId` restituisce nome e cognome dell'espositore, `GET /judge/models` espone lo `userId` del proprietario – SEC-03. La regola di prodotto è documentata (`docs/analysis/emperor-gap-plan.md:35` e `:67`: "riquadri anonimi per numero espositore").
4. **Rate limit di login inefficace**: chiave `IP+email`, nessun limite globale per IP, nessun controllo su email casuali; in deploy compose il limite diventa di fatto per email, quindi un attaccante può bloccare un account (incluso un giudice il giorno del concorso) – SEC-04, SEC-05.
5. **Sessioni non revocabili**: refresh token di 30 giorni che sopravvivono al reset password – SEC-06.
6. **Upload MinIO non vincolato** (Content-Type e dimensione non firmati, nessun rate limit) – SEC-08.
7. **Seed con credenziali note fail-open** se `NODE_ENV` non è `production` – SEC-07.
8. **Dipendenze con advisory** (Elysia 1.4.27, Drizzle 0.36.4, react-router-dom 6.30.3) – SEC-09.

Prima di mettere online servono almeno i punti della **Fase 0** (sezione 5).

---

## 2. Tabella dei finding (ordinata per severità)

| ID | Sev. | Area | Titolo | Riferimento principale |
|---|---|---|---|---|
| SEC-01 | CRITICAL | Configurazione | Nessun TLS nel percorso pubblico (da verificare infrastruttura) | `docker-compose.yml:76-77`, `docker/nginx/security-headers.conf:30-32`, `helm/backend/templates/ingress.yaml:1-25` |
| SEC-02 | HIGH | Autorizzazione | Giudici ereditano le guardie `staff`: lettura identità partecipanti e modifica presenze | `backend/src/contest/infra/http/desk.routes.ts:17`, `:18-87`, `:88-122`; `backend/src/identity/domain/Role.ts:4-6` |
| SEC-03 | HIGH | Privacy / integrità giudizio | Identità espositore accessibile ai giudici via API durante il giudizio | `backend/src/contest/infra/http/judge.routes.ts:199-229`, `:61`, `:79`; `backend/src/contest/domain/judgeScope.ts:37-38` |
| SEC-04 | HIGH | Autenticazione | Rate limit login/registrazione: password spraying e flood con email casuali | `backend/src/shared/infra/http/rateLimiter.ts:113`, `:62-74`; `backend/src/identity/infra/http/identity.routes.ts:30` |
| SEC-05 | HIGH | Autenticazione / DoS | Lockout mirato di account (giudici, admin) per assenza di TRUST_PROXY | `backend/src/shared/infra/http/rateLimiter.ts:84-89`, `:31-32`, `:51-55`; `docker-compose.yml:43-59` |
| SEC-06 | HIGH | Autenticazione | Refresh token non revocabili; reset password non invalida le sessioni | `backend/src/identity/infra/tokens/jwtTokenService.ts:4`, `:40-50`; `backend/src/identity/application/RefreshSession.ts:18-46`; `backend/src/identity/infra/http/identity.routes.ts:350` |
| SEC-07 | HIGH | Configurazione | Seed con credenziali demo note quando `NODE_ENV` non è `production` (fail-open) | `backend/src/bootstrap/server.ts:26-28`; `backend/src/bootstrap/seed.ts:74-79` |
| SEC-08 | HIGH | File / storage | Upload MinIO: Content-Type e dimensione non vincolati, oggetti serviti pubblicamente | `backend/src/shared/infra/storage/minioStorage.ts:40-50`; `backend/src/contest/infra/http/modelUpload.routes.ts:13-51`; `backend/src/contest/application/RequestModelImageUpload.ts:10-15` |
| SEC-09 | MEDIUM | Dipendenze | Dipendenze con advisory noti (Elysia, Drizzle, react-router-dom) | `backend/package.json:19-20`; `frontend/package.json:25` |
| SEC-10 | MEDIUM | Autorizzazione | Manager legge e modifica profilo di qualunque utente, incluso admin | `backend/src/identity/infra/http/admin.routes.ts:123-201` |
| SEC-11 | MEDIUM | Logica business | Chiusura iscrizioni aggirabile spostando un modello in categoria di evento chiuso | `backend/src/contest/infra/http/model.routes.ts:354`; `backend/src/contest/infra/http/model-category-change.ts:26-36` |
| SEC-12 | MEDIUM | Integrità dati | Creazione utente admin senza normalizzazione/validazione dell'email | `backend/src/identity/infra/http/admin.routes.ts:78`, `:87`, `:92`; `backend/src/identity/domain/Email.ts:3-7` |
| SEC-13 | MEDIUM | Autorizzazione | Richiesta di modifica del giudice non verifica scope né esistenza del modello | `backend/src/contest/infra/http/modification-request.routes.ts:24-40` |
| SEC-14 | MEDIUM | Sessione client | Access e refresh token in `localStorage` | `frontend/src/lib/auth.ts:15-17`; `frontend/src/lib/api.ts:90`; `frontend/src/lib/download.ts:27` |
| SEC-15 | MEDIUM | Configurazione | Privilegi eccessivi: app con credenziali root MinIO e utente Postgres del container | `docker-compose.yml:48`, `:52-53` |
| SEC-16 | MEDIUM | Configurazione Helm | Chart Helm incompleto (nessun TRUST_PROXY, Turnstile, URL pubblico, email; MinIO su HTTP interno; multi-replica con stato in memoria) | `helm/backend/templates/deployment.yaml:21-59`; `helm/backend/values.yaml:10-19`; `backend/src/identity/infra/tokens/pkceStore.ts:12` |
| SEC-17 | MEDIUM | Rete / proxy | X-Forwarded-For appeso dal client: spoofabile se TRUST_PROXY=true | `docker/nginx/default.conf:15`; `frontend/nginx.conf:19`, `:29`; `backend/src/shared/infra/http/rateLimiter.ts:84-86` |
| SEC-18 | MEDIUM | Anti-abuso | Turnstile opzionale e solo in registrazione; reset password senza captcha | `backend/src/identity/infra/http/identity.routes.ts:80-90`, `:282-331` |
| SEC-19 | MEDIUM | GDPR | Nessuna cancellazione account né policy di retention; dati di contatto in chiaro | `backend/src/identity/infra/persistence/schema.ts`; `backend/src/identity/infra/http/user.routes.ts:15-54` (assenza di route di erasure) |
| SEC-20 | LOW | Errori | Errori non gestiti restituiti al client con il messaggio interno | `backend/node_modules/elysia/dist/compose.js:1282`; `backend/src/contest/infra/http/model.routes.ts:166-188` |
| SEC-21 | LOW | Auth | Token di reset nella query string (log del proxy, cronologia) | `backend/src/identity/infra/http/identity.routes.ts:312`; `frontend/src/pages/ResetPassword.tsx:19` |
| SEC-22 | LOW | GDPR | Export manager include social e handle anche senza opt-in | `backend/src/contest/infra/http/export.routes.ts:535`, `:561` |
| SEC-23 | LOW | GDPR / log | Indirizzi email nei log e password temporanea inviata via email in chiaro | `backend/src/shared/infra/email/emailService.ts:54-84`, `:56`, `:78`, `:81` |
| SEC-24 | LOW | Autorizzazione | `GET /settings` restituisce tutte le impostazioni (incl. `rolePermissions`) a ogni utente; `PUT` admin accetta chiavi arbitrarie senza limiti | `backend/src/contest/infra/http/settings.routes.ts:53-59`, `:85-99`, `:97` |
| SEC-25 | LOW | Esposizione dati | `/public/events?status=all` espone eventi non pubblicati | `backend/src/contest/infra/http/public.routes.ts:11-14` |
| SEC-26 | LOW | Esposizione dati | `/qr/:enrollmentId` senza autenticazione e senza verifica di esistenza | `backend/src/contest/infra/http/qr.routes.ts:4-37` |
| SEC-27 | LOW | Autorizzazione | `GET /judge/categories` senza verifica di scope | `backend/src/contest/infra/http/judge.routes.ts:354-367` |
| SEC-28 | LOW | Input | Sponsor: `logoUrl` / `websiteUrl` senza validazione (oggi non renderizzati) | `backend/src/contest/infra/http/sponsor.routes.ts:29-30`, `:39-40`, `:62-63` |
| SEC-29 | LOW | Input / HTML | Template email di promemoria non escapato (codice non raggiungibile) | `backend/src/shared/infra/email/emailService.ts:137-138`; `backend/src/contest/infra/http/reminder.routes.ts:16` |
| SEC-30 | LOW | GDPR / terze parti | Geocodifica indirizzi verso `photon.komoot.io` (componente non importato; dominio ancora in CSP) | `frontend/src/lib/LocationPicker.tsx:68`, `:110`; `docker/nginx/security-headers.conf:24` |
| SEC-31 | LOW | Headers | CSP con placeholder `localhost:9000`; manca `upgrade-insecure-requests` | `docker/nginx/security-headers.conf:24` |
| SEC-32 | LOW | Auth | Login: fallback PKCE che reinvia la password a `/auth/authorize` | `frontend/src/pages/Login.tsx:138-158` |
| SEC-33 | LOW | Frontend | Export HTML aperti come `blob:` nell'origin dell'app (protetti solo dalla CSP) | `frontend/src/lib/exports.ts:28-33` |
| SEC-34 | LOW | Supply chain / CI | Install senza lockfile congelato; action con tag mutabili; immagini `:latest` | `.github/workflows/ci.yml:41`, `:50`, `:76`; `backend/Dockerfile:4`; `docker-compose.yml:35`, `:65` |
| SEC-35 | LOW | DoS | Nessun limite esplicito alla dimensione del body nell'app (da verificare) | `backend/src/bootstrap/app.ts` (assenza di `maxRequestBodySize`) |
| SEC-36 | LOW | Config debug | Compose di debug: inspector Node (9229) e Adminer su loopback | `docker-compose.debug.yml:134-136`, `:176-177` |
| SEC-37 | LOW | Segreti | Default deboli storici in git history; `.env` locale con valori deboli o vuoti (non tracciato) | storia: commit `4750185`, `d3743ca1` (`.env.example`, `docker/postgres/*.sh`); `.env` locale (gitignored) |

---

## 3. Dettaglio dei finding

### SEC-01 – Nessun TLS nel percorso pubblico (CRITICAL, da verificare)

- **Evidenza:** `docker-compose.yml:76-77` pubblica il frontend su `8080` in HTTP. `docker/nginx/security-headers.conf:30-32` ha HSTS commentato con la nota "uncomment after TLS is in place". `helm/backend/templates/ingress.yaml` non ha alcun blocco `tls:`. `frontend/nginx.conf:1-8` ascolta in HTTP.
- **Scenario:** su rete pubblica o Wi-Fi condiviso, un attaccante in man-in-the-middle legge password di login, JWT, refresh token e dati personali; può riscrivere le risposte (incluso il `code` PKCE).
- **Severità:** CRITICAL se il repo è l'unico punto d'ingresso. Scende a MEDIUM se un reverse proxy/CDN con TLS sta davanti all'app (**da verificare** nell'infrastruttura reale).
- **Fix:** terminare TLS (ingress con certificato o proxy esterno), abilitare HSTS dopo la verifica, impostare `MINIO_PUBLIC_URL` e le origini CSP in `https://`, aggiungere `upgrade-insecure-requests`.

### SEC-02 – Giudici ereditano le guardie `staff` (HIGH)

- **Evidenza:** `backend/src/identity/domain/Role.ts:4-6` confronta i ruoli per indice (`user < staff < judge < jury_president < manager < admin`), quindi `roleAtLeast("judge","staff")` è vero. `desk.routes.ts:17` (`requireRole("staff")`) protegge `GET /staff/events/:eventId/participants/:number` (nome, paese, modelli, presenza; `:18-87`) e `POST .../presence` (`:88-122`, scrive `checkedIn` e `absent` su tutte le iscrizioni del partecipante). `enrollment.routes.ts:126-149` protegge `POST /staff/checkin/:enrollmentId` con la stessa guardia.
- **Scenario:** un giudice autenticato itera i numeri partecipante (sequenziali, `users.seq_id`) e ottiene nome, paese e modelli di tutti gli espositori, anche di categorie che non giudica. Può inoltre segnare presenti/assenti partecipanti di altri eventi, falsando la presenza e il registro assenze.
- **Severità:** HIGH (escalation orizzontale da ruolo giudice; esposizione dati personali di massa).
- **Fix:** sostituire la gerarchia con un insieme esplicito di ruoli per ogni guardia (`requireAnyRole(["staff","manager","admin"])`), rimuovere `judge` e `jury_president` dal perimetro staff, applicare anche ai test `roles.visibility`. Per i giudici restituire solo il numero espositore, mai nome o paese.

### SEC-03 – Identità espositore accessibile ai giudici durante il giudizio (HIGH)

- **Evidenza:**
  - `backend/src/contest/infra/http/judge.routes.ts:199-229` (`GET /judge/participants/:userId`): `participantView` restituisce `displayName` = nome e cognome reali (`backend/src/contest/domain/judgeScope.ts:37-38`) per ogni utente con un modello in una categoria accessibile al giudice. Il commento del codice dichiara "solo nome visualizzato e numero espositore".
  - `judge.routes.ts:61` e `:79`: `GET /judge/models` seleziona `userId` del proprietario e lo lascia nell'oggetto restituito (il filtro `:79` rimuove solo `eventId`). Questo `userId` è la chiave dell'endpoint precedente.
  - `judge.routes.ts:57-70` restituisce anche `description`, e `:163` (`GET /judge/models/:modelId`) restituisce `notes`: testo libero dell'espositore che può contenere dati identificativi.
  - `backend/src/contest/infra/http/class-print.routes.ts:213-241`: stampa "espositori e modelli" con nome reale per classe (manager). **Da verificare** se questa stampa viene consegnata ai giudici durante il giudizio.
- **Scenario:** il giudice chiama `/judge/models`, prende `userId`, chiama `/judge/participants/:userId` e conosce l'identità dell'espositore di ogni modello che giudica. Il frontend `Judge.tsx` non chiama l'endpoint, ma l'API è raggiungibile con qualunque client.
- **Regola documentata:** `docs/analysis/emperor-gap-plan.md:35` e `:67` prevedono riquadri anonimi per numero espositore e che il giudice non veda le proprie opere. Il frontend rispetta questa regola (`frontend/src/pages/Judge.tsx:47`, `:552`); il problema è il livello API, che la regola non copre.
- **Da confermare:** se la stampa "espositori" (`class-print.routes.ts:213-241`) viene consegnata ai giudici durante il giudizio.
- **Severità:** HIGH per integrità del giudizio e GDPR (minimizzazione).
- **Fix:** rimuovere `GET /judge/participants/:userId` o limitarlo al solo `displayNumber`; eliminare `userId` da `/judge/models`; non esporre `description` e `notes` ai giudici se possono contenere identità; per il print espositori verificare il processo d'uso.

### SEC-04 – Rate limit login inefficace contro spraying e flood (HIGH)

- **Evidenza:** `backend/src/identity/infra/http/identity.routes.ts:30` usa come chiave `IP + email normalizzata`. `rateLimiter.ts:113` costruisce `${ip}|${keyOf(body)}`. Non esiste un bucket per IP né per account globale. `rateLimiter.ts:62-74`: con più di `maxKeys` (10.000) chiavi vengono scartate le più vecchie, quindi un flood di email casuali cancella i contatori degli altri.
- **Scenario A (spraying):** un attaccante prova una password comune su migliaia di account, una tentativo per email, senza mai superare la soglia.
- **Scenario B (DoS CPU/memoria):** ogni richiesta con email diversa apre un bucket nuovo, quindi nessun limite; ogni tentativo esegue Argon2id (`backend/node_modules/bun-types/bun.d.ts:3039` conferma il default `argon2id` di `Bun.password`), con costo CPU/memoria non trascurabile.
- **Severità:** HIGH.
- **Fix:** aggiungere un limite globale per IP (es. 50/15 min su tutti i credential endpoint), un limite per account con backoff progressivo e CAPTCHA dopo N errori; limitare il numero di chiavi in memoria con eviction che non azzera i contatori attivi; rate limit anche a livello nginx (`limit_req_zone`) come primo strato.

### SEC-05 – Lockout mirato di account (HIGH)

- **Evidenza:** `rateLimiter.ts:84-89` restituisce l'IP del socket se `TRUST_PROXY` non è `true`. Nel compose il backend non imposta `TRUST_PROXY` (`docker-compose.yml:43-59`), quindi tutte le richieste arrivano dall'IP del container nginx. `rateLimiter.ts:31-32`: backoff base 30 s, massimo 60 min, con raddoppio a ogni violazione (`:51-55`).
- **Scenario:** 10 password errate in 15 minuti sull'email di un giudice o di un admin bloccano il login di quell'account per 30 s, poi per minuti fino a un'ora, da qualunque IP. Il giudice non può entrare durante il giudizio.
- **Severità:** HIGH (disponibilità del concorso).
- **Fix:** impostare `TRUST_PROXY=true` solo dopo aver corretto SEC-17, e usare la chiave `IP + email` come mitigazione, non come unica difesa; sostituire il lockout hard per email con rallentamento progressivo + CAPTCHA + notifica all'utente; per i ruoli privilegiati (judge/admin) valutare 2FA o allowlist IP.

### SEC-06 – Sessioni non revocabili; reset password non invalida nulla (HIGH)

- **Evidenza:** `jwtTokenService.ts:4` fissa il refresh a 30 giorni. `signRefresh` (`:40-50`) è stateless: nessun identificativo di sessione, nessun `tokenVersion`, nessuna lista di revoca. `RefreshSession.ts:18-46` riemette sempre un nuovo refresh senza invalidare il precedente (nessuna rotation con rilevamento di riuso). `identity.routes.ts:341-355` (reset password) aggiorna `passwordHash` (`:350`) e marca i token di reset come usati, ma non tocca le sessioni. Nessuna route di logout server-side.
- **Scenario:** un refresh token rubato (log, XSS, dispositivo condiviso) resta valido per 30 giorni anche dopo il cambio o il reset della password.
- **Severità:** HIGH.
- **Fix:** aggiungere `token_version` (o `sessions_revoked_at`) sull'utente, incluso nel JWT e verificato in `RefreshSession` e `authMiddleware` per il refresh; incrementarlo a ogni reset/cambio password e al logout; ruotare il refresh (one-time) con rilevamento riuso; accorciare il refresh (es. 7 giorni) e l'access (già 15 min).

### SEC-07 – Seed con credenziali note in modalità non produzione (HIGH, fail-open)

- **Evidenza:** `backend/src/bootstrap/server.ts:26-28` esegue `seedDatabase()` quando `NODE_ENV !== "production"`. `backend/src/bootstrap/seed.ts:55-63` lo esegue se il DB è vuoto e `:74-79` crea account admin, judge e utenti con password note hard-coded (valori non riportati). Il container è protetto: `backend/Dockerfile:8` imposta `NODE_ENV=production`, quindi nel deploy compose/Helm il seed non parte (**verificato**). Ma l'impostazione di default è fail-open: avviare il backend fuori dal container (o con `NODE_ENV` non impostato) su un DB vuoto crea un admin con password nota.
- **Severità:** HIGH (conditional: basta una configurazione sbagliata).
- **Fix:** invertire la logica: seed solo con variabile esplicita (`SEED_DEMO=true`) e mai con `NODE_ENV=production`; generare password casuali o richiedere hash da env; loggare un avviso se il DB è vuoto in modalità non demo.

### SEC-08 – Upload MinIO non vincolato (HIGH)

- **Evidenza:** `backend/src/shared/infra/storage/minioStorage.ts:40-46`: il commento dichiara che `presignedPutObject` non firma Content-Type né dimensione; il parametro `contentType` di `getUploadUrl` (`:44`) non viene usato nella firma. `modelUpload.routes.ts:39` e `RequestModelImageUpload.ts:10-15` validano il Content-Type solo lato API. `minioStorage.ts:47-48` costruisce l'URL pubblico `MINIO_PUBLIC_URL/bucket/key`. Nessun rate limit su `POST /models/:modelId/image-upload`. La policy del bucket (lettura anonima) non è nel repo: **da verificare**.
- **Scenario A:** un utente registrato (con un proprio modello) ottiene un URL firmato e carica un file con `Content-Type: text/html` o `image/svg+xml` contenente script; se il bucket è leggibile pubblicamente e servito sullo stesso host dell'app, è XSS con accesso a `localStorage` (token). Se è su host separato, resta phishing sul dominio dei file.
- **Scenario B:** upload di file da centinaia di MB, ripetuti perché ogni richiesta genera un nuovo URL (120 s, `minioStorage.ts:8`); esaurimento dello storage.
- **Severità:** HIGH (MEDIUM se il bucket non è pubblico e il dominio è separato — **da verificare**).
- **Fix:** usare `presignedPostPolicy` con `content-type` e `content-length-range` vincolati (il commento nel codice indica già la strada); servire le immagini da un dominio dedicato senza cookie, con `Content-Disposition` e `X-Content-Type-Options: nosniff` sul bucket o tramite proxy; rate limit e quota per utente; ricontrollare i magic bytes in un passo di validazione (o job asincrono).

### SEC-09 – Dipendenze con advisory noti (MEDIUM)

Verifica eseguita con `npm audit --omit=dev` sul frontend (4 vulnerabilità moderate, tutte con fix disponibile). Per il backend, `bun` non offre un audit: le versioni installate sono state confrontate manualmente con gli advisory pubblicati.

| Pacchetto | Installato | Advisory | Stato |
|---|---|---|---|
| `elysia` (`backend/package.json:20`, `^1.0.0`) | 1.4.27 | CVE-2026-56669 / GHSA-9643-4qgh-g8mx: complessità algoritmica, fix in 1.4.29 ([GitLab advisories](https://advisories.gitlab.com/npm/elysia/CVE-2026-56669/)) | Affetto secondo questa fonte; impatto sulle route del repo **da verificare**. Altri advisory Elysia (prototype pollution GHSA-hxj9-33pp-j2cc, cookie GHSA-8vch-m3f4-q8jf, ReDoS GHSA-f45g-68q3-5w8x) risultano già corretti in 1.4.27 ([OSV](https://osv.dev/vulnerability/GHSA-hxj9-33pp-j2cc), [OSV](https://osv.dev/vulnerability/GHSA-f45g-68q3-5w8x)). |
| `drizzle-orm` (`backend/package.json:19`, `^0.36.0`) | 0.36.4 | CVE-2026-39356 / GHSA-gpj5-g38j-94v9: escape degli identificatori, fix in 0.45.2 ([NVD](https://nvd.nist.gov/vuln/detail/CVE-2026-39356), [Snyk](https://security.snyk.io/vuln/SNYK-JS-DRIZZLEORM-16000009)) | Range vulnerabile riportato in modo discordante (`<0.45.2` o `>=0.37.0 <0.45.2`). Nel repo non risultano identificatori costruiti da input (`sql.identifier`/`.as` non usati con input utente, verificato con ricerca): **da verificare**, ma l'upgrade va fatto. |
| `react-router-dom` (`frontend/package.json:25`) | 6.30.3 (npm audit) | GHSA-jjmj-jmhj-qwj2: open redirect con XSS, range `>=6.30.2 <=6.30.5`, fix ≥6.30.6; GHSA-wrjc-x8rr-h8h6: redirect via backslash, `<7.18.0` ([GitHub](https://github.com/advisories/GHSA-jjmj-jmhj-qwj2), [GitHub](https://github.com/advisories/GHSA-wrjc-x8rr-h8h6)) | Il `next` di login è filtrato da `frontend/src/lib/redirect.ts:6-12` (rifiuta `//`, `/\`, URL assolute): **mitigato per quel flusso**. Altre `navigate()` con input utente: **da verificare**. |
| `yaml` (transitiva, npm audit) | 1.10.2 | GHSA-48c2-rrv3-qjmp: stack overflow su YAML annidato ([GitHub](https://github.com/advisories/GHSA-48c2-rrv3-qjmp)) | Basso impatto; aggiornare con il lockfile. |

- **Fix:** `npm audit fix` sul frontend (react-router ≥6.30.6); pianificare l'upgrade di Elysia ≥1.4.29 e Drizzle ≥0.45.2 con i test d'integrazione esistenti; aggiungere `bun` audit o un controllo CI con database advisory.

### SEC-10 – Manager su profili di admin (MEDIUM)

- **Evidenza:** `backend/src/identity/infra/http/admin.routes.ts:123-162` (`GET /admin/users/:userId/profile`) e `:163-201` (`PUT /admin/users/:userId/profile`) sono protetti solo da `requireRole("manager")` (`:66`). Non chiamano `authorizeUpdateUser` né `canManageRole`, a differenza di `PATCH /:userId` (`:228-256`) e del reset password (`:268-308`).
- **Scenario:** un manager legge email, telefono, indirizzo e contatti di emergenza di un admin, e ne modifica i dati (incluso lo `username`, che è un identificatore di login).
- **Severità:** MEDIUM.
- **Fix:** applicare `canManageRole` (o la stessa policy di `authorizeUpdateUser`) a GET e PUT del profilo; consentire al manager di vedere solo i ruoli sotto il proprio.

### SEC-11 – Chiusura iscrizioni aggirabile (MEDIUM)

- **Evidenza:** `backend/src/contest/infra/http/model.routes.ts:354` chiama `checkEnrollmentOpen(tenantDb, model.categoryId, set)`, cioè controlla la categoria **di partenza**. Se il body contiene `categoryId` diverso (`:375-383`, `:397`, `:413`), il nuovo valore non viene controllato contro la finestra di iscrizione del relativo evento: `applyCategoryChange` (`model-category-change.ts:26-36`) verifica solo che la categoria non sia `closed`.
- **Scenario:** un utente con iscrizione chiusa per l'evento B sposta un modello dall'evento A (aperto) a una categoria dell'evento B.
- **Severità:** MEDIUM (integrità delle regole di iscrizione; nessun impatto GDPR diretto).
- **Fix:** eseguire `checkEnrollmentOpen` anche sulla categoria di destinazione quando cambia, con la stessa logica di `POST /models`.

### SEC-12 – Email admin non normalizzata (MEDIUM)

- **Evidenza:** `backend/src/identity/infra/http/admin.routes.ts:78` cerca `eq(usersTable.email, body.email)` senza normalizzare; `:87` e `:92` salvano e restituiscono l'email grezza. Il resto del sistema usa `Email.create` (`backend/src/identity/domain/Email.ts:3-7`: trim + lowercase + validazione), usato in login e forgot-password.
- **Scenario:** un manager crea `Mario@Esempio.it`. Il login con `mario@esempio.it` non trova l'account (`findByEmail` usa il valore normalizzato); il reset password non lo raggiunge; un secondo account con email in altro case risulta possibile. Un'email malformata viene accettata.
- **Severità:** MEDIUM.
- **Fix:** usare `Email.create` in `POST /admin/users`, controllo di unicità sul valore normalizzato e indice unico su `lower(email)`; migrare gli account esistenti con una query di verifica (da verificare la presenza di duplicati).

### SEC-13 – Richiesta di modifica senza scope (MEDIUM)

- **Evidenza:** `backend/src/contest/infra/http/modification-request.routes.ts:24-40`: `POST /judge/modification-requests` inserisce `modelId: t.String()` senza verificare che il modello esista, che il giudice possa votarlo (`judgeCanVote`) o che non sia suo. `reason` non ha `maxLength`. Il `modelId` non è validato come UUID: un valore non UUID produce un errore Postgres (vedi SEC-20).
- **Scenario:** un giudice crea richieste di cambio categoria per modelli di altri eventi o inesistenti; i manager ricevono code di richieste false; il testo `reason` può riempire il DB.
- **Severità:** MEDIUM.
- **Fix:** validare `modelId` come UUID, applicare `judgeCanVote` e il controllo di ownership, limitare `reason` (es. 1000 caratteri) e il numero di richieste pendenti per giudice.

### SEC-14 – Token in `localStorage` (MEDIUM)

- **Evidenza:** `frontend/src/lib/auth.ts:15-17` salva access token, refresh token e scadenza in `localStorage`. `frontend/src/lib/api.ts:90` e `frontend/src/lib/download.ts:27` li inviano come Bearer.
- **Scenario:** qualunque XSS (anche in una dipendenza o in un export HTML, vedi SEC-33) esfiltra il refresh token valido 30 giorni (SEC-06).
- **Mitigazione presente:** CSP `script-src 'self'` (`docker/nginx/security-headers.conf:24`) riduce il rischio di XSS inline.
- **Severità:** MEDIUM.
- **Fix:** spostare il refresh token in cookie `HttpOnly; Secure; SameSite=Strict` (con endpoint `/auth/refresh` su path dedicato e protezione CSRF), oppure un BFF; ridurre la durata del refresh (SEC-06).

### SEC-15 – Privilegi eccessivi delle credenziali applicative (MEDIUM)

- **Evidenza:** `docker-compose.yml:48` imposta `PG_USER` = `POSTGRES_USER` (default `postgres`, superuser del container Postgres ufficiale; **da verificare** nel deploy). `docker-compose.yml:52-53` usa `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` come chiavi applicative (`MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY`).
- **Scenario:** una SQL injection futura o un RCE nel backend ottiene superuser del DB e amministrazione completa di MinIO (cancellazione bucket, policy pubbliche).
- **Severità:** MEDIUM.
- **Fix:** creare un ruolo applicativo con `CONNECT` + DML sullo schema tenant (non superuser, non owner); utente MinIO dedicato con policy `s3:GetObject`/`s3:PutObject` sul solo bucket `models`.

### SEC-16 – Chart Helm incompleto e non adatto a più repliche (MEDIUM)

- **Evidenza:** `helm/backend/templates/deployment.yaml:21-59` imposta solo PORT, PG_*, JWT_SECRET, MINIO_*. Mancano `TRUST_PROXY`, `PUBLIC_APP_URL`, `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY`, `RESEND_*`, `JUDGE_SESSION_HOURS`. `helm/backend/values.yaml:19` imposta `MINIO_PUBLIC_URL: http://minio:9000` (URL interno, HTTP). `helm/backend/values.yaml:1` ha `replicaCount: 2`. `backend/src/identity/infra/tokens/pkceStore.ts:12` tiene i codici PKCE in memoria di processo; `rateLimiter.ts:4-7` documenta che il rate limit è per processo. Il frontend Helm non monta la configurazione nginx con `/api` (`helm/frontend/values.yaml`).
- **Conseguenze:** senza Turnstile la registrazione è aperta a bot (SEC-18); con 2 repliche il rate limit vale il doppio e il flusso PKCE può fallire tra repliche; le immagini sono referenziate con URL interno non raggiungibile dal browser; le email di reset non partono; i link di reset puntano a `http://localhost:5173` (default di `publicAppUrl`, `backend/src/contest/infra/http/class-print.routes.ts:20-22`).
- **Severità:** MEDIUM.
- **Fix:** allineare il chart alle variabili del compose, con valori obbligatori per Turnstile, `PUBLIC_APP_URL`, `TRUST_PROXY` (solo dietro proxy controllato), `JUDGE_SESSION_HOURS`; spostare rate limit e PKCE su store condiviso (Postgres o Redis) prima di usare più di una replica; aggiungere `tls:` all'ingress.

### SEC-17 – X-Forwarded-For spoofabile (MEDIUM; HIGH se TRUST_PROXY=true)

- **Evidenza:** `docker/nginx/default.conf:15` e `frontend/nginx.conf:19`, `:29` usano `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`, che **aggiunge** l'IP del client in coda a un eventuale header inviato dal client. `rateLimiter.ts:84-86` usa il **primo** valore quando `TRUST_PROXY=true`, cioè quello fornito dall'attaccante.
- **Scenario:** con `TRUST_PROXY=true`, ogni richiesta con `X-Forwarded-For: <IP casuale>` ha un bucket nuovo: il rate limit di login è annullato (combinato con SEC-04 diventa password guessing illimitato).
- **Fix:** in nginx usare `proxy_set_header X-Forwarded-For $remote_addr;` (o `real_ip` module con trusted proxies); nel backend prendere l'**ultimo** hop, o l'IP del socket se il proxy è l'unico hop; documentare `TRUST_PROXY` nel `.env.example`.

### SEC-18 – Anti-abuso incompleto (MEDIUM)

- **Evidenza:** `identity.routes.ts:80-90`: Turnstile è verificato solo se `TURNSTILE_SECRET_KEY` è impostato; altrimenti la registrazione è libera. `identity.routes.ts:282-331` (`/auth/forgot-password`) non ha captcha e invia un'email a ogni account attivo (`:314`); il limite è per IP+email, quindi l'email di una vittima può essere inondata da molti IP. `/auth/login` e `/auth/authorize` non hanno captcha (solo rate limit di SEC-04).
- **Severità:** MEDIUM (dipende dalla configurazione: **da verificare** che `TURNSTILE_SECRET_KEY` sia impostato in produzione; oggi il chart Helm non lo prevede, SEC-16).
- **Fix:** Turnstile obbligatorio in produzione (fail-closed se la chiave manca); captcha dopo N tentativi su login e forgot-password; limite per email destinataria sul reset.

### SEC-19 – GDPR: cancellazione, retention, cifratura (MEDIUM)

- **Evidenza:** non esiste alcuna route di cancellazione account per utente né per admin (ricerca nei route `identity/` e `contest/`: solo cancellazione di modelli, immagini, team). Nessuna policy di retention nel repo (`grep` su `retention`/`conservazione` in `docs/` senza riscontri). I dati di profilo (`phone`, `address`, `emergency_contact`, `country`) sono in chiaro in `user_profiles` (`backend/src/identity/infra/http/user.routes.ts:15-54`), senza cifratura applicativa. `backend/src/identity/infra/persistence/schema.ts` conferma le colonne.
- **Scenario:** una richiesta di cancellazione (art. 17 GDPR) non è soddisfabile via applicazione; dopo la chiusura del concorso i dati restano indefinitamente; un dump del DB espone recapiti e contatti di emergenza.
- **Severità:** MEDIUM (conformità; **da verificare** se esiste una procedura manuale fuori dal repo).
- **Fix:** endpoint di cancellazione/anonimizzazione (utente e admin) con registro; job di retention per dati di iscrizione dopo l'evento; cifratura a riposo del volume DB o dei campi di contatto; informativa aggiornata con tempi di conservazione.

### SEC-20 – Errori interni restituiti al client (LOW)

- **Evidenza:** la gestione di default di Elysia 1.4.27 imposta `context.response = error.message` per gli errori non gestiti (`backend/node_modules/elysia/dist/compose.js:1282`). `domainErrorHandler` (`backend/src/shared/infra/http/domainErrorHandler.ts`) gestisce solo errori di dominio e 23505. Esempio: `POST /models` accetta `categoryId: t.String()` (`model.routes.ts:276`) e lo passa a `checkEnrollmentOpen` (`model.routes.ts:185`, `enrollment-guard.ts:40-44`); un valore non UUID genera un errore Postgres che viene restituito al client.
- **Fix:** `onError` globale che in produzione restituisce `{ error: "Internal error" }` e logga il dettaglio; validare gli UUID con `format: "uuid"` in tutti gli schemi (`categoryId`, `levelId`, `teamId`).

### SEC-21 – Token di reset nella query string (LOW)

- **Evidenza:** `identity.routes.ts:312` genera `${PUBLIC_APP_URL}/reset-password?token=...`; `frontend/src/pages/ResetPassword.tsx:19` legge il token dalla query.
- **Scenario:** il token (60 minuti, monouso) finisce nei log di accesso di nginx (che registrano l'URL completo) e nella cronologia del browser.
- **Fix:** spostare il token nel fragment (`#token=`) che non viene inviato al server, oppure usare un codice a breve durata scambiato via POST.

### SEC-22 – Export con social non opt-in (LOW)

- **Evidenza:** `backend/src/contest/infra/http/export.routes.ts:535` e `:561` esportano sempre `patreon`, `pinterest`, `tiktok` per ogni iscrizione, indipendentemente dalle impostazioni di esportazione e dall'opt-in pubblico del profilo (`publicProfile`).
- **Fix:** esportare i social solo con `publicProfile = true` o con un'impostazione esplicita; minimizzare i campi per l'uso dichiarato.

### SEC-23 – Dati personali nei log e in email (LOW)

- **Evidenza:** `backend/src/shared/infra/email/emailService.ts:56`, `:78`, `:81` scrivono l'indirizzo del destinatario nei log. `:54-84` (`sendPasswordReset`) invia la password temporanea in chiaro via email (usato da `POST /admin/users/:userId/reset-password`, `admin.routes.ts:288-299`); la password è generata e non restituita (buono).
- **Fix:** loggare un hash o un identificativo utente anziché l'email; preferire un link di impostazione password (token monouso) alla password in chiaro.

### SEC-24 – Impostazioni: lettura e scrittura troppo ampie (LOW)

- **Evidenza:** `backend/src/contest/infra/http/settings.routes.ts:53-59`: `GET /settings` restituisce tutte le righe della tabella `settings` a ogni utente autenticato (incluse `rolePermissions` e `sectionVisibility`). `:85-99`: `PUT /admin/settings` salva qualunque chiave (`:97`) senza whitelist e senza limite di lunghezza del valore (`t.Record(t.String(), t.String())`).
- **Fix:** restituire solo le chiavi pubbliche necessarie; whitelist delle chiavi scrivibili; `maxLength` sui valori.

### SEC-25 – Eventi non pubblicati esposti (LOW)

- **Evidenza:** `backend/src/contest/infra/http/public.routes.ts:11-14`: con `?status=all` (senza auth) restituisce `select()` di tutti gli eventi, inclusi `draft`.
- **Fix:** rimuovere `status=all` dal pubblico o limitarlo a `active`/`accepted`.

### SEC-26 – QR code senza autenticazione (LOW)

- **Evidenza:** `backend/src/contest/infra/http/qr.routes.ts:4-37`: `/qr/:enrollmentId`, `/png`, `/data` non richiedono auth e non verificano che l'iscrizione esista. Non rivelano dati personali, ma permettono di generare QR arbitrari (costo CPU per richiesta).
- **Fix:** rimuovere la route pubblica (il QR è già incluso nel badge, `enrollment.routes.ts:177`) o richiedere auth staff e verificare l'esistenza.

### SEC-27 – Categorie del giudice senza scope (LOW)

- **Evidenza:** `backend/src/contest/infra/http/judge.routes.ts:354-367` (`GET /judge/categories?eventId=`) restituisce id e nome di tutte le categorie dell'evento, senza verificare le assegnazioni del giudice.
- **Fix:** filtrare per `judge_assignments` del giudice (o per ruolo privilegiato).

### SEC-28 – Sponsor: URL non validati (LOW, latente)

- **Evidenza:** `backend/src/contest/infra/http/sponsor.routes.ts:29-30`, `:39-40`, `:62-63`: `logoUrl` e `websiteUrl` sono salvati come stringhe libere. Oggi non vengono renderizzati (`frontend/src/pages/admin/SponsorsTab.tsx` non li usa; nessun riferimento in `backend/src` fuori dal CRUD). Se in futuro diventano `href`/`src`, un `javascript:` diventa XSS.
- **Fix:** applicare `normalizeSocialValue`-like (solo http/https) e `isAllowedImageUrl` per `logoUrl`.

### SEC-29 – Template email di promemoria non escapato (LOW, non raggiungibile)

- **Evidenza:** `backend/src/shared/infra/email/emailService.ts:137-138` interpola `params.enrollmentCloseDate` e `params.frontendUrl` senza escape. Il metodo non è chiamato (`reminder.routes.ts:16` è uno scaffold; `server.ts:12-14` è un TODO).
- **Fix:** usare `escapeHtml` prima di riattivare il promemoria.

### SEC-30 – Geocodifica verso terzi (LOW, componente non importato)

- **Evidenza:** `frontend/src/lib/LocationPicker.tsx:68` e `:110` inviano indirizzi e coordinate a `photon.komoot.io`. Il componente non è importato da nessun file (`grep` su `frontend/src`). Il dominio è ancora in CSP (`docker/nginx/security-headers.conf:24`).
- **Fix:** rimuovere il componente o, se riattivato, dichiarare il trasferimento nell'informativa e usare un geocoder interno; rimuovere il dominio dalla CSP.

### SEC-31 – CSP con placeholder e senza upgrade (LOW)

- **Evidenza:** `docker/nginx/security-headers.conf:24`: `img-src` e `connect-src` contengono `http://localhost:9000`; manca `upgrade-insecure-requests`. Il commento (`:9-12`) chiede di sostituire il placeholder, ma non c'è controllo automatico.
- **Fix:** sostituire con l'origin HTTPS di MinIO (generato da template), aggiungere `upgrade-insecure-requests`, aggiungere un check CI su `localhost` nei file di produzione.

### SEC-32 – Fallback PKCE sul login (LOW)

- **Evidenza:** `frontend/src/pages/Login.tsx:138-158`: se `/auth/login` risponde 404 o 405, il client rinvia email e password a `/auth/authorize` e poi a `/auth/token`. Il PKCE non aggiunge protezione quando chi trasmette la password è lo stesso client; il percorso è un residuo di compatibilità.
- **Fix:** rimuovere il fallback una volta verificato che il backend risponde sempre a `/auth/login`.

### SEC-33 – Export HTML come `blob:` nell'origin dell'app (LOW)

- **Evidenza:** `frontend/src/lib/exports.ts:28-33`: l'HTML restituito dal backend viene aperto con `URL.createObjectURL` in una nuova scheda. Un blob creato dalla pagina eredita l'origin e la CSP dell'app. Il backend escapa tutti i template verificati (`export.routes.ts`, `class-print.routes.ts`, `enrollment.routes.ts`), quindi il rischio è difensivo.
- **Fix:** servire le stampe con `Content-Security-Policy: sandbox` o da un endpoint separato senza token; evitare `blob:` per contenuti generati dal backend.

### SEC-34 – Supply chain e CI (LOW)

- **Evidenza:** `.github/workflows/ci.yml:50` e `:76` usano `bun install` senza `--frozen-lockfile`; `backend/Dockerfile:4` idem. Le action sono referenziate per tag (`actions/checkout@v4`, `oven-sh/setup-bun@v2`, `docker/*@v3/v5`, `ci.yml:41`), non per SHA. `docker-compose.yml:35` e `:65` usano `:latest`. Positivo: i workflow hanno `permissions: contents: read` e il job di build usa `packages: write` solo su `main`.
- **Fix:** `bun install --frozen-lockfile`; pin delle action per SHA; tag di versione immutabili nel compose.

### SEC-35 – Limite del body (LOW, da verificare)

- **Evidenza:** `backend/src/bootstrap/app.ts` non imposta alcun limite di dimensione del body. Il default di Bun è da verificare (per la versione 1.1.29 nel Dockerfile). Il frontend nginx non imposta `client_max_body_size`, quindi applica il default di nginx (1 MB), che però vale solo dietro quel proxy. Il backend è esposto direttamente nel chart Helm se l'ingress backend viene abilitato (`helm/backend/values.yaml:28`).
- **Fix:** impostare esplicitamente il limite (nginx e app); il CSV import ha già un limite di byte (`shared/domain/csvImport.ts`, `guard`) ma viene letto in memoria prima del controllo.

### SEC-36 – Compose di debug (LOW)

- **Evidenza:** `docker-compose.debug.yml:134-136` pubblica l'inspector Node 9229 e l'API su `127.0.0.1`; `:176-177` Adminer su `127.0.0.1:8888`. `:119` imposta `NODE_ENV: development`. Non esposti all'esterno, ma l'inspector permette esecuzione di codice a chi ha accesso locale.
- **Fix:** non usare il file di debug su host condivisi; documentarlo.

### SEC-37 – Segreti: default storici e file locale (LOW)

- **Evidenza:**
  - Storia git: default `postgres` e `minioadmin` in `.env.example` e negli script `docker/postgres/*.sh` (commit `4750185`, `cb1979f`, `d3743ca1`). Verificato che la storia non contiene segreti reali: solo fallback di default. Il `POSTGRES_PASSWORD` di default ora è rimosso.
  - `.env` locale (gitignored, non tracciato in storia): alcune chiavi (`POSTGRES_PASSWORD`, `PG_PASSWORD`, `MINIO_*`) risultano vuote o con valori deboli. Verificato senza stampare valori.
- **Fix:** se un deploy ha usato i default storici, ruotare le credenziali; tenere `.env` locale fuori dai server di produzione (lo script `start-prod.ps1:20-85` genera i segreti in modo corretto e non li stampa).

---

## 4. Verificato e risultato corretto

- **SQL:** tutte le `sql\`\`` usano parametri interpolati (`import.routes.ts:56`, `admin.routes.ts:29-30`, `userRepository.drizzle.ts:16`); nessun `sql.raw`. Gli identificatori in `ensureTenantSchema.ts` sono costanti.
- **Login `next`:** `frontend/src/lib/redirect.ts:6-12` rifiuta URL assolute, `//`, `/\`, caratteri di controllo e `/login`. Nessun open redirect nel flusso di login.
- **Escape HTML:** `backend/src/shared/domain/escapeHtml.ts:1-8` usato in tutti i template di stampa verificati; il badge ha CSP `default-src 'none'` (`enrollment.routes.ts:15`).
- **XLSX:** celle `inlineStr` (`export.routes.ts:182-200`): i valori che iniziano con `=` restano testo, nessuna formula injection. Non esistono export CSV.
- **Social:** `backend/src/shared/domain/socialLinks.ts:15-57` rifiuta `javascript:`, `data:` e credenziali nell'URL.
- **Public socials:** mostrano l'espositore solo con `publicProfile === true` (`backend/src/contest/domain/publicSocials.ts:27-45`) e solo a classi chiuse.
- **Iscrizioni e modelli:** IDOR escluso su `GET/PUT/DELETE /models/:id`, `/images`, `/teams/*` e `/enrollments/:id` (filtro `userId`); `POST /events/:id/enroll` verifica ownership (`contest/domain/enrollment.ts:40-48`).
- **Giudici:** voto su modello proprio bloccato (`OwnModelError`), scope per categoria/evento (`judgeAccess.ts`), modelli di proprietari assenti esclusi.
- **Admin/manager:** `PATCH /admin/users/:id` applica `authorizeUpdateUser` (self-role-change bloccato; manager non può assegnare ruoli ≥ il proprio); reset password admin con temp password solo via email e 503 se l'email non parte.
- **Reset password:** token di 32 byte casuali (`domain/passwordReset.ts:7-9`), conservato come SHA-256, 60 minuti, monouso con claim atomico (`identity.routes.ts:341-355`); risposta uniforme in forgot-password (`:296`, `:315`).
- **Password hashing:** `Bun.password` con default `argon2id` (`identity/infra/crypto/bcryptHasher.ts`; il nome del file è fuorviante, SEC-40 info).
- **JWT:** algoritmo fissato a HS256 in verifica (`jwtTokenService.ts:53`); `tokenType` controllato (access ≠ refresh); segreto obbligatorio ≥32 caratteri (`:8-17`); judge session cap su refresh (`judgeSession.ts`, `RefreshSession.ts:31-33`).
- **PKCE:** solo `S256` (`identity.routes.ts:172`), verifier 43-128 caratteri, codici UUID v4 monouso con TTL 5 minuti (`pkceStore.ts`).
- **Swagger:** disattivato in produzione (`app.ts:45-47`); `NODE_ENV=production` nell'immagine backend (`backend/Dockerfile:8`).
- **CORS:** in produzione senza `CORS_ORIGIN` non emette header CORS (`app.ts:53-57`): same-origin tramite nginx.
- **Segreti in produzione:** `assertProductionSecrets` (`shared/infra/config/productionEnv.ts`) rifiuta `postgres`/`minioadmin` e chiavi mancanti; `start-prod.ps1` genera i segreti senza stamparli.
- **MinIO:** chiave oggetto generata dal server (`buildModelImageKey`), scadenza 120 s, URL di immagine sempre validate con allowlist (`imageUrl.ts`), console MinIO non pubblicata.
- **Mass assignment profilo:** `PUT /users/profile` passa `profileBody` all'insert, ma Elysia 1.4.27 con `normalize: true` rimuove i campi non dichiarati (`backend/node_modules/elysia/dist/schema.js:408-414`, additionalProperties di default `false`). Raccomandato comunque un `pick` esplicito.
- **Import CSV:** solo manager, limiti di byte e righe (`shared/domain/csvImport.ts`, `guard`).
- **Turnstile:** verifica lato server con timeout e fail-closed sul risultato (`identity/infra/captcha/turnstile.ts:15-35`).
- **Log:** `logger.middleware.ts` registra solo il pathname (la query non viene loggata); redact di password, token e `authorization` (`shared/infra/logger/logger.ts:20-36`).
- **CI:** `permissions: contents: read`; nessun `pull_request_target`; secret di test solo nel job di test.

---

## 5. Piano di remediation

**Decisioni del responsabile (2026-11-27):** fase 0 approvata, una PR per gruppo di correzioni. In produzione non c'è ancora un terminatore TLS: SEC-01 resta CRITICAL e va implementato. Regola di anonimato confermata: durante il giudizio il giudice non conosce mai l'identità dell'espositore (la stampa "espositori e modelli" resta riservata al manager).

### Fase 0 – prima di restare online (bloccanti)

1. **SEC-01** TLS davanti a nginx/ingress; HSTS; origini CSP e `MINIO_PUBLIC_URL` in https.
2. **SEC-02** Guardie per ruolo esplicite (niente gerarchia sulle route staff); test di ruolo che verifichino che judge/jury_president ricevano 403 su `/staff/*`.
3. **SEC-03** Rimuovere `GET /judge/participants/:userId` o ridurlo a `displayNumber`; rimuovere `userId` da `/judge/models`; decidere su `description`/`notes` e sulla stampa espositori (**confermare la regola di anonimato con il responsabile**).
4. **SEC-04 + SEC-05 + SEC-17** Rate limit a più livelli: nginx `limit_req` per IP; limite globale per IP nel backend; `X-Forwarded-For` con `$remote_addr` e backend che prende l'ultimo hop; `TRUST_PROXY=true` solo dopo questa correzione; lockout soft con CAPTCHA.
5. **SEC-06** Revoca delle sessioni (`token_version` incrementato a reset/cambio password/logout), refresh con rotation e rilevamento riuso; ridurre la durata del refresh.
6. **SEC-07** Seed solo con `SEED_DEMO=true` esplicito; mai su `NODE_ENV=production`.
7. **SEC-08** `presignedPostPolicy` con Content-Type e dimensione vincolati; bucket con policy verificata; quota e rate limit sull'upload.
8. **SEC-09** Aggiornare `react-router-dom` (≥6.30.6), Elysia (≥1.4.29) e Drizzle (≥0.45.2) con la suite di test (CI backend e frontend).

### Fase 1 – entro due settimane

9. **SEC-10, SEC-11, SEC-12, SEC-13**: policy sulle route admin e giudice, normalizzazione email, controllo sulla categoria di destinazione.
10. **SEC-14** Refresh token in cookie HttpOnly (o BFF) con CSRF.
11. **SEC-15** Utenti DB e MinIO con privilegi minimi.
12. **SEC-16** Chart Helm allineato al compose (variabili, TLS, ingress); store condiviso per PKCE e rate limit se si usano più repliche.
13. **SEC-18** Turnstile obbligatorio in produzione (fail-closed); captcha su forgot-password dopo N richieste.
14. **SEC-19** Endpoint di cancellazione/anonimizzazione, job di retention, cifratura dei campi di contatto; aggiornare l'informativa.

### Fase 2 – hardening

15. **SEC-20 → SEC-37**: errore globale generico, token di reset nel fragment, minimizzazione export, log senza email, whitelist impostazioni, rimozione `status=all`, `/qr` autenticato, scope su `/judge/categories`, validazione URL sponsor, escape nel template email, rimozione `LocationPicker` e del dominio in CSP, CSP con `upgrade-insecure-requests`, rimozione fallback PKCE, sandbox per le stampe, `--frozen-lockfile` e pin delle action, limite esplicito del body, documentazione del compose di debug, rotazione dei default storici se usati.

---

## 6. Limiti dell'analisi e verifiche aperte (da verificare)

- **Infrastruttura reale:** presenza di un terminatore TLS esterno, valori effettivi di `TRUST_PROXY`, `TURNSTILE_SECRET_KEY`, `PUBLIC_APP_URL`, `MINIO_PUBLIC_URL`, policy del bucket MinIO, privilegi dell'utente Postgres (SEC-01, SEC-05, SEC-08, SEC-15, SEC-18).
- **Regola di anonimato:** documentata in `docs/analysis/emperor-gap-plan.md:35` e `:67`. Da confermare solo il processo d'uso della stampa "espositori e modelli" (SEC-03).
- **Impatto delle CVE su Elysia 1.4.27 e Drizzle 0.36.4** (SEC-09): range riportati da fonti diverse; confermare sul codice con i test d'integrazione dopo l'upgrade.
- **Limite del body in Bun** (SEC-35): non verificato a runtime.
- **Copertura di lettura:** tutte le route sono state mappate per guardia e ownership; letti in dettaglio i moduli identity, settings, judge, desk, enrollment, event enroll, model, modelUpload, team, public e socials, qr, export (sezioni di enrollment e models, guardie di tutti i gruppi, escape). **Non letti riga per riga:** i gruppi award, honors, ceremony, stats, presentation/photography/desk print, import (oltre a guardie e limiti CSV), levels, pricing, member-roles, level-up e la maggior parte dei 1.440 righe di `export.routes.ts`. Per questi è stata verificata solo la guardia di ruolo e l'escape nei punti campione. **Da completare** prima di una conclusione definitiva.
- **Frontend:** scansione mirata (storage, redirect, HTML pericoloso, chiamate a terzi, parametri URL). Non è stato eseguito un audit completo dei componenti.
- **Nessun test dinamico:** nessuna richiesta è stata inviata a un ambiente. I comportamenti sono dedotti dal codice e dalle librerie installate.

---

## 7. Fonti esterne consultate

- Drizzle: [NVD CVE-2026-39356](https://nvd.nist.gov/vuln/detail/CVE-2026-39356), [Snyk SNYK-JS-DRIZZLEORM-16000009](https://security.snyk.io/vuln/SNYK-JS-DRIZZLEORM-16000009)
- Elysia: [GitLab advisory CVE-2026-56669](https://advisories.gitlab.com/npm/elysia/CVE-2026-56669/), [OSV GHSA-hxj9-33pp-j2cc](https://osv.dev/vulnerability/GHSA-hxj9-33pp-j2cc), [OSV GHSA-f45g-68q3-5w8x](https://osv.dev/vulnerability/GHSA-f45g-68q3-5w8x)
- React Router (npm audit): [GHSA-jjmj-jmhj-qwj2](https://github.com/advisories/GHSA-jjmj-jmhj-qwj2), [GHSA-wrjc-x8rr-h8h6](https://github.com/advisories/GHSA-wrjc-x8rr-h8h6), [GHSA-2j2x-hqr9-3h42](https://github.com/advisories/GHSA-2j2x-hqr9-3h42)
- yaml (npm audit): [GHSA-48c2-rrv3-qjmp](https://github.com/advisories/GHSA-48c2-rrv3-qjmp)

---

## 8. Note su questo documento

- Il file è l'unico creato dalla review. Nessun file dell'applicazione è stato modificato.
- Non sono stati riportati segreti, password, hash o token. Le credenziali demo del seed sono state indicate solo per nome dell'account, senza valore.
