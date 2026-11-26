# Software Requirements Specification (SRS) — Iscrizione team, quote, giuria e tema

**Document type:** SRS — formal commitment document
**Status:** Draft
**Version:** 0.2
**Author(s):** team documentazione
**Date:** 2026-11-26
**Sponsor / Product Owner:** [TODO: da validare con product owner]
**Related Pre-SRS:** nessuno (feature incrementali con requisiti chiari)

> Baseline di riferimento: commit `fb84f68` (backend) e `1fab600` (frontend), branch `feat/team-pricing-jury-theme`; la versione 0.2 estende la baseline fino al commit `8b58297`. Le voci `[TODO: …]` sono assunzioni di implementazione non ancora approvate.

---

## 1. Introduction

### 1.1 Purpose

Formalizza i requisiti delle feature incrementali della piattaforma di contest di miniature: team dichiarati nell'iscrizione, quote di iscrizione, voto per display, presidente di giuria con visibilità sezioni, ordine di premiazione, tema grafico e miglioramenti UX, permessi e iscrizione per conto di, guida in applicazione, suggerimenti sui pulsanti, navigazione laterale.

### 1.2 Scope

**In scope:**
- coautori inseriti insieme al modello e codice team;
- calcolo, visualizzazione e stampa della quota;
- voto del giudice sull'intero display;
- ruolo `jury_president` e matrice di visibilità sezioni;
- ordine di presentazione dei premi;
- tema predefinito `savino` e miglioramenti UX;
- permessi per ruolo e iscrizione di modelli per conto di altri;
- guida pop-up per pagina e scheda, pagina `/help`;
- suggerimento su ogni pulsante;
- navigazione laterale sinistra collassabile.

**Out of scope:**
- incasso online della quota calcolata e riconciliazione con `/payments`;
- anteprima del prezzo calcolata dal server prima del salvataggio;
- migrazione dei codici dei modelli team già esistenti;
- rigenerazione del PDF del manuale utente.

### 1.3 Stakeholders

| Role | Name | Responsibility |
|------|------|----------------|
| Sponsor | [TODO: da validare con product owner] | Finanziamento |
| Product Owner | [TODO: da validare con product owner] | Priorità, validazione assunzioni |
| Technical Lead | [TODO: da validare con product owner] | Architettura |
| Key business users | Organizzatori, giudici, presidente di giuria, partecipanti | Validazione di dominio |

### 1.4 References

- API: [`docs/api.md`](../api.md)
- Manuale utente: [`docs/user-manual.md`](../user-manual.md)
- Palette di riferimento: montesansavinoshow.com

### 1.5 Definitions and acronyms

| Term | Definition |
|------|------------|
| Display (vetrina) | Insieme dei modelli di uno stesso evento con lo stesso `displayNumber` |
| Coautore | Persona che ha collaborato a un modello team, con un ruolo a catalogo |
| Numero partecipante | Progressivo dell'utente (`users.seq_id`) |
| Quota base | Importo dovuto una volta per partecipante ed evento |
| Livello gratuito | Livello con `freeToEnter = true` (es. Juniores) |

---

## 2. Overall Description

### 2.1 Product perspective

Estensione dell'applicazione esistente (SPA React + API Elysia + PostgreSQL). Il flusso team separato (`teamId`) resta accettato per compatibilità, ma non è più richiesto.

### 2.2 User classes and personas

Gerarchia: `user < staff < judge < jury_president < manager < admin`.

| User class | Description | Primary goals |
|------------|-------------|---------------|
| user | Partecipante | Iscrivere modelli, conoscere e stampare la quota |
| staff | Segreteria | Check-in |
| judge | Giudice | Votare modelli e display assegnati |
| jury_president | Presidente di giuria | Seguire avanzamento e statistiche in sola lettura, oltre ai permessi di giudice |
| manager | Organizzatore | Catalogo prezzi, livelli, premi |
| admin | Amministratore | Quota base, visibilità, permessi, ordine premi, tema |

### 2.3 Operating environment

Web desktop e mobile, tema chiaro e scuro, interfaccia in italiano e inglese.

### 2.4 Design and implementation constraints

