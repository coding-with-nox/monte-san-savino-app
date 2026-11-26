# Confronto con Emperor (MSS 2026) e piano di adeguamento

- Data: 2026-11-26
- Fonti Emperor: menu e impostazioni reali di mss26.myemperor.app (sola lettura), *Emperor Event Organisation Software User Guide* (44 pp.), *Emperor Show Running Checklist* (23 pp.).
- Fonte nostra app: [feature-map.md](feature-map.md).
- Nessun dato personale degli iscritti è stato copiato.

## Configurazione reale MSS 2026 su Emperor

| Impostazione | Valore |
|---|---|
| Voti per esposizione (giudici per classe) | 3 |
| Differenza massima tra voti (Voting Delta) | 2 |
| Medaglie (valore voto → fascia sulla somma) | Nothing 0 · Commended 1 (1–4) · Bronze 2 (5–7) · Silver 3 (8–10) · Gold 4 (11–12) |
| Medaglie "hardware" da | 2 (Bronzo) |
| Voto su singolo modello o intera vetrina | Sì |
| Livello | scelto per ogni modello (Level On Model Registration) |
| Supplemento per iscrizione di squadra | 10 € |
| Premi speciali | 28, assegnati a mano (Best of Show, Best of Painter, Platinum, trofei sponsor…) |
| Pagamenti online | disattivati (provider None) |
| Registro presenze | disattivato |
| Anti-bot registrazione | Cloudflare Turnstile |
| Lingue | en (default), it, nl, pl |
| Prefisso etichette | M |
| Stampante etichette | Dymo 550, etichette 13×25 mm |

## Differenze funzionali

Legenda: ✅ c'è · 🟡 parziale · ❌ manca

| Area | Emperor | Noi | Stato |
|---|---|---|---|
| **Giudizio: regole** | N voti per esposizione; se una classe ha meno giudici, media × N; segnala disaccordo oltre il delta | Somma dei voti dei giudici assegnati; `maxVotesPerExhibitor` e `maxVoteDifferent` salvati ma non usati | 🟡 |
| **Giudizio: fase 2** | Dopo "Judging complete" di tutti, schermata errori per riconciliare i voti discordanti | Assente | ❌ |
| **Giudizio: schermata** | Riquadri anonimi per numero espositore, lista "a scalare" (sparisce ciò che è giudicato) + "mostra tutti"; voto a vetrina o a singolo pezzo | Vetrine per numero display, voto vetrina o singolo, nome modello visibile | 🟡 |
| **Giudice in gara** | Non può giudicare la propria opera; giudice sostituto "Is standing in" che vede solo le vetrine dei colleghi | Assente | ❌ |
| **Accesso giudici** | QR personale per giudice × classe, apre direttamente la schermata; disattivato alla chiusura | Login; QR stampabili ma nessuna schermata li legge | 🟡 |
| **Chiusura classe** | L'admin chiude; ciò che non è giudicato riceve "Nothing"; comando "assegna Nothing ai non giudicati" | Chiusura solo se ogni giudice ha votato ogni modello | 🟡 |
| **Override medaglie** | Dopo la chiusura, righe con errori evidenziate e override del capo giuria | Correzione premio senza validazione né evidenza errori | 🟡 |
| **Medaglie configurabili** | Valore voto, testo per i giudici, soglia minima e massima | Fasce per evento (punteggio → medaglia) | 🟡 da verificare |
| **Premi speciali** | Catalogo premi; ognuno assegnabile una sola volta a espositore + pezzo o vetrina intera; lista premiazione stampabile | Menzioni libere (titolo, descrizione), non nel podio | 🟡 |
| **Premiazione** | Liste medaglie per classe e premi speciali stampabili; generatore PowerPoint con ordine drag & drop | Podio a schermo; classi non ordinate da `presentationOrder` | 🟡 |
| **Contest admin** | Segna modello mancante; sposta modello di classe (senza vincoli); azzera voti dell'espositore se cambia | Cambio categoria con invalidazione voti; nessun "mancante" | 🟡 |
| **Registro presenze** | Desk segna presente per numero espositore; i giudici vedono solo i presenti | Flag assente manuale senza effetti; check-in digitando l'UUID | 🟡 |
| **Stampe evento** | Per intervallo di espositori: etichette Dymo, liste modelli, etichette buste DL; statistiche materiale; per utente; per classe | Etichette (Dymo/HTML/XLSX) per evento e classe; scheda modelli | 🟡 |
| **Lista fotografi** | Modelli premiati sopra soglia, PDF/Excel; catalogo completo Excel | Assente | ❌ |
| **Statistiche** | Utenti totali, per paese, modelli per utente e per classe, medaglie, commended, riepilogo premi, utenti senza modelli, live stats a riquadri con aggiornamento automatico | Gran parte presente; mancano riepilogo premi speciali, utenti senza modelli, live con aggiornamento | 🟡 |
| **Import** | CSV medaglie, livelli, classi, giurie, risultati anno precedente (report "deve passare a Masters") | CSV livelli e classi | 🟡 |
| **Regole livello** | Modalità: libera / livello per categoria all'inizio / livello per modello; blocco al primo livello; avviso level-up | Livello per modello, senza vincoli | 🟡 |
| **Iscrizioni** | Apertura/chiusura manuale (Open / Openday / Closed); pagina pubblica di default = registrazione nel giorno dell'evento | Campagne con data di chiusura (apertura non applicata) | 🟡 |
| **Password dimenticata** | Self-service | Solo reset da manager | ❌ |
| **Anti-bot** | Turnstile / reCAPTCHA | Rate limit | 🟡 |
| **Socials pubblici** | Ricerca pubblica per numero vetrina dopo la chiusura di tutte le classi, solo per chi ha dato il consenso | `publicProfile` senza effetto | ❌ |
| **Lingue** | en, it, nl, pl | it, en | 🟡 |
| **Username** | Username oltre all'email | Solo email | ❌ |
| **Pagamenti online** | PayPal / Mollie (spenti per MSS) | Calcolo quota, nessun incasso né stato "pagato" | 🟡 |

