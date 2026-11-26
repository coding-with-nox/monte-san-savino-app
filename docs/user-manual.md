# Manuale Utente — Miniatures Contest Platform

## Panoramica
La piattaforma è in fase di sviluppo e oggi offre le seguenti funzionalità principali:
- **Autenticazione** (registrazione e login).
- **Ruoli** con permessi (user, staff, judge, presidente di giuria, manager, admin) inclusi nel token.
- **Iscrizione modelli** a step, anche in team, con calcolo della quota.
- **Voto giudici** tramite schermata dedicata, anche per intero display.
- **Upload immagine modello** tramite endpoint API protetto.
- **Documentazione API** tramite Swagger.

## Accesso
### Registrazione (Sign up)
1. Apri la pagina di **Login**.
2. Inserisci **email** e **password** (minimo 8 caratteri).
3. Premi **Sign up**.
4. Se la registrazione va a buon fine, l’app effettua automaticamente il login.

### Login
1. Inserisci **email** e **password**.
2. Premi **Login**.
3. Verrai reindirizzato alla **Dashboard**.

## Dashboard
Nella dashboard puoi:
- Vedere il tuo **ruolo** attuale.
- Eseguire il **logout**.

## Ruolo: Judge (Giudice)
### Voto per display
Un **display** (vetrina) raccoglie i modelli con lo stesso numero di display nell'evento.

1. Vai alla pagina **Giudice**.
2. Seleziona l'**evento** (ed eventualmente la categoria); puoi filtrare per n° display.
3. Apri il display.
4. Con **Tutto il display** attivo (predefinito) scegli il voto e premi **Vota tutto il display**.
5. Per votare solo alcuni modelli disattiva **Tutto il display**, selezionali e premi **Invia Voto**.

- Per votare l'intero display in un'unica operazione seleziona sempre l'evento.
- I modelli di categorie chiuse non vengono votati: un messaggio indica quanti voti non sono stati registrati.
- Vedi e voti solo i modelli delle categorie che ti sono assegnate.

> Nota: se non esiste un voto, significa che non è stato registrato alcun giudizio.

## Ruolo: Presidente di giuria
Il ruolo si assegna dalla pagina **Utenti** e si colloca tra giudice e manager.

- **Dashboard** in sola lettura con l'avanzamento dei giudici.
- **Statistiche**, dal pulsante **Apri statistiche** o dal menu.
- **Giudice**: può votare nelle categorie assegnate come giudice.
- Non può modificare iscrizioni, premi, cataloghi o impostazioni.
- L'amministratore può nascondere sezioni anche a questo ruolo.

> Limite attuale: la scheda **Giudici** dell'area **Amministratore** non elenca i presidenti di giuria tra i giudici assegnabili.

## Ruolo: User (Partecipante)
### Iscrivere un modello
Dalla pagina **Modelli** premi **Iscrivi modello** e segui i quattro step:

1. **Dati**: categoria e livello.
2. **Modello**: nome ed eventuali note.
3. **Coautori**: se è un lavoro di gruppo attiva **Modello in team** e per ogni coautore inserisci nome, cognome, ruolo ed email (facoltativa). Con **Aggiungi coautore** ne inserisci altri. Non serve creare prima un team.
4. **Riepilogo**: controlla i dati e l'**anteprima quota**, poi conferma.

Al salvataggio compare il codice assegnato. I modelli in team hanno il codice
`<numero partecipante>T<progressivo>` (es. `173T1`). Il limite è di 50 modelli
per partecipante e per evento.

### Quota di iscrizione
- **Quota base** (di norma 25 €): una volta per evento, da 1 a 50 modelli.
- **Coautori**: ogni coautore aggiunge il prezzo del suo ruolo (di norma 15 €) **una sola volta**, anche se compare in più modelli. Viene riconosciuto dall'email o, se manca, da nome e cognome.
- **Livelli gratuiti** (es. Juniores): per quei modelli non si paga nulla, coautori compresi. Se hai solo modelli gratuiti il totale è zero.

L'anteprima è indicativa e mostra il totale attuale dell'evento, non quello
dopo il salvataggio. Il totale aggiornato è nella pagina **Iscrizioni**, riquadro
**Riepilogo quota**; **Stampa iscrizione** produce la scheda con dettaglio e
totale. La quota è calcolata con i prezzi in vigore al momento della consultazione.

### Upload immagine modello (API)
L’upload dell’immagine avviene tramite endpoint API protetto:
- **POST** `/models/{modelId}/image-upload`
- Body: `{ "contentType": "image/jpeg" }`

La risposta contiene una URL firmata per caricare l’immagine su object storage.

## Ruolo: Manager / Admin
### Catalogo prezzi (manager e admin)
Area **Amministratore**, scheda **Catalogo**:
- **Prezzo coautore**: inserisci l'importo per ogni ruolo (es. `15` o `15,50`) e premi **Salva**.
- **Iscrizione gratuita**: spunta i livelli che non pagano (es. Juniores). Un livello non è gratuito finché non è spuntato.

### Scheda Regole (solo admin)
Area **Amministratore**, scheda **Regole**:
- **Quota base**: importo in euro dovuto una volta per evento.
- **Visibilità sezioni per ruolo**: spunta le sezioni visibili a ciascun ruolo e salva. L'amministratore vede sempre tutto. La spunta può nascondere una sezione, ma non concede permessi che il ruolo non ha.
- **Ordine di premiazione**: usa **Sposta su** / **Sposta giù** e salva; il primo della lista viene presentato per primo nella cerimonia. Predefinito: Highly Commended, Bronze, Silver, Gold.

### Tema
Il tema predefinito è **Monte San Savino Show**; l'admin può sceglierne un altro
dalla pagina **Impostazioni**.

## Documentazione API (Swagger)
La documentazione interattiva è disponibile su:
- **/docs**

Da qui puoi:
- Autenticarti con il pulsante **Authorize** inserendo il token JWT.
- Provare gli endpoint con esempi e risposte tipizzate.