- Stack esistente: Bun, Elysia, Drizzle, PostgreSQL, React, MUI.
- Importi in **centesimi interi**, valuta `EUR`.
- Modifiche di schema additive, applicate da `ensureTenantSchema` senza perdita di dati.

### 2.5 Assumptions and dependencies

- Il numero partecipante esiste per ogni utente.
- I ruoli coautore e i livelli sono gestiti a catalogo.
- Il livello Juniores è gratuito solo se l'amministrazione attiva "Iscrizione gratuita" (o lo importa così da CSV).
- I livelli del concorso sono `Juniors`, `Standard`, `Masters`, `All`; i dati demo riportano le 33 classi reali del Monte San Savino Show (numeri 0–32) con `Juniors` gratuito.
- Confermato dal product owner (2026-11-26): un coautore è pagato **una sola volta**, in orizzontale su tutti i modelli a pagamento del partecipante nello stesso evento. La stessa persona è riconosciuta dall'email, altrimenti da nome + cognome (senza distinzione di maiuscole e spazi); se ha ruoli diversi si applica il prezzo di ruolo più alto.
- [TODO: da validare con product owner] I prezzi **non sono congelati** all'iscrizione: il totale è ricalcolato con i prezzi correnti a ogni lettura e stampa.
- [TODO: da validare con product owner] L'ordine di premiazione predefinito include `Highly Commended`: `Highly Commended, Bronze, Silver, Gold`.
- [TODO: da validare con product owner] Il presidente di giuria **può votare**, nei limiti delle assegnazioni giudice.
- [TODO: da validare con product owner] I modelli team **già esistenti** mantengono il codice precedente; il codice `<n>T<n>` è assegnato ai nuovi modelli team e a quelli che diventano team.
- [TODO: da validare con product owner] L'**anteprima prezzo** non usa un endpoint dedicato: mostra quota base, prezzi dei ruoli selezionati e totale attuale dell'evento, senza il totale previsto dopo il salvataggio.

---

## 3. System Architecture Overview

### 3.1 Logical architecture

- Regole pure di dominio (backend): codice team, prezzi, raggruppamento display, ordine premi, visibilità sezioni.
- Route HTTP e persistenza nei moduli `contest` e `identity` esistenti.
- La SPA mostra gli importi calcolati dal backend; la sola anteprima in iscrizione elenca le voci lato client.

### 3.2 Integration points

| System / Service | Direction | Protocol / Contract | Purpose |
|------------------|-----------|---------------------|---------|
| API backend | SPA → API | REST/JSON, vedi `docs/api.md` | Tutte le feature |
| Stampa iscrizione | API → browser | HTML print-on-load | Scheda con quota |

### 3.3 Data flow (conceptual)

Il partecipante salva modello e coautori; il server assegna il codice. La quota è derivata da modelli, livelli, ruoli e quota base al momento della richiesta. Voti, visibilità e ordine premi sono letti dai rispettivi endpoint.

### 3.4 Technology choices

Invariate. Nuovi dati: `models.team_code` (univoco), `model_team_members.role_id`, `member_roles.price`, chiavi di impostazione `baseFeeCents`, `sectionVisibility`, `prizeOrder`, `rolePermissions`; indice univoco sul nome del ruolo coautore. Guide viste e stato della barra laterale sono memorizzati nel browser.

### 3.5 Deployment topology (high level)

Invariata.

---

## 4. Requirements Model

> Contenuto standard di tutti gli SRS.

### 4.1 Business Requirements (BR-xxx)

Descrivono il *perché*: i risultati di business da ottenere.

### 4.2 Functional Requirements (FR-xxx)

Descrivono il *cosa*: capacità concrete, univoche, testabili e tracciate ad almeno un BR.

### 4.3 Non-Functional Requirements (NFR-xxx)

Descrivono il *quanto bene*: qualità misurabili con una soglia.

### 4.4 Business Requirements di questa iniziativa

