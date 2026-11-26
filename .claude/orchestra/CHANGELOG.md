# CHANGELOG .claude

## 2026-11-26 — Installazione orchestratore (applicata, approvata dal product owner)
- COSA: riscritti gli agenti per lo stack reale (backend/ Bun, frontend/ React, e2e/), tutti Sonnet con Agent+SendMessage e `omitClaudeMd`; aggiunti POLICY.md, CLAUDE.md, scout/runner/worker/security-guardian, hook `quality-gate-node.ps1`; `project-analysis` spostata da agents/ a skills/; rimosso `agents/planner.md`.
- PERCHÉ: il team precedente era il template .NET (`src/Api`, `src/Web`), con modelli Opus e senza tool di comunicazione.
- ANNULLARE: `git checkout main -- .claude` e `git rm CLAUDE.md`.
- APERTO: `agents/github-issue-planner.md` passa ancora la mano a "planner": da adattare all'orchestratore.
