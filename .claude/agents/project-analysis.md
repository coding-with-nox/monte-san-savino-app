---
name: project-analysis
description: >
  Usa questa skill per analizzare la struttura di un progetto .NET esistente e produrre
  un file di analisi leggibile sia dagli agenti del team che dal product owner.
  Triggera quando: si avvia una nuova sessione su un progetto esistente, il Planner
  ha bisogno di capire lo stato del progetto prima di pianificare, il software-architect
  viene chiamato per un'analisi, oppure quando mancano informazioni sulla struttura
  per pianificare una feature. Il file prodotto diventa il "contesto condiviso" del
  team per tutta la sessione.
---

# project-analysis — Skill di analisi struttura progetto

## 1. Scopo

Questa skill produce un file `docs/analysis/project-structure.md` che risponde a
una domanda fondamentale:

> **"Cosa fa questo progetto, com'è strutturato, e cosa manca per poter lavorarci?"**

Il file ha due destinatari:
- **Gli agenti del team** (Planner, Backend-dev, Frontend-dev, Test-engineer) che lo
  leggono all'inizio di ogni sessione per orientarsi senza dover rileggere tutto il codice.
- **Il product owner** che può vedere in un colpo solo lo stato di salute del progetto
  e le lacune informative che richiedono una sua decisione.

---

## 2. Chi esegue questa skill e quando

### Esecutore principale
`software-architect` — è l'unico agente che ha gli strumenti (Read, Grep, Glob, Bash)
e il ruolo per fare un'analisi trasversale del progetto.

### Quando viene invocata
- **Inizio sessione su progetto esistente**: il Planner chiama software-architect con
  questa skill prima di qualsiasi pianificazione.
- **Prima di pianificare una feature complessa**: il Planner ha bisogno del contesto
  per suddividere bene i task.
- **Dopo un ciclo di sviluppo significativo**: per aggiornare l'analisi con le novità.
- **On demand dal product owner**: "analizza il progetto" / "fammi vedere com'è messo".

### Ruolo del Planner
Se durante l'analisi emergono gap informativi (sezioni che non possono essere
compilate senza input umano), il software-architect NON inventa e NON lascia TODO
silenziosi: **notifica il Planner** con una lista strutturata di domande.
Il Planner le porta al product owner e raccoglie le risposte prima di procedere.

---

## 3. Processo di analisi

### Step 1 — Scansione della struttura

Esegui questi comandi per raccogliere il materiale grezzo:

```bash
# Struttura ad albero del progetto (esclude bin/obj/node_modules)
find . -type f \( -name "*.cs" -o -name "*.csproj" -o -name "*.sln" \
  -o -name "*.json" -o -name "*.md" -o -name "Dockerfile" \
  -o -name "docker-compose*.yml" \) \
  | grep -v -E "/(bin|obj|node_modules|\.git)/" \
  | sort

# Dipendenze NuGet per progetto
find . -name "*.csproj" | xargs grep -l "PackageReference" | \
  xargs -I{} sh -c 'echo "\n=== {} ===" && grep "PackageReference" {}'

# Riferimenti tra progetti
find . -name "*.csproj" | xargs grep -l "ProjectReference" | \
  xargs -I{} sh -c 'echo "\n=== {} ===" && grep "ProjectReference" {}'

# Vulnerabilità NuGet note
dotnet list package --vulnerable --include-transitive 2>/dev/null || true

# Versione .NET usata
find . -name "*.csproj" | xargs grep -h "TargetFramework" | sort -u

# Presenza di test
find . -path "*/tests*" -name "*.cs" | wc -l
```

### Step 2 — Lettura dei file chiave

Leggi in quest'ordine, fermandoti quando hai abbastanza contesto:

1. `README.md` (se esiste) — panoramica generale
2. `CLAUDE.md` (se esiste) — istruzioni per gli agenti
3. File `.sln` — per capire la composizione della solution
4. Ogni `*.csproj` — per capire i layer e le dipendenze
5. Le Entities principali in `Domain/` — per capire il modello di dominio
6. I Use Cases / Command / Query in `Application/` — per capire le funzionalità
7. `Program.cs` / `Startup.cs` — per capire la configurazione e i servizi registrati
8. I Controller in `Api/` — per capire gli endpoint esposti
9. `appsettings.json` (NON `appsettings.*.json` con segreti) — per capire la config

### Step 3 — Identificazione dei gap

Per ogni sezione del file di output, valuta se hai informazioni sufficienti.
Se una sezione non può essere compilata con certezza → marcala come
`[GAP — vedi sezione 7: Domande per il product owner]` e aggiungi la domanda
corrispondente alla sezione 7.

**Non inventare mai** business context, obiettivi di progetto, stakeholder,
vincoli di budget o normativi, o decisioni architetturali non tracciate nel codice.

---

## 4. Struttura del file di output

Produci `docs/analysis/project-structure.md` con questa struttura esatta.
Non rinominare le sezioni — sono il riferimento condiviso del team.