| ID | Requirement |
|----|-------------|
| BR-001 | Iscrivere un lavoro di gruppo in un unico passaggio, riconoscibile dal codice. |
| BR-002 | Comunicare al partecipante una quota di iscrizione corretta e trasparente. |
| BR-003 | Ridurre il tempo di valutazione consentendo il voto per vetrina. |
| BR-004 | Dare al presidente di giuria il controllo dell'andamento senza permessi gestionali. |
| BR-005 | Adattare navigazione e cerimonia di premiazione alle scelte dell'organizzazione. |
| BR-006 | Allineare l'applicazione all'identità visiva della manifestazione e semplificarne l'uso. |
| BR-007 | Permettere all'organizzazione di iscrivere modelli per chi non può farlo da sé, mantenendo titolarità e quota in capo al partecipante. |
| BR-008 | Rendere ogni funzione comprensibile e raggiungibile senza formazione o assistenza. |

---

## 5. Core Modules — Epics, FRs, NFRs

### 5.1 Module — Iscrizione con team inline

**BR coverage:** BR-001

| ID | Requirement | Traces to | Priority |
|----|-------------|-----------|----------|
| FR-001 | Il sistema deve consentire di inserire, nella creazione e modifica del modello, un elenco di coautori con nome, cognome, ruolo a catalogo (`roleId`) ed email facoltativa, senza creare un team separato. | BR-001 | Must |
| FR-002 | Un nuovo modello team deve ricevere il codice `<numero partecipante>T<n>`, con `n` = massimo progressivo esistente tra i codici team del partecipante + 1 (es. `173T1`). | BR-001 | Must |
| FR-003 | Il codice team deve sostituire il codice individuale in elenchi, viste giudice, etichette, export e stampe. | BR-001 | Must |
| FR-004 | Un modello team senza coautori (e senza `teamId` legacy) deve essere rifiutato con 422 `TEAM_MEMBERS_REQUIRED`. | BR-001 | Must |
| FR-005 | Un ruolo coautore mancante o inesistente deve essere rifiutato con 422 `INVALID_MEMBER_ROLE`; il testo libero `role` resta accettato per i client precedenti. | BR-001 | Must |
| FR-006 | In modifica, `teamMembers` deve sostituire l'intero elenco; `isTeam:false` deve cancellare coautori e codice team. | BR-001 | Must |
| FR-007 | Il sistema deve rifiutare con 409 `MODEL_LIMIT` il 51° modello dello stesso partecipante nello stesso evento, anche tramite spostamento di categoria tra eventi. | BR-001, BR-002 | Must |

| ID | Requirement | Metric | Target |
|----|-------------|--------|--------|
| NFR-001 | Unicità del codice team | Duplicati in `models.team_code` | 0 (vincolo univoco) |
| NFR-002 | Compatibilità dei modelli esistenti | Modelli con `teamId` leggibili, modificabili e conteggiati nella quota | 100% |

**Dependencies:** catalogo ruoli, numero partecipante.

### 5.2 Module — Quote di iscrizione e stampa

**BR coverage:** BR-002

| ID | Requirement | Traces to | Priority |
|----|-------------|-----------|----------|
| FR-010 | La quota base (predefinita 2500 cent = 25 €) deve essere applicata una sola volta per partecipante ed evento, da 1 a 50 modelli, se almeno un modello è a pagamento. | BR-002 | Must |
| FR-011 | Ogni coautore distinto dei modelli a pagamento deve aggiungere una sola volta il prezzo del proprio ruolo (predefinito 1500 cent = 15 €), anche se compare in più modelli; con ruoli diversi vale il prezzo più alto. | BR-002 | Must |
| FR-012 | Un modello di livello gratuito (`freeToEnter`, es. Juniores) deve costare 0, coautori inclusi; con soli modelli gratuiti la quota base è 0. | BR-002 | Must |
| FR-013 | Il manager o superiore deve poter impostare il prezzo di ogni ruolo coautore (intero 0–1.000.000 cent) e contrassegnare un livello come gratuito. | BR-002 | Must |
| FR-014 | L'admin deve poter impostare la quota base; un valore non intero o negativo deve essere rifiutato con 422. | BR-002 | Must |
| FR-015 | Il partecipante deve vedere, per ogni evento, quota base, righe coautore, modelli gratuiti e totale. | BR-002 | Must |
| FR-016 | Il manager o superiore deve poter leggere via API i totali per iscritto ed evento, filtrabili per `eventId` e `userId`. | BR-002 | Should |
| FR-017 | La stampa dell'iscrizione deve includere il dettaglio della quota e il totale; con più eventi anche il totale generale. | BR-002 | Must |
| FR-018 | Prima di salvare, l'iscrizione deve mostrare un'anteprima indicativa: quota base (o "già inclusa"), prezzi dei coautori, totale attuale dell'evento; per un livello gratuito deve indicare la gratuità. [TODO: da validare con product owner] | BR-002 | Should |

