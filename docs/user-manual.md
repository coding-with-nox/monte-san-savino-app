# Manuale Utente — Miniatures Contest Platform

## Panoramica
La piattaforma è in fase di sviluppo e oggi offre le seguenti funzionalità principali:
- **Autenticazione** (registrazione e login).
- **Ruoli** con permessi (user, judge, manager, admin) inclusi nel token.
- **Voto giudici** tramite schermata dedicata.
- **Upload immagine modello** tramite endpoint API protetto.
- **Documentazione API** tramite Swagger.

> Nota: la UI è una base funzionante. Le funzionalità di gestione eventi/categorie e staff non sono ancora esposte nel front-end.

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
### Voto dei modelli
1. Vai alla pagina **Judge**.
2. Inserisci il **modelId**.
3. Seleziona il **rank** (0, 1, 2, 3).
4. Premi **Vote**.

Interpretazione del rank:
- **3**: migliore
- **2**: molto buono
- **1**: buono
- **0**: non meritevole

> Nota: se non esiste un voto, significa che non è stato registrato alcun giudizio.

## Ruolo: User (Partecipante)
### Upload immagine modello (API)
L’upload dell’immagine avviene tramite endpoint API protetto:
- **POST** `/models/{modelId}/image-upload`
- Body: `{ "contentType": "image/jpeg" }`

La risposta contiene una URL firmata per caricare l’immagine su object storage.

## Documentazione API (Swagger)
La documentazione interattiva è disponibile su:
- **/docs**

Da qui puoi:
- Autenticarti con il pulsante **Authorize** inserendo il token JWT.
- Provare gli endpoint con esempi e risposte tipizzate.

## Stato attuale & prossimi step
Funzionalità previste ma non ancora esposte in UI:
- Gestione eventi e categorie.
- Check-in partecipanti.
- Validazione iscrizioni.
- Classifiche e premi.
- Gestione utenti avanzata.
