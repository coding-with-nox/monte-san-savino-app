# CLAUDE.md — monte-san-savino-app

> Generato da install-orchestrator il 2026-11-26. Team: monte-san-savino. Stack: node (Bun + Drizzle/Postgres backend, React + Vite frontend, Playwright e2e).
> Vedi .claude/POLICY.md per le regole di costo e modello.

---

## Non esiste un agente "planner"

Sei tu, orchestratore (sessione principale), a eseguire il flusso qui sotto
direttamente. Non lanciare un subagent planner.

## Membri del team

| nome | modello | cartella posseduta | dipende da |
|---|---|---|---|
| backend-dev | claude-haiku-5-5 | `backend/` (escluso `backend/src/__integration__/`) | — |
| frontend-dev | claude-haiku-5-5 | `frontend/` | contratto API di backend-dev |
| test-engineer | claude-haiku-5-5 | `e2e/`, `backend/src/__integration__/` | backend-dev, frontend-dev ok |
| software-architect | claude-haiku-5-5 | nessuna (solo lettura) → `docs/analysis/` | — |
| documenter | claude-haiku-5-5 | `docs/` | tutti ok |
| security-guardian | claude-haiku-5-5 | nessuna (solo lettura) | — |
| worker | claude-haiku-5-5 | file assegnati (docker/, helm/, .github/, script) | — |
| scout / runner | claude-haiku-5-5 | nessuna (lanciati dai worker) | — |

Lanciali sempre con `name` esplicito. Nessuno di loro carica questo file
(`omitClaudeMd: true`).

## Flusso per ogni feature

```
1. Se docs/analysis/project-structure.md non esiste o è di un ciclo precedente:
   lancia software-architect (skill project-analysis) PRIMA di ogni altra cosa.
   Se la sezione 7 ha domande → falle al product owner e aspetta le risposte.
2. Fai le domande di chiarimento che servono, presenta il piano, aspetta l'OK
   esplicito del product owner prima di lanciare worker che scrivono codice.
3. Lancia in parallelo (in background) i worker che implementano la feature.
4. Quando TUTTI riportano STATO ok, lancia test-engineer.
5. Prima di ogni deploy in stage/prod: lancia security-guardian. Se riporta
   STATO bloccato, fermati e porta il report al product owner.
6. Quando implementazione e test sono ok: lancia documenter.
7. Sintesi finale al product owner: fatto, documentazione, problemi aperti.
```

## Quando fermarti e chiedere al product owner

| Situazione | Azione |
|---|---|
| Decisione architetturale (schema dati, contratto API, autenticazione) | Fermati, chiedi |
| software-architect trova problemi critici 🔴 | Porta il report, chiedi la strada |
| security-guardian riporta STATO bloccato | Blocca il deploy, chiedi |
| Due worker in conflitto su chi possiede un file | Chiedi |
| Un worker riporta STATO bloccato dopo un tentativo di ripresa | Chiedi |
| Tipo di documento non specificato e non deducibile | Chiedi |

## Regole di proprietà dei file

| Cartella | Proprietario | Note |
|---|---|---|
| `backend/` (+ unit test colocati) | backend-dev | proprietario contratto API e schema (`schema.ts` + `ensureTenantSchema.ts`) |
| `backend/src/__integration__/` | test-engineer | |
| `frontend/` (+ test Vitest colocati) | frontend-dev | consuma il contratto, non lo modifica |
| `e2e/` | test-engineer | |
| `docs/` | documenter (`docs/analysis/` → software-architect) | |
| `docker/`, `helm/`, `.github/`, compose, script | worker (su assegnazione) | |

Nessun worker modifica file fuori dalla propria cartella senza approvazione
esplicita del product owner.

## Qualità

Ogni worker che scrive codice ha un hook `Stop` che lancia
`.claude/hooks/quality-gate-node.ps1 <backend|frontend|all>`
(`bunx tsc --noEmit` + `bun test unit` / `npx tsc -b` + `npx vitest run`).
Se fallisce, il worker continua a correggere da solo.

## Automiglioramento

Le modifiche a `.claude/` proposte dall'orchestratore e approvate dal product
owner vanno registrate in `.claude/orchestra/CHANGELOG.md`.

## Note del team

### Convenzioni
- Schema DB: nessuna migrazione drizzle-kit in produzione; ogni modifica va anche in `backend/src/tenancy/infra/persistence/ensureTenantSchema.ts` (idempotente).
- Testi UI in `frontend/src/lib/i18n.ts` (IT/EN); temi in `frontend/src/lib/theme.ts`.
### Comandi specifici del progetto
- Backend: `cd backend && bun test unit` · integrazione: `bun run test:setup && bun test __integration__` (richiede Postgres).
- Frontend: `cd frontend && npx vitest run && npm run build`.
- Stack completo: `docker compose -f docker-compose.dev.yml up`.
### Never do
- Mai committare `.env`.
- Mai azioni su server PROD (vedi `~/.claude/CLAUDE.md`).

---
*Init: 2026-11-26 — team monte-san-savino*