| FR-019 | I nomi dei ruoli coautore devono essere univoci senza distinzione di maiuscole e spazi esterni; un duplicato è rifiutato con 409 e i duplicati preesistenti sono unificati all'avvio rimappando i coautori. | BR-002 | Must |

| ID | Requirement | Metric | Target |
|----|-------------|--------|--------|
| NFR-010 | Precisione monetaria | Aritmetica sugli importi | Solo interi in centesimi |
| NFR-011 | Fonte unica del totale | Totale mostrato in riepilogo e stampa a parità di dati | Identico, calcolato dal server |

**Dependencies:** 5.1; catalogo livelli e ruoli.

> [TODO: da validare con product owner] Le etichette della sezione quota nella stampa sono in inglese ("Registration fee", "Base fee", "Total").

### 5.3 Module — Voto per display

**BR coverage:** BR-003

| ID | Requirement | Traces to | Priority |
|----|-------------|-----------|----------|
| FR-020 | Il giudice deve poter elencare i display con i soli modelli nel proprio ambito; i modelli senza `displayNumber` sono esclusi. | BR-003 | Must |
| FR-021 | Il giudice deve poter assegnare un voto (0–4) a tutti i modelli del display nel proprio ambito con una sola azione. | BR-003 | Must |
| FR-022 | Il voto di display deve essere atomico e saltare i modelli di categorie chiuse, restituendone gli id. | BR-003 | Must |
| FR-023 | Il sistema deve rispondere 404 per un display inesistente, 403 se nessun modello è nell'ambito del giudice, 409 `CATEGORY_CLOSED` se tutte le categorie sono chiuse. | BR-003 | Must |
| FR-024 | Il voto corrente del display deve essere mostrato solo se identico per tutti i modelli. | BR-003 | Should |
| FR-025 | Il voto del singolo modello deve restare disponibile. | BR-003 | Must |

| ID | Requirement | Metric | Target |
|----|-------------|--------|--------|
| NFR-020 | Accessibilità da tastiera delle schede display | Apertura con Invio e Spazio | 100% delle schede |

**Dependencies:** assegnazioni giudici.

### 5.4 Module — Presidente di giuria e visibilità sezioni

**BR coverage:** BR-004, BR-005

| ID | Requirement | Traces to | Priority |
|----|-------------|-----------|----------|
| FR-030 | Il sistema deve offrire il ruolo `jury_president`, assegnabile dalla gestione utenti, tra `judge` e `manager`. | BR-004 | Must |
| FR-031 | Il presidente di giuria deve leggere monitoraggio giudici, elenco iscrizioni e statistiche, senza accesso alle operazioni di scrittura riservate al manager. | BR-004 | Must |
| FR-032 | L'admin deve poter configurare, per ogni ruolo diverso da `admin`, le sezioni visibili: `dashboard, stats, judge, podium, enrollments, models, labels, checkin, users, teams, settings, admin`. | BR-005 | Must |
| FR-033 | La visibilità deve solo restringere: non concede accesso oltre il ruolo minimo di ogni funzione. | BR-005 | Must |
| FR-034 | L'admin deve vedere sempre tutte le sezioni. | BR-005 | Must |
| FR-035 | Per il presidente di giuria, il server deve rispondere 403 `SECTION_HIDDEN` sugli endpoint delle sezioni `dashboard` e `stats` nascoste. | BR-004 | Must |
| FR-036 | Navigazione e rotte della SPA devono rispettare la matrice; se la matrice non è leggibile vale il comportamento basato sul ruolo. | BR-005 | Must |
| FR-037 | Un aggiornamento con ruolo o sezione sconosciuti deve essere rifiutato con 422. | BR-005 | Must |
| FR-038 | Un presidente di giuria deve poter essere assegnato alle categorie da giudicare dalla scheda Giudici. | BR-004 | Should |