Dove siamo già avanti: anagrafica completa, contatto di emergenza, privacy GDPR registrata, coautori con ruoli e prezzo, quota calcolata con categorie gratuite, iscrizione per conto di altri con permesso, visibilità sezioni per ruolo, guida pop-up e tooltip, tema MSS, stampe localizzate.

## Piano per passi

Ogni passo: ramo dedicato → sviluppo con gli agenti → test automatici → mia verifica nel browser → **tua verifica e approvazione** → PR. Si passa al successivo solo dopo il tuo OK.

| # | Passo | Contenuto | Dipende da |
|---|---|---|---|
| 1 | **Regole di giudizio MSS** | Applicare `voti per esposizione` e `delta` dalle impostazioni; media × N se la classe ha meno giudici; editor medaglie con valore voto, testo per giudici, soglie min/max (precaricato con i valori MSS); chiusura da admin con "Nothing" automatico ai non giudicati | — |
| 2 | **Schermata giudice e fase 2** | Riquadri anonimi per numero espositore, lista a scalare + "mostra tutti"; voto vetrina o pezzo; "Giudizio completato" e schermata di riconciliazione degli errori; il giudice non vede né vota le proprie opere; giudice sostituto | 1 |
| 3 | **Sessione giudici di un giorno** | I giudici entrano con login (niente QR senza password); la loro sessione dura una giornata senza nuovi accessi; PDF unico con le istruzioni di accesso per giudice e classi assegnate | 2 |
| 4 | **Override e contest admin** | Dopo la chiusura: righe con errori evidenziate e override del capo giuria; segna modello mancante; sposta di classe; "assegna Nothing" per classe | 1 |
| 5 | **Premi speciali e premiazione** | Catalogo premi (precaricato con i 28 di MSS), assegnazione unica a espositore + pezzo o vetrina; liste premiazione medaglie per classe e premi speciali stampabili; podio ordinato per `presentationOrder` con premi speciali | 1 |
| 6 | **Desk e stampe** | Registro presenze per numero espositore (opzionale da impostazioni: i giudici vedono solo i presenti); stampe per intervallo di espositori (etichette Dymo, liste modelli, etichette buste DL) con conteggio materiale; stampe per singolo utente; lista fotografi e catalogo completo | — |
| 7 | **Statistiche e live** | Riepilogo premi speciali, utenti senza modelli, live stats per classe con aggiornamento automatico | 1, 5 |
| 8 | **Iscrizioni e regole livello** | Apertura/chiusura manuale delle iscrizioni (anche "openday"); pagina pubblica di default configurabile; modalità livello e blocco al primo livello; import risultati anno precedente con avviso level-up | — |
| 9 | **Account** | Username (oltre all'email, utilizzabile per l'accesso); password dimenticata self-service via email; anti-bot (Turnstile) sulla registrazione; ricerca pubblica "socials" dopo la chiusura di tutte le classi, con consenso | — |
| 10 | **Import CSV** | Medaglie, premi speciali, assegnazioni giuria | 1, 5 |
| 11 | **Lingue** | Aggiunta di spagnolo, francese e tedesco (interfaccia e stampe); per ogni altra lingua del browser si usa l'inglese | — |

## Decisioni del product owner (2026-11-26)

- Piano approvato; si procede un passo alla volta con verifica e approvazione.
- Giudici: login, sessione valida una giornata (non QR senza password).
- Lingue: aggiungere spagnolo, francese, tedesco; per le altre lingue inglese. Olandese e polacco no.
- Username: sì (passo 9).
- Pagamenti online (Mollie/PayPal): tema registrato, **in pausa**.
- Export PowerPoint: scartato, la premiazione si fa con l'app (podio).