```markdown
# Analisi struttura progetto — [Nome Progetto]

**Generato da:** software-architect (agente)
**Data analisi:** [YYYY-MM-DD]
**Versione analisi:** [incrementale, es. 1.0 / 1.1 / 2.0]
**Stato:** Completa / Parziale (gap presenti — vedi §7)

---

## 1. Panoramica

### 1.1 Cosa fa il progetto
[Descrizione in linguaggio di business — cosa risolve, per chi, in quale contesto.
Se non ricavabile dal codice o dal README → GAP]

### 1.2 Stack tecnologico
| Componente       | Tecnologia              | Versione |
|------------------|-------------------------|----------|
| Runtime          | .NET                    | [x]      |
| Web framework    | ASP.NET Core            | [x]      |
| ORM              | EF Core / Dapper / ...  | [x]      |
| Database         | SQL Server / Postgres /…| [x]      |
| Messaggistica    | [se presente]           | [x]      |
| Frontend         | [se presente]           | [x]      |
| Test             | xUnit / NUnit / ...     | [x]      |
| Containerization | Docker / ...            | [x]      |

### 1.3 Architettura adottata
[Clean Architecture / Onion / Layered / Hexagonal / Non strutturata / ...]
[Breve valutazione: è applicata correttamente? Deviazioni rilevanti?]

---

## 2. Struttura dei progetti

### 2.1 Mappa della solution
```
[albero dei progetti con una riga di descrizione per ciascuno]
```

### 2.2 Grafo delle dipendenze
```
[diagramma testuale delle dipendenze tra progetti]
es:
SkyApp.Api → SkyApp.Application → SkyApp.Domain
SkyApp.Infrastructure → SkyApp.Application
```

### 2.3 Deviazioni dall'architettura dichiarata
[Dipendenze che violano il modello — es. Application che dipende da Infrastructure]
[Se nessuna: "Nessuna deviazione rilevata"]

---

## 3. Modello di dominio

### 3.1 Entità principali
| Entità       | Responsabilità                        | Relazioni principali |
|--------------|---------------------------------------|----------------------|
| [Nome]       | [cosa rappresenta]                    | [con chi è collegata]|

### 3.2 Value Objects
[Lista con descrizione breve, o "Nessuno rilevato"]

### 3.3 Domain Events
[Lista con descrizione breve, o "Nessuno rilevato"]

### 3.4 Regole di business tracciate nel dominio
[Invarianti, validazioni, logica di business nelle Entities — max 10 voci più rilevanti]

---

## 4. Funzionalità implementate

### 4.1 Use Cases / Commands / Queries
| ID   | Nome                    | Tipo    | Stato           | Test presenti |
|------|-------------------------|---------|-----------------|---------------|
| UC-1 | [NomeCommand/Query]     | Command | Implementato    | Sì / No       |
| UC-2 | ...                     | Query   | TODO / Stub     | Sì / No       |

### 4.2 Endpoint API esposti
| Metodo | Path                        | Use Case collegato | Auth richiesta |
|--------|-----------------------------|--------------------|----------------|
| POST   | /api/[...]                  | [UC-x]             | Sì / No        |

### 4.3 Funzionalità mancanti o stub
[Feature presenti come placeholder, TODO nel codice, o dichiarate nel README
ma non implementate]

---

## 5. Stato dei test

### 5.1 Copertura stimata
| Progetto di test          | Test presenti | Tipo                  | Stato    |
|---------------------------|---------------|-----------------------|----------|
| [Nome.Tests]              | [n]           | Unit / Integration    | Verde / Rosso / Assente |

### 5.2 Gap di test critici
[Use Cases o endpoint senza test — ordinati per rischio]

---

## 6. Valutazione di salute del progetto

### 6.1 Punti di forza ✅
[Max 5 voci — cosa funziona bene architetturalmente e come codice]

### 6.2 Problemi critici 🔴
[Da risolvere prima del prossimo deploy in prod]

### 6.3 Miglioramenti consigliati 🟡
[Importanti ma non bloccanti]

### 6.4 Debito tecnico noto 🟢
[Refactoring evolutivo — non urgente]

---

## 7. Domande per il product owner
[Compilata solo se ci sono GAP — sezioni che non possono essere completate
senza input umano. Il Planner porta queste domande al product owner prima
che il team inizi a lavorare.]

| # | Sezione in attesa | Domanda                                      | Impatto se non risposta         |
|---|-------------------|----------------------------------------------|---------------------------------|
| 1 | [§ x.x]           | [domanda precisa, non vaga]                  | [cosa non si può fare senza]    |
| 2 | ...               | ...                                          | ...                             |

Se questa sezione è vuota → scrivi "Nessun gap rilevato. Analisi completa."

---

## 8. Prossimi passi consigliati
[Lista ordinata per priorità — cosa dovrebbe fare il team prima di iniziare
a sviluppare nuove feature]

1. [Azione concreta — chi la fa, stima rough]
2. ...
```

---

## 5. Regole non negoziabili

1. **Zero invenzioni**: se un'informazione non è nel codice, nel README o nei file
   di configurazione → è un GAP, va nella sezione 7, non va inventata.
2. **Zero valutazioni estetiche**: "il codice è bello" non è un'analisi.
   Ogni giudizio deve essere motivato con un riferimento concreto (file, riga, pattern).
3. **Aggiornamento incrementale**: se il file esiste già, non sovrascrivere l'intera
   analisi — aggiorna solo le sezioni cambiate e incrementa la versione (es. 1.0 → 1.1).
4. **Il Planner è il gateway verso il product owner**: il software-architect non
   contatta mai il product owner direttamente. Notifica il Planner con la lista delle
   domande dalla sezione 7 e aspetta le risposte.
5. **Formato tabellare per le liste**: usa tabelle Markdown per le liste strutturate —
   sono più leggibili dagli agenti e dal product owner.

---

## 6. Integrazione con le altre skill e agenti

- Se durante l'analisi emergono vulnerabilità di sicurezza → segnalale nella sezione 6.2
  (Problemi critici) E notifica il Planner che deve attivare `security-guardian`.
- Se la sezione 7 ha domande → il Planner NON assegna task a backend-dev o frontend-dev
  finché le risposte non sono arrivate. L'analisi incompleta blocca la pianificazione.
- Il `documenter` può usare `docs/analysis/project-structure.md` come fonte per
  compilare la sezione "Product perspective" dell'SRS (§2.1 del template srs).