Valori predefiniti: `user` = dashboard, models, enrollments, teams; `staff` = + checkin; `judge` = + judge; `jury_president` = + stats; `manager` = tutto tranne settings; `admin` = tutto.

| ID | Requirement | Metric | Target |
|----|-------------|--------|--------|
| NFR-030 | Autorizzazione applicata lato server | Endpoint protetti raggiungibili con ruolo insufficiente | 0 |

> Per i ruoli diversi da `jury_president` la matrice filtra solo l'interfaccia; i vincoli API restano quelli di ruolo.

**Dependencies:** modulo identity.

### 5.5 Module — Ordine di premiazione

**BR coverage:** BR-005

| ID | Requirement | Traces to | Priority |
|----|-------------|-----------|----------|
| FR-040 | L'admin deve poter riordinare le medaglie; il primo elemento è presentato per primo. | BR-005 | Must |
| FR-041 | La cerimonia deve rivelare i vincitori di ogni categoria secondo l'ordine configurato. | BR-005 | Must |
| FR-042 | In assenza di configurazione valida deve valere `Highly Commended, Bronze, Silver, Gold`. [TODO: da validare con product owner] | BR-005 | Must |
| FR-043 | Le etichette medaglia non in elenco devono essere presentate prima, in ordine di `medalRank`. | BR-005 | Should |

**Dependencies:** assegnazione premi.

### 5.6 Module — Tema e UX

**BR coverage:** BR-006

| ID | Requirement | Traces to | Priority |
|----|-------------|-----------|----------|
| FR-050 | Il tema predefinito deve essere `savino` (primario `#A1403F` in chiaro, `#E8908F` in scuro), derivato dalla palette di montesansavinoshow.com. | BR-006 | Must |
| FR-051 | I preset `violet`, `ocean`, `forest`, `mss` devono restare selezionabili; un valore già salvato non deve essere sovrascritto. | BR-006 | Must |
| FR-052 | La nuova iscrizione deve essere a quattro step (Dati, Modello, Coautori, Riepilogo); non si avanza con dati obbligatori mancanti. | BR-006, BR-001 | Must |
| FR-053 | Dopo l'iscrizione il sistema deve mostrare il codice assegnato. | BR-006 | Must |
| FR-054 | Su mobile la barra inferiore deve contenere al massimo cinque destinazioni, scelte per ruolo (le altre nel pannello laterale, FR-093). | BR-006 | Should |
| FR-055 | La voce "Team" non deve più comparire nel menu. | BR-006, BR-001 | Should |

| ID | Requirement | Metric | Target |
|----|-------------|--------|--------|
| NFR-050 | Contrasto del tema `savino`, chiaro e scuro | Rapporto di contrasto del testo (WCAG 2.1) | ≥ 4,5:1 |
| NFR-051 | Pulsanti a sola icona della navigazione e dei coautori | Presenza di nome accessibile | 100% |

**Dependencies:** impostazione `themePreset`.

### 5.7 Module — Permessi e iscrizione per conto di

**BR coverage:** BR-007

| ID | Requirement | Traces to | Priority |
|----|-------------|-----------|----------|
| FR-060 | Il sistema deve gestire permessi per ruolo, distinti da gerarchia e visibilità; il primo è `enrollOnBehalf`, predefinito per `manager`. `admin` ha sempre tutti i permessi. | BR-007 | Must |
| FR-061 | L'admin deve poter concedere e revocare i permessi dalla scheda Regole, insieme alla visibilità sezioni. | BR-007 | Must |
| FR-062 | Chi ha il permesso deve poter cercare i soli utenti attivi per email, nome e cognome (in entrambi gli ordini) o numero partecipante. | BR-007 | Must |
| FR-063 | Chi ha il permesso deve poter creare un modello indicando il titolare; modello, codici, numero display, limite di 50 modelli e quota spettano al titolare. | BR-007 | Must |
| FR-064 | La richiesta senza permesso deve essere rifiutata con 403 `PERMISSION_DENIED`; un titolare inesistente o disattivato con 404 `USER_NOT_FOUND`. | BR-007 | Must |
| FR-065 | Chi ha il permesso deve poter iscrivere a un evento il modello di un altro; l'iscrizione è intestata al titolare. | BR-007 | Should |
| FR-066 | Il permesso non deve superare la chiusura delle iscrizioni: solo `manager` e `admin` la ignorano. [TODO: da validare con product owner] | BR-007 | Must |
| FR-067 | La procedura guidata deve mostrare il campo "Iscrivi per conto di" solo a chi ha il permesso, con "Me stesso" predefinito, e nel riepilogo deve dichiarare il titolare senza mostrarne il totale già dovuto. | BR-007 | Must |

