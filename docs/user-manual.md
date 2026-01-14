# Manuale Utente — Miniatures Contest Platform

## Panoramica
La piattaforma consente di gestire concorsi di miniature con ruoli e permessi gerarchici:
**user → staff → judge → manager → admin**.

## Accesso
### Registrazione (Sign up)
1. Apri il sito.
2. Seleziona **Sign up**.
3. Inserisci **email** e **password** (minimo 8 caratteri).
4. Conferma.

### Login
1. Inserisci email e password.
2. Premi **Login**.

## Ruolo: User (Partecipante)
### Profilo
- Visualizza e aggiorna i dati del profilo.

### Iscrizione a un evento
1. Vai su **Events**.
2. Seleziona un evento.
3. Premi **Register**.

Stati possibili:
- **pending**: in attesa di validazione
- **validated**: accettata
- **closed**: chiusa

### Inserimento modelli
1. Vai su **My Models**.
2. Premi **Add model**.
3. Seleziona la categoria e inserisci il nome.
4. Carica l’immagine del modello (upload sicuro su storage).

## Ruolo: Staff
### Check-in partecipanti
1. Vai su **Check-in**.
2. Seleziona l’evento.
3. Cerca un partecipante (o usa QR/ID).
4. Premi **Check-in**.

Nota: il check-in è consentito solo se la registrazione è **validated**.

### Stampa liste / badge
- Stampa liste partecipanti e badge (se abilitato dall’organizzazione).

## Ruolo: Judge (Giudice)
### Consultazione
- Filtra per evento e categoria.
- Visualizza dettagli modello.

### Voto
Il voto distingue:
- **voto non dato**: nessun voto registrato (assenza di record)
- **voto 0**: valutazione esplicita “Non meritevole”

Valori ammessi:
- **3**: migliore
- **2**: molto buono
- **1**: buono
- **0**: non meritevole

## Ruolo: Manager
### Gestione evento e categorie
- Crea/modifica eventi e categorie.
- Apri/chiudi le iscrizioni.

### Validazione iscrizioni
- Valida le iscrizioni pendenti.

### Premi / classifiche
- Calcola la classifica per categoria (top 3) con punteggio aggregato.

### Export
- Esporta partecipanti in CSV e, se previsto, risultati.

## Ruolo: Admin
### Gestione utenti e ruoli
- Crea utenti, assegna ruoli, disabilita account.

### Tenant / Cliente
- Configura la separazione dati per cliente (DB separato per tenant).
