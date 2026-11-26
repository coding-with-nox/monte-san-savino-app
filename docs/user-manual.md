# Manuale utente — Monte San Savino Show

Applicazione per iscrivere le miniature al concorso, valutarle e premiarle.

## Indice
- [1. Ruoli](#1-ruoli)
- [2. Comandi comuni](#2-comandi-comuni)
- [3. Pagine aperte a tutti](#3-pagine-aperte-a-tutti)
- [4. Utente (partecipante)](#4-utente-partecipante)
- [5. Staff](#5-staff)
- [6. Giudice](#6-giudice)
- [7. Presidente di giuria](#7-presidente-di-giuria)
- [8. Manager](#8-manager)
- [9. Amministratore](#9-amministratore)
- [10. Classi, livelli e quote](#10-classi-livelli-e-quote)
- [11. API](#11-api)

---

## 1. Ruoli

Gerarchia: **Utente < Staff < Giudice < Presidente di giuria < Manager < Admin**.
Ogni ruolo può fare anche quello che fanno i ruoli precedenti, salvo le sezioni
che l'amministratore ha nascosto e i **permessi**, che si concedono a parte.

| Pagina | Percorso | Da quale ruolo |
|---|---|---|
| Accesso | `/login` | tutti |
| Eventi pubblici | `/public-events` | tutti, anche senza accesso |
| Guida | `/help` | tutti, anche senza accesso |
| Home, Profilo, Team | `/`, `/profile`, `/teams` | Utente |
| Modelli, Iscrizioni | `/models`, `/enrollments` | Utente |
| Check-in | `/staff-checkin` | Staff |
| Giudice | `/judge` | Giudice |
| Statistiche | `/stats` | Presidente di giuria |
| Utenti, Amministratore, Etichette, Premiazione | `/users`, `/admin`, `/labels`, `/podium` | Manager |
| Impostazioni, scheda Regole | `/settings`, `/admin?tab=rules` | Admin |

---

## 2. Comandi comuni

### Barra laterale (computer)
La navigazione è in una barra a **sinistra**, con un'icona per ogni sezione.
- La freccia in alto la **comprime** (solo icone, il nome compare passandoci sopra) o la **espande**.
- La scelta viene ricordata sul dispositivo.
- La sezione in cui ti trovi è evidenziata.
- Compaiono solo le sezioni disponibili per il tuo ruolo.

### Telefono e schermi stretti
- Il pulsante **menu** in alto a sinistra apre il pannello laterale sinistro con tutte le sezioni e il **Logout**.
- La barra in basso (solo dopo l'accesso) mostra fino a cinque destinazioni scelte in base al ruolo.

### Barra in alto
| Comando | Cosa fa |
|---|---|
| Bandiera | Lingua italiana o inglese |
| **?** | Avvia la guida della pagina in cui sei |
| Sole / luna | Tema chiaro o scuro su questo dispositivo |
| Cerchio con l'iniziale | Menu account: **Profilo**, **Riattiva le guide**, **Logout** |

### Guide pop-up
- La **prima volta** che apri una pagina o una scheda, la guida parte da sola ed evidenzia i comandi passo per passo.
- Pulsanti: **Salta**, **Indietro**, **Avanti**, **Fine**. Da tastiera: frecce sinistra e destra, **Esc** per chiudere.
- Una guida già aperta non riparte da sola, anche se l'hai saltata. Premi **?** per rivederla.
- Menu account → **Riattiva le guide**: tutte ripartono da sole alla visita successiva.
- La memoria delle guide viste è **per dispositivo e browser**, non per account.
- La guida non parte mentre è aperta una finestra o un menu. I passi riferiti a elementi non presenti vengono saltati.

### Pagina Guida
Voce **Guida** nel menu. Elenca, in base a ruolo, sezioni visibili e permessi:
nome della funzione, a cosa serve, chi la vede e i passi. **Avvia la guida** apre
la pagina corrispondente e fa partire la visita.

### Suggerimenti sui pulsanti
Ogni pulsante ha un **suggerimento** che spiega cosa succede premendolo: passa il
mouse sopra o raggiungilo con il tasto Tab (su telefono: tieni premuto). Il
suggerimento compare anche sui pulsanti disattivati.

### Messaggi e conferme
- L'esito di un'azione compare in un avviso a scomparsa.
- Molte eliminazioni chiedono conferma (**Conferma** / **Annulla**). L'eliminazione di un team è immediata.
- "Servizio non disponibile": il server non risponde; premi **Riprova**.
- Se la sessione scade torni alla pagina di accesso.

### Errori comuni
| Problema | Cosa fare |
|---|---|
| Una voce di menu non c'è | Il ruolo non la prevede o l'amministratore l'ha nascosta |
| Aprendo un indirizzo torni alla Home | Non hai il ruolo o la sezione richiesta |
| La guida non parte | È già stata vista: premi **?** o usa **Riattiva le guide** |

---

## 3. Pagine aperte a tutti

### 3.1 Accesso
**A cosa serve:** entrare o creare un account. **Chi la vede:** tutti.

1. Scrivi email e password.
2. Premi **Login**, oppure **Crea account** se è il primo accesso (password di almeno 8 caratteri): entri subito.
3. Arrivi alla Home.

| Pulsante | Cosa fa |
|---|---|
| **Login** | Accede con le credenziali inserite |
| **Crea account** | Registra un account con ruolo Utente e accede |

**Errori comuni:** formato email non valido; credenziali errate; email già
registrata; password troppo corta; account disattivato.

### 3.2 Eventi pubblici
**A cosa serve:** consultare gli eventi in programma con date e stato. **Chi la vede:** tutti.

| Pulsante | Cosa fa |
|---|---|
| **Aggiorna** | Rilegge l'elenco dal server |

**Errori comuni:** elenco vuoto = non ci sono eventi pubblici al momento.

### 3.3 Guida e comandi comuni
**A cosa serve:** documentazione dentro l'applicazione (vedi [Comandi comuni](#2-comandi-comuni)). **Chi la vede:** tutti.

1. Apri **Guida** dal menu.
2. Cerca la funzione e leggi i passi.
3. Premi **Avvia la guida**.

**Errori comuni:** una funzione non è elencata = il tuo ruolo o i tuoi permessi non la includono.

---

## 4. Utente (partecipante)

### 4.1 Home
**A cosa serve:** riepilogo di ciò che ti riguarda. **Chi la vede:** tutti dopo l'accesso, con contenuto diverso per ruolo.

| Ruolo | Contenuto |
|---|---|
| Utente, Staff | **I miei modelli** (i primi sei con codice), **Le mie iscrizioni** (con stato check-in) |
| Giudice | Categorie ancora da votare, con conteggio |
| Presidente di giuria, Manager, Admin | Andamento dell'evento (sezioni 7.1 e 8.1) |

| Pulsante | Cosa fa |
|---|---|
| **Gestisci modelli** | Apre i Modelli |
| **Gestisci iscrizioni** | Apre le Iscrizioni |
| **Apri check-in staff** | Apre il Check-in (da Staff) |

**Errori comuni:** "Alcuni dati non sono disponibili" = ricarica la pagina.

### 4.2 Modelli
**A cosa serve:** iscrivere, modificare, stampare ed eliminare i propri modelli. **Chi la vede:** da Utente.

1. **Iscrivi modello** avvia la procedura guidata (4.3).
2. Clicca una riga (o la matita) per modificare nome, categoria, livello, coautori, note e foto.
3. Premi **Salva modifiche**.

| Pulsante | Cosa fa |
|---|---|
| **Iscrivi modello** | Apre la procedura guidata; disattivato se hai raggiunto il limite configurato e non hai il permesso di iscrivere per altri |
| **Stampa scheda** | Scheda stampabile con tutti i modelli e il totale |
| Matita | Apre il dettaglio |
| Cestino | Elimina il modello, dopo conferma |
| **Salva modifiche** | Salva e aggiorna la quota |
| Icone di stampa nel dettaglio | Elenco, foglio etichette, etichetta DYMO |
| **Carica da file** / **Scatta foto** | Allegano una foto (solo se le immagini sono attive) |
| Cestino accanto a una foto | La elimina, dopo conferma |

**Note:** il campo **Note** è visibile a te, ai giudici e ai manager. Le **Note
interne** sono solo di manager e admin.

**Errori comuni**
- Iscrizioni chiuse: dopo la data di chiusura solo manager e admin creano o modificano.
- Cambiare **categoria** cancella i voti già dati al modello (viene chiesta conferma).
- Limite di 50 modelli per partecipante ed evento.
- Foto rifiutata: usa JPEG, PNG o WebP.

### 4.3 Iscrizione di un modello
**A cosa serve:** procedura guidata in quattro passi. **Chi la vede:** da Utente.

1. **Dati:** categoria (solo quelle aperte) e livello. Con il permesso, anche **Iscrivi per conto di**.
2. **Modello:** nome ed eventuali note.
3. **Coautori:** per un lavoro di gruppo attiva **Modello in team**; per ogni coautore inserisci nome, cognome, ruolo ed email (facoltativa). Non serve creare prima un team.
4. **Riepilogo:** controlla dati e **Anteprima quota**, poi **Iscrivi modello**.

| Pulsante | Cosa fa |
|---|---|
| **Avanti** | Passo successivo; si attiva quando il passo è completo |
| **Indietro** | Torna al passo precedente senza perdere i dati |
| **Aggiungi coautore** | Aggiunge una riga: la quota può aumentare |
| Cestino sul coautore | Toglie la riga |
| **Iscrivi modello** | Salva, genera il codice e calcola la quota |
| X | Chiude la procedura senza salvare |

Al salvataggio compare il **codice** assegnato. I modelli in team hanno il codice
`<numero partecipante>T<progressivo>` (es. `173T1`).

**Errori comuni:** **Avanti** disattivato = manca un campo obbligatorio o l'email
di un coautore non è valida; "Iscrizioni chiuse"; limite modelli raggiunto.

### 4.4 Iscrizione per conto di un'altra persona
**A cosa serve:** registrare il modello di un altro partecipante. **Chi la vede:**
chi ha il permesso **Iscrivere modelli per conto di altri** (di base Manager e
Admin; l'amministratore può estenderlo, vedi 9.2).

1. Avvia **Iscrivi modello**.
2. Nel passo **Dati**, campo **Iscrivi per conto di**: cerca per nome, email o numero partecipante e scegli il titolare. **Me stesso** è il valore iniziale.
3. Completa i passi. Nel riepilogo un avviso indica a chi saranno intestati modello e quota.
4. Premi **Iscrivi modello**.

Cosa cambia:
- modello, codice, numero display, limite e quota sono del **titolare**;
- il modello appare nell'elenco del titolare, **non nel tuo**;
- l'anteprima non mostra il totale già dovuto dal titolare;
- le iscrizioni chiuse si applicano comunque: solo manager e admin le superano.

**Limiti noti:** un ruolo inferiore a Manager che ha il permesso non può poi
modificare o eliminare il modello creato, né aggiungere foto, né rivederlo nel
proprio elenco.

**Errori comuni:** "Nessun partecipante trovato" (gli account disattivati non
compaiono); permesso non concesso.

### 4.5 Iscrizioni
**A cosa serve:** iscriversi agli eventi, controllare quote e stato. **Chi la vede:** da Utente.

1. Premi **Iscriviti**.
2. Scegli evento e, se vuoi, modello e categoria.
3. Conferma con **Iscriviti** nel pannello.
4. Controlla **Riepilogo quota** e l'elenco (eventi attivi e passati).

| Pulsante | Cosa fa |
|---|---|
| **Iscriviti** | Apre il modulo / invia l'iscrizione |
| **Export mie iscrizioni** | Scarica un file Excel |
| **Stampa iscrizione** | Scheda con modelli, dettaglio quota e totale |

**Errori comuni:** iscrizione già presente per lo stesso evento e modello;
categoria di un altro evento o non coerente con il modello; evento o categoria
chiusi; periodo di iscrizione terminato.

### 4.6 Team
**A cosa serve:** gestire team salvati e i loro membri. È la modalità precedente:
oggi i coautori si inseriscono direttamente nel modello (4.3). **Chi la vede:** da
Utente. La pagina non è nel menu: si apre dalla **Guida** o da `/teams`.

1. **Nuovo team** (pulsante in alto).
2. Indica nome, categoria e membri (nome, cognome, ruolo).
3. Premi **Salva team**.

| Pulsante | Cosa fa |
|---|---|
| **Aggiungi membro** | Aggiunge all'elenco; vale quando salvi |
| Cestino sul membro | Lo toglie; vale quando salvi |
| **Salva team** | Salva nome, categoria e membri |
| Matita / cestino sul team | Modifica / elimina subito (non annullabile) |

**Errori comuni:** pulsante di salvataggio disattivato = mancano nome o
categoria. Il campo nome è bloccato se il nome è impostato su **Auto** (9.6).

### 4.7 Profilo
**A cosa serve:** dati personali, contatti, social. **Chi la vede:** da Utente (menu account → **Profilo**).

1. Premi **Modifica**.
2. Aggiorna dati, paese, contatti e link (Instagram, Facebook, sito e altri).
3. Scegli **Mostra i miei dati al pubblico** se vuoi un profilo pubblico.
4. **Salva** oppure **Annulla**.

**Errori comuni:** numero di telefono non valido; i link devono iniziare con `http` o `https`.

---

## 5. Staff

### 5.1 Check-in
**A cosa serve:** registrare gli arrivi e stampare i badge. **Chi la vede:** da Staff.

1. Scrivi o incolla l'**ID iscrizione**.
2. Premi **Check-in**.
3. Se serve, **Stampa badge** (reinserisci l'ID: il campo si svuota dopo il check-in).

| Pulsante | Cosa fa |
|---|---|
| **Check-in** | Segna l'iscrizione come presente |
| **Stampa badge** | Apre il badge con QR, pronto da stampare |

**Errori comuni:** "Inserisci l'ID iscrizione"; iscrizione non trovata; badge non disponibile.

---

## 6. Giudice

La Home elenca le categorie da votare; **Vai al giudizio** apre la pagina Giudice.

### 6.1 Giudice (vetrine)
**A cosa serve:** scegliere cosa valutare. **Chi la vede:** da Giudice; si vedono solo le categorie assegnate.

Un **display** (vetrina) raccoglie i modelli con lo stesso numero di display nell'evento.

1. Scegli **evento** e, se vuoi, **categoria**.
2. Filtra per numero di display; **Mostra anche già votati** include le vetrine complete.
3. Premi un riquadro per votare. Il colore indica il voto dato.
4. Votato tutto in una categoria, premi **Giudizio Completato**.

| Pulsante | Cosa fa |
|---|---|
| Riquadro vetrina | Apre la schermata di voto (anche con Invio o Spazio) |
| **Azzera** | Toglie il filtro per numero |
| **Giudizio Completato** | Dichiara concluso il tuo giudizio sulla categoria; la pagina segue gli altri giudici |

**Errori comuni:** "Nessun modello da giudicare" = scegli un evento o una
categoria assegnata; **Giudizio Completato** compare solo con una categoria
selezionata e tutto votato; mancano voti su alcuni modelli.

### 6.2 Assegnare il voto
**A cosa serve:** votare una vetrina. **Chi la vede:** da Giudice.

Voti: **0** nessuno, **1** alta menzione, **2** bronzo, **3** argento, **4** oro.

1. Con **Tutto il display** attivo (predefinito) scegli il valore e premi **Vota tutto il display**.
2. Per votare solo alcuni modelli disattiva **Tutto il display**, spuntali, scegli il valore e premi **Invia Voto**.
3. Torna alle vetrine con la freccia.

| Pulsante | Cosa fa |
|---|---|
| 0–4 | Seleziona il voto; è registrato solo con l'invio |
| **Seleziona tutti** / **Deseleziona tutti** | Spunta o libera i modelli |
| **Vota tutto il display** | Registra il voto su tutti i modelli della vetrina |
| **Invia Voto** | Registra il voto sui modelli spuntati |
| Freccia indietro | Torna senza inviare |

Il voto si può correggere finché la categoria è aperta. Per votare l'intero
display in un'unica operazione seleziona sempre l'evento.

**Errori comuni:** i modelli di categorie chiuse non vengono votati (un avviso
indica quanti voti non sono stati registrati); invio disattivato = nessun voto o
nessun modello selezionato.

---

## 7. Presidente di giuria

Si assegna dalla pagina **Utenti**. Segue l'andamento in sola lettura e può
votare nelle categorie che gli sono assegnate come giudice (sezione 6). Non
modifica iscrizioni, premi, cataloghi o impostazioni.

### 7.1 Home (presidente di giuria)
**A cosa serve:** iscritti, check-in e modelli valutati per l'evento scelto.

| Pulsante | Cosa fa |
|---|---|
| **Apri statistiche** | Apre le Statistiche |
| **Vai al giudizio** | Apre la pagina Giudice |

**Errori comuni:** avviso di dati non disponibili se l'amministratore ha nascosto la sezione Dashboard.

### 7.2 Statistiche
**A cosa serve:** numeri del concorso, aggiornati ogni 30 secondi. **Chi la vede:** Presidente di giuria, Manager, Admin.

1. Filtra per evento o lascia **Tutti gli eventi**.
2. Leggi totali, utenti per paese, modelli per classe, medaglie, utenti più attivi e utenti senza modelli.
3. Per il pubblico usa la **Modalità proiezione** (Esc per uscire).

| Pulsante | Cosa fa |
|---|---|
| **Modalità proiezione** | Schermo intero |
| **Esci dalla proiezione** | Torna alla vista normale |
| **Apri scheda** | Apre la scheda dell'utente |

**Errori comuni:** "Impossibile caricare le statistiche"; sezione nascosta dall'amministratore.

---

## 8. Manager

### 8.1 Home (manager e admin)
Iscritti, check-in e modelli votati per l'evento scelto. Pulsanti: **Apri
amministrazione**, **Gestisci iscrizioni**, **Apri check-in staff**.

### 8.2 Iscrizioni: gestione evento
Nella pagina Iscrizioni manager e admin hanno anche **Gestione iscrizioni evento**.

| Comando | Cosa fa |
|---|---|
| Filtro evento | Limita l'elenco |
| **Esporta iscrizioni evento** | File Excel dell'evento scelto (disattivato senza evento) |
| Interruttore **Segna assente** | Segna o toglie l'assenza, subito |

### 8.3 Utenti
**A cosa serve:** account, ruoli, anagrafiche, esportazioni. **Chi la vede:** Manager, Admin.

1. Apri una riga per vedere la scheda.
2. Cambia ruolo o stato, oppure **Modifica** i dati anagrafici e **Salva**.
3. Per le esportazioni scegli prima l'evento.

| Pulsante | Cosa fa |
|---|---|
| **Crea utente** | Nuovo account con email, password (min. 8) e ruolo |
| Occhio / matita | Apre la scheda |
| Interruttore **Attivo** | Abilita o blocca l'accesso, subito |
| **Reset password** | Invia per email una password temporanea |
| Excel / PDF | Utenti iscritti all'evento scelto |
| **Salva** / **Annulla** / **Chiudi** | Salva, scarta, chiude la scheda |

Chi non è admin assegna solo ruoli inferiori al proprio e non agisce su utenti di
pari livello o superiore, né su sé stesso per ruolo e stato.

**Errori comuni:** email già registrata; "Email non configurata: la password non
è stata cambiata"; ruolo superiore al tuo.

### 8.4 Amministrazione: eventi (scheda Gara)
**A cosa serve:** eventi, categorie, campagne, fasce premio. **Chi la vede:** Manager, Admin.

1. Crea l'evento (nome e stato) e aggiorna lo stato quando serve.
2. Crea le categorie dell'evento; chiudile o riaprile.
3. Crea una **campagna** con le date di apertura e chiusura iscrizioni.
4. Scegli un evento e definisci le **fasce premio** (medaglia e intervallo di punteggio).

| Pulsante | Cosa fa |
|---|---|
| **Crea evento** | Crea l'evento |
| Icone di stampa sull'evento | Elenco modelli, etichette, DYMO |
| **Crea categoria** | Crea la categoria |
| **Chiudi** / **Riapri** | Chiude a iscrizioni e voti / riapre |
| Matita / cestino sulla categoria | Rinomina / elimina |
| **Esponenti**, **Jury QR**, **Jury List** | Stampe per la giuria della categoria |
| Aggiungi campagna / fascia, cestini | Crea o elimina campagne e fasce |

**Errori comuni:** nome categoria già usato nell'evento; la chiusura è rifiutata
se non tutti i giudici hanno votato tutti i modelli.

### 8.5 Amministrazione: giudici
**A cosa serve:** assegnazioni e avanzamento. **Chi la vede:** Manager, Admin.

1. Scegli evento, giudice (sono elencati giudici, presidenti di giuria, manager e admin) e categoria (o tutte), poi premi **Assegna**.
2. In **Monitoraggio** scegli l'evento per vedere percentuale votata e giudici che hanno concluso.

| Pulsante | Cosa fa |
|---|---|
| **Assegna** | Crea l'assegnazione |
| Matita / cestino | Cambia / toglie l'assegnazione |
| **Aggiorna** | Rilegge l'avanzamento |

**Errori comuni:** manca evento o giudice (pulsante disattivato).

### 8.6 Amministrazione: premi
**A cosa serve:** menzioni speciali, richieste dei giudici, correzioni. **Chi la vede:** Manager, Admin.

| Pulsante | Cosa fa |
|---|---|
| **Assegna menzione** | Premio extra a un modello (evento, modello, titolo) |
| Cestino sulla menzione | La revoca, dopo conferma |
| **Risolta** / **Rifiutata** | Chiude una richiesta di modifica di un giudice |
| Matita nelle correzioni | Sostituisce medaglia e posizione di un premio congelato |

**Errori comuni:** menzione non assegnabile se manca un campo.

### 8.7 Amministrazione: sponsor
**A cosa serve:** sponsor di ogni evento. **Chi la vede:** Manager, Admin.

1. Scegli evento, nome e livello (bronze, silver, gold, platinum).
2. Premi **Aggiungi sponsor**. Il cestino rimuove, dopo conferma.

**Errori comuni:** dati mancanti (compare l'errore del server).

### 8.8 Amministrazione: catalogo
**A cosa serve:** spostamento modelli, importazioni, livelli, ruoli coautore. **Chi la vede:** Manager, Admin.

| Funzione | Come si usa |
|---|---|
| **Sposta modello di classe** | Scegli modello e nuova classe → **Sposta** → conferma |
| **Import CSV — livelli** | Colonne: `Level Name, Free To Enter(1/0)`; scegli il file, controlla l'anteprima, **Importa** |
| **Import CSV — classi** | Scegli l'evento. Colonne: `Class Number, Level Name, Class Name, Category, Presentation Order Number, Out Of Competition(1/0)` |
| **Livelli** | **Aggiungi livello**; spunta **Iscrizione gratuita**; il cestino elimina |
| **Ruoli membri** | **Aggiungi ruolo**; imposta **Prezzo coautore** (es. `15` o `15,50`) e **Salva**; il cestino elimina |

**Errori comuni**
- La classe di destinazione deve appartenere allo stesso evento.
- Import: file troppo grande (max 256 KB, 2000 righe); livello sconosciuto; righe con errori elencate dopo l'invio. Le voci già esistenti vengono ignorate.
- Nome di ruolo coautore già presente: i nomi sono unici (maiuscole e spazi non contano).
- Importo non valido.
- Un livello non è gratuito finché non è spuntato (o importato come tale).

### 8.9 Etichette
**A cosa serve:** esportare e stampare le etichette dei modelli. **Chi la vede:** Manager, Admin.

1. Scegli l'evento.
2. Scegli il formato.

| Pulsante | Cosa fa |
|---|---|
| **Export Excel** | Utente, categoria, nome modello e codice |
| **Export PDF** | Foglio etichette stampabile |
| **Stampa DYMO** | Invia alla stampante DYMO collegata |

**Errori comuni:** pulsanti disattivati senza evento; nessuna stampante DYMO
(installare DYMO Connect); nessuna etichetta da stampare.

### 8.10 Premiazione
**A cosa serve:** cerimonia a schermo intero. **Chi la vede:** Manager, Admin.

1. Scegli l'evento e premi **Avvia premiazione**.
2. Avanza con frecce, barra spaziatrice, Invio o clic.
3. Esci con la **X** o **Esc**.

| Pulsante | Cosa fa |
|---|---|
| **Avanti** | Rivela il vincitore successivo o passa di categoria |
| **Indietro** | Nasconde l'ultimo mostrato |
| **X** | Torna alla Home |

L'ordine dei premi è quello impostato in **Regole** (9.2).

**Errori comuni:** "Nessun premio assegnato per questo evento".

---

## 9. Amministratore

### 9.1 Cosa può fare l'admin
L'admin vede sempre tutte le sezioni e ha sempre tutti i permessi.

### 9.2 Amministrazione: regole
**A cosa serve:** quota base, visibilità, permessi, ordine dei premi. **Chi la vede:** solo Admin (Amministratore → **Regole**).

| Riquadro | Passi |
|---|---|
| **Quota base** | Inserisci l'importo in euro → **Salva** |
| **Visibilità sezioni per ruolo** | Spunta le sezioni per ruolo → **Salva** |
| **Permessi** | Spunta i ruoli che possono **Iscrivere modelli per conto di altri** → **Salva** (stesso pulsante della visibilità). La colonna Admin è sempre concessa |
| **Ordine di premiazione** | **Sposta su** / **Sposta giù** → **Salva**; il primo è presentato per primo |

- La visibilità può **nascondere** una sezione, non concede poteri che il ruolo non ha. Il permesso invece abilita un'azione.
- Predefiniti visibilità: Utente = dashboard, modelli, iscrizioni, team; Staff aggiunge check-in; Giudice aggiunge giudizio; Presidente di giuria aggiunge statistiche; Manager tutto tranne impostazioni.
- Predefiniti permessi: solo Manager (e Admin).
- Ordine predefinito: Highly Commended, Bronze, Silver, Gold.

**Errori comuni:** importo non valido; le modifiche ai permessi si vedono negli
altri utenti quando ricaricano la pagina.

### 9.3 Impostazioni: generale
**Chi la vede:** solo Admin. Ogni riga ha il suo **Salva**; gli interruttori valgono subito.

| Impostazione | Effetto |
|---|---|
| Nome applicazione | Titolo in alto per tutti |
| Prefisso evento stampa codice | Lettere iniziali dei codici stampati |
| Numero cifre codice | Da 1 a 10 |
| Numero massimo modelli per utente | Disattiva l'iscrizione nella pagina Modelli al raggiungimento; il server applica solo il tetto di 50 per evento |
| Immagini modelli | Attiva o disattiva le foto |

**Errori comuni:** cifre fuori da 1–10; limite non intero positivo.

### 9.4 Impostazioni: tema
Scegli modalità (chiaro/scuro) e palette: **Monte San Savino Show**
(predefinito), Viola, Oceano, Foresta, Monte San Savino; poi **Salva**. Vale per
tutta l'applicazione.

**Errori comuni:** il pulsante sole/luna in alto cambia solo il tuo dispositivo.

### 9.5 Impostazioni: esportazioni
Includi o escludi codice modello, descrizione ed email partecipante; imposta
**Nome foglio Excel** e **Prefisso nome file Excel**, poi **Salva**.

**Errori comuni:** nome foglio e prefisso sono obbligatori.

### 9.6 Impostazioni: team
Nome del team **Manuale** (scritto a mano) o **Auto** (dai cognomi dei membri).
La scelta vale **solo su questo dispositivo**.

---

## 10. Classi, livelli e quote

### Classi e livelli
I livelli del concorso sono **Juniors**, **Standard**, **Masters** e **All**. I
dati dimostrativi contengono le 33 classi reali del Monte San Savino Show,
numerate **0–32** (es. Historical/Fantasy Painting, Open, Storytelling,
Sculpting, Ordnance, Time Chronicles, Cow Contest, Out Of Competition). In un
nuovo evento reale classi e livelli si creano a mano o da CSV (8.8).

### Quota di iscrizione
- **Quota base** (di norma 25 €): una volta per evento, da 1 a 50 modelli, se almeno un modello è a pagamento.
- **Coautori:** ogni coautore paga il prezzo del suo ruolo (di norma 15 €) **una sola volta** su tutti i tuoi modelli dell'evento. È riconosciuto dall'email o, in mancanza, da nome e cognome; con ruoli diversi si applica il prezzo più alto.
- **Livelli gratuiti** (es. Juniors, se impostato come gratuito): quei modelli non si pagano, coautori compresi. Con soli modelli gratuiti il totale è zero.

| Esempio | Totale |
|---|---|
| 3 modelli individuali | 25 € |
| 1 modello team con 2 coautori | 55 € |
| 2 modelli team con lo stesso coautore | 40 € |

L'**anteprima** nella procedura guidata è indicativa e mostra il totale attuale,
non quello dopo il salvataggio. Il totale aggiornato è in **Iscrizioni** →
**Riepilogo quota** e in **Stampa iscrizione**. La quota è calcolata con i prezzi
in vigore al momento della consultazione. L'applicazione non incassa questa quota.

---

## 11. API
Documentazione interattiva su **/docs** (Swagger: **Authorize** con il token JWT).
Riferimento in [`api.md`](api.md).
