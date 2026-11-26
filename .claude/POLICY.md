# POLICY.md — modello di costo e di ruolo, vale per OGNI team in questo progetto

## Livelli e modelli — non negoziabile

| Livello | Chi | Modello | Come si lancia |
|---|---|---|---|
| Orchestratore | La sessione principale (tu che parli col product owner) | Il modello scelto per la sessione (unico a comandare) | È già la sessione: non lanciarlo mai come subagent |
| Membri del team | backend-dev/frontend-dev/test-engineer/documenter/software-architect | Haiku 5.5 (`claude-haiku-5-5`) | Sempre con `name` esplicito passato al tool Agent |
| Subagent di supporto (ricerca, esecuzione comandi) | `scout`/`runner`, lanciati DAI membri del team | Haiku 5.5 (`claude-haiku-5-5`) | Solo se il membro del team ne ha bisogno per isolare output verboso |

**Niente `agents/planner.md`.** Il coordinamento (sequenza, dipendenze,
escalation al product owner) è scritto in `CLAUDE.md` ed è la sessione
principale a eseguirlo direttamente.

## Ogni agente di team DEVE avere nel frontmatter

```yaml
tools: Read, Write, Edit, Bash, PowerShell, Grep, Glob, Agent, SendMessage, Skill
maxTurns: 60
omitClaudeMd: true
```

`Agent` + `SendMessage` mancanti è il bug più comune: un agente che nel prompt
dice "manda un messaggio a..." ma non ha il tool per farlo resta muto.

`omitClaudeMd: true` perché ogni agente ha già, nel proprio corpo, tutto ciò
che gli serve.

## Skill: precaricare solo su chi la usa davvero

Mai a livello dell'intero team se solo un ruolo la applica (es. `sky_doc` solo
sul documenter, `project-analysis` solo sul software-architect).

## Quality gate: hook Stop, non una task list

Il gate di qualità è un hook `Stop` per ogni agente che scrive codice, che
punta a `.claude/hooks/quality-gate-node.ps1 <backend|frontend|all>`. Se
typecheck/test falliscono, lo script esce con codice 2: l'agente non si
considera finito e continua a correggere da solo.

## Report finale — stesso formato per ogni agente

```
RPT
STATO: ok|parziale|bloccato
FATTO: <max 3 righe>
FILE: <path:righe>
TEST: <passati/falliti, oppure ->
PROBLEMA: <solo se non ok>
```

Un agente che non scrive test (software-architect, security-guardian) può
sostituire `TEST` con un campo più pertinente (`CRITICI`/`MEDI`) — la
struttura STATO/FATTO/PROBLEMA resta fissa.

## Sicurezza: un solo agente globale

`agents/security-guardian.md` rileva da solo lo stack e lancia lo scanner giusto.

## Delega interna standard

Un worker, prima di leggere un file intero o lanciare un comando lungo lui
stesso, valuta se delegare: ricerche nel codice → `scout` (Haiku 5.5, solo
`path:riga`); build/test/lint lunghi → `runner` (Haiku 5.5, solo esito). Se questi
tipi non sono disponibili, procede da solo con i propri tool.

## Preferenze personali: mai in questo repository

Preferenze di un singolo sviluppatore vanno nel proprio `~/.claude/` locale.

## Automiglioramento: governance

1. **Nessuna modifica a `.claude` senza approvazione esplicita dell'utente**,
   data dopo una proposta con COSA / PERCHÉ / COME / IMPATTO / AMBITO.
2. Chi propone non applica da solo senza conferma.
3. Non si cambiano da soli i livelli di modello, i permessi, gli hook di sicurezza.
4. Ogni modifica va registrata in `.claude/orchestra/CHANGELOG.md`, con
   istruzioni per annullarla.