| ID | Requirement | Metric | Target |
|----|-------------|--------|--------|
| NFR-060 | Autorizzazione del permesso applicata lato server | Operazioni per conto di altri riuscite senza permesso | 0 |

**Limiti noti**

- [TODO: da validare con product owner] Un ruolo inferiore a `manager` con il permesso non può modificare né cancellare il modello creato per altri, caricarne le foto, né vederlo nel proprio elenco.
- [TODO: da validare con product owner] A iscrizioni chiuse possono operare solo `manager` e `admin`.
- [TODO: da validare con product owner] `DELETE /admin/models/:id` non rimuove i coautori e le immagini del modello.
- [TODO: da validare con product owner] L'interfaccia offre l'iscrizione per conto di solo alla creazione del modello; l'iscrizione all'evento del modello altrui è disponibile solo via API.

**Dependencies:** modulo identity; 5.1; 5.2.

### 5.8 Module — Guida pop-up e pagina Guida

**BR coverage:** BR-008

| ID | Requirement | Traces to | Priority |
|----|-------------|-----------|----------|
| FR-070 | Ogni pagina e scheda dell'applicazione deve avere una guida passo per passo (26 guide alla baseline). | BR-008 | Must |
| FR-071 | La guida deve avviarsi da sola alla prima visita, una sola volta per browser, e mai sopra una finestra, un menu o un pannello aperto. | BR-008 | Must |
| FR-072 | Il pulsante "?" deve avviare in ogni momento la guida di ciò che è visibile; il menu account deve permettere di riattivare tutte le guide. | BR-008 | Must |
| FR-073 | La guida deve offrire Salta, Indietro, Avanti, Fine, supportare frecce ed Esc e omettere i passi il cui elemento non è visibile. | BR-008 | Must |
| FR-074 | Guide e passi devono rispettare ruolo, sezioni visibili e permessi. | BR-008 | Must |
| FR-075 | La pagina `/help` deve elencare, dalle stesse definizioni delle guide, le funzioni disponibili con descrizione, destinatari, passi e pulsante di avvio; è accessibile anche senza accesso. | BR-008 | Must |

| ID | Requirement | Metric | Target |
|----|-------------|--------|--------|
| NFR-070 | Accessibilità della guida | Fumetto modale con titolo e testo associati, focus intrappolato e restituito alla chiusura | 100% dei passi |
| NFR-071 | Disattivazione dell'avvio automatico per i test | Chiave `guidedTours.disabled` = `true` | Nessuna guida avviata da sola |

- [TODO: da validare con product owner] Lo stato "guida già vista" è per browser, non per account.

**Dependencies:** 5.4; 5.7.

### 5.9 Module — Suggerimenti sui pulsanti

**BR coverage:** BR-008

| ID | Requirement | Traces to | Priority |
|----|-------------|-----------|----------|
| FR-080 | Ogni pulsante, pulsante a icona e voce di menu d'azione deve avere un suggerimento che descrive l'effetto, non la ripetizione dell'etichetta. È un requisito obbligatorio anche per i pulsanti futuri. | BR-008 | Must |
| FR-081 | Il suggerimento deve comparire anche sui pulsanti disattivati. | BR-008 | Must |

