---
name: project-analysis
description: >
  Usa questa skill per analizzare la struttura di un progetto esistente e produrre
  un file di analisi leggibile sia dagli agenti del team che dal product owner.
  Triggera quando: si avvia una nuova sessione su un progetto esistente, serve
  capire lo stato del progetto prima di pianificare, il software-architect viene
  chiamato per un'analisi, oppure mancano informazioni sulla struttura per
  pianificare una feature. Il file prodotto diventa il "contesto condiviso" del
  team per tutta la sessione.
---

# project-analysis — Skill di analisi struttura progetto

## 1. Scopo

Produce `docs/analysis/project-structure.md` che risponde a:
> **"Cosa fa questo progetto, com'è strutturato, e cosa manca per poter lavorarci?"**

Destinatari: gli agenti del team e il product owner.

## 2. Chi esegue e quando

Esecutore: `software-architect`. Quando: inizio sessione su progetto esistente;
prima di una feature complessa; dopo un ciclo di sviluppo significativo; on demand.

Gap informativi → sezione 7, mai inventati né TODO silenziosi.

## 3. Processo di analisi

### Step 1 — Rileva lo stack e scansiona

```bash
find . -maxdepth 2 -name "*.csproj" 2>/dev/null | grep -q . && STACK=dotnet
[ -f pyproject.toml ] || [ -f requirements.txt ] && STACK=python
[ -f pom.xml ] || [ -f build.gradle ] && STACK=java
ls */package.json package.json 2>/dev/null | grep -q . && STACK=node
```

Se `STACK=node` (questo progetto: `backend/` Bun + Drizzle, `frontend/` React + Vite, `e2e/` Playwright):
```bash
git ls-files | grep -v -E "(node_modules|dist|\.lock)" | sort
for p in backend frontend e2e; do echo "== $p"; cat $p/package.json; done
(cd frontend && npm audit --omit=dev) 2>/dev/null || echo "npm audit non disponibile — GAP"
git ls-files | grep -E "\.(test|spec)\.tsx?$" | wc -l
```

Se dotnet/python/java: stesso principio (elenco file, dipendenze dichiarate,
scansione vulnerabilità, conteggio test). Stack non riconosciuto → sezione 7.

### Step 2 — Lettura dei file chiave

1. `README.md` 2. `docs/architecture.md` 3. manifest (`package.json`) 4. schema
dati (`backend/src/**/persistence/schema.ts`) 5. domain (`backend/src/**/domain`)
6. route HTTP (`backend/src/**/infra/http`) 7. bootstrap (`backend/src/bootstrap`)
8. pagine frontend (`frontend/src/pages`) 9. config (`.env.example`, mai `.env`).

### Step 3 — Gap

Ogni sezione non compilabile con certezza → `[GAP — vedi sezione 7]` + domanda
in sezione 7. Non inventare business context, obiettivi, stakeholder, vincoli.

## 4. Struttura del file di output

Produci `docs/analysis/project-structure.md` con ESATTAMENTE queste sezioni:

```markdown
# Analisi struttura progetto — [Nome Progetto]
**Generato da:** software-architect (agente) · **Data analisi:** [YYYY-MM-DD]
**Versione analisi:** [1.0/1.1/2.0] · **Stato:** Completa / Parziale (gap — vedi §7)

## 1. Panoramica
### 1.1 Cosa fa il progetto
### 1.2 Stack tecnologico (tabella Componente | Tecnologia | Versione)
### 1.3 Architettura adottata

## 2. Struttura dei progetti
### 2.1 Mappa della solution
### 2.2 Grafo delle dipendenze
### 2.3 Deviazioni dall'architettura dichiarata

## 3. Modello di dominio
### 3.1 Entità principali (tabella)
### 3.2 Value Objects
### 3.3 Domain Events
### 3.4 Regole di business tracciate

## 4. Funzionalità implementate
### 4.1 Use Cases/Commands/Queries (tabella ID|Nome|Tipo|Stato|Test)
### 4.2 Endpoint API esposti (tabella Metodo|Path|Use Case|Auth)
### 4.3 Funzionalità mancanti o stub

## 5. Stato dei test
### 5.1 Copertura stimata
### 5.2 Gap di test critici

## 6. Valutazione di salute del progetto
### 6.1 Punti di forza ✅ (max 5)
### 6.2 Problemi critici 🔴
### 6.3 Miglioramenti consigliati 🟡
### 6.4 Debito tecnico noto 🟢

## 7. Domande per il product owner
(tabella # | Sezione in attesa | Domanda | Impatto se non risposta — o "Nessun gap rilevato. Analisi completa.")

## 8. Prossimi passi consigliati (lista ordinata per priorità)
```

## 5. Regole non negoziabili

1. Zero invenzioni: non deducibile da codice/README/config → GAP in sezione 7.
2. Ogni giudizio motivato con riferimento concreto (file, riga, pattern).
3. Aggiornamento incrementale: se il file esiste, aggiorna solo le sezioni
   cambiate e incrementa la versione.
4. Sezione 7 con domande → l'orchestratore non assegna task di sviluppo finché
   non arrivano le risposte.
5. Formato tabellare per le liste strutturate.