| ID | Requirement | Metric | Target |
|----|-------------|--------|--------|
| NFR-080 | Copertura dei suggerimenti, verificata dal test `tooltipCoverage` | Pulsanti senza suggerimento | 0 |
| NFR-081 | Il suggerimento è esposto come descrizione accessibile senza sostituire il nome | Pulsanti coperti da FR-080 | 100% |
| NFR-082 | Le stringhe dei suggerimenti esistono in italiano e inglese | Chiavi mancanti | 0 |

- [TODO: da validare con product owner] Schede (tab), interruttori, caselle e voci della barra inferiore non rientrano nella regola automatica.

### 5.10 Module — Navigazione laterale

**BR coverage:** BR-008, BR-006

| ID | Requirement | Traces to | Priority |
|----|-------------|-----------|----------|
| FR-090 | Su desktop la navigazione deve essere una barra laterale **a sinistra** con icona e nome di ogni sezione disponibile, evidenziando quella attiva. | BR-008 | Must |
| FR-091 | La barra deve essere collassabile a sole icone, con il nome nel suggerimento, ed espandibile. | BR-008 | Must |
| FR-092 | Lo stato compresso o espanso deve essere ricordato nel browser. | BR-008 | Should |
| FR-093 | Su schermi stretti le sezioni devono essere in un pannello che si apre da sinistra con il pulsante menu. | BR-008 | Must |

| ID | Requirement | Metric | Target |
|----|-------------|--------|--------|
| NFR-090 | Accessibilità della barra | Landmark di navigazione, `aria-current`, `aria-expanded` sul comando di compressione | Presenti |

---

## 6. Cross-Cutting Non-Functional Requirements

### 6.1 Security and data protection

| ID | Requirement | Metric / Acceptance |
|----|-------------|---------------------|
| NFR-100 | Un partecipante legge solo le proprie quote. | `/pricing/me` non restituisce dati di altri utenti; `/admin/pricing` richiede manager |
| NFR-101 | Il giudice vota solo nel proprio ambito. | Voti fuori assegnazione = 0 |
| NFR-102 | Le operazioni per conto di altri sono tracciate nei log. | Creazioni e iscrizioni per altri con autore, ruolo, titolare e modello = 100% |
| NFR-103 | L'elenco iscrivibili espone solo i dati necessari. | Campi: id, email, nome, cognome, numero partecipante |

### 6.6 Internationalization / localization

| ID | Requirement | Metric / Acceptance |
|----|-------------|---------------------|
| NFR-150 | Le nuove stringhe della SPA esistono in italiano e inglese. | Chiavi mancanti = 0 |

---

## 8. Acceptance Criteria & Readiness

### 8.1 Acceptance criteria

| Caso | Atteso |
|------|--------|
| 3 modelli individuali a pagamento, stesso evento | Totale 25 € |
| 1 modello team con 2 coautori a 15 € | Totale 55 € |
| Solo modelli Juniores/gratuiti | Totale 0 € |
| Primo modello team del partecipante 173 | Codice `173T1` |
| Voto 3 su display con una categoria chiusa e una aperta | Voto sul modello aperto; l'altro in `skippedClosedModelIds` |
| Presidente di giuria con `stats` nascosta | 403 `SECTION_HIDDEN` |
| Stesso coautore su 2 modelli team | Totale 40 € |
| Utente senza permesso invia `userId` altrui | 403 `PERMISSION_DENIED` |
| Manager iscrive per il partecipante 173 il suo primo modello team | Codice `173T1`, quota del partecipante 173 |
| Prima visita a una pagina, poi seconda visita | La guida parte solo la prima volta |
| Barra compressa e pagina ricaricata | Resta compressa |

### 8.2 Definition of Done

- [ ] FR Must implementati e testati
- [ ] NFR misurati
- [ ] `docs/api.md` e `docs/user-manual.md` aggiornati
- [ ] Assunzioni `[TODO]` validate dal product owner
- [ ] Revisione di sicurezza completata

---

## Change log

| Version | Date | Author | Change |
|--------:|------------|--------|--------|
| 0.1 | 2026-11-26 | team documentazione | Prima stesura |
| 0.2 | 2026-11-26 | team documentazione | BR-007/008; FR-019, FR-060–067, FR-070–075, FR-080–081, FR-090–093; NFR-060, 070–071, 080–082, 090, 102–103; FR-038 risolto |
