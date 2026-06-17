# Docker Dev Setup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix `start.ps1` so the dev stack starts with Docker only — no host-level bun required.

**Architecture:** Remove the wrong bun host check from `start.ps1`, then retarget the compose command to `docker-compose.debug.yml` (standalone file, already has all services with hot-reload).

**Tech Stack:** PowerShell, Docker Compose, `docker-compose.debug.yml`

## Global Constraints

- Only `start.ps1` changes — no compose files modified
- Docker Desktop (Windows/Mac) or Docker Engine (Linux) is the only host requirement
- `docker-compose.debug.yml` must not be altered

---

### Task 1: Remove bun host check and retarget compose in `start.ps1`

**Files:**
- Modify: `start.ps1:19-36`

**Interfaces:**
- Consumes: `docker-compose.debug.yml` (existing, unchanged)
- Produces: updated `start.ps1` that works on any machine with Docker

- [ ] **Step 1: Open and read current `start.ps1`**

Verify lines 19–30 are the bun check block:

```powershell
# Check bun is installed before starting the backend
$bunFound = (Get-Command bun -ErrorAction SilentlyContinue) -or (Test-Path "$env:USERPROFILE\.bun\bin\bun.exe")
if (-not $bunFound) {
    Write-Host ""
    Write-Host "ERRORE: bun non e' installato o non e' nel PATH." -ForegroundColor Red
    ...
    exit 1
}
```

And lines 34–36 are the compose commands:

```powershell
docker compose -f docker-compose.yml -f docker-compose.dev.yml down
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
docker compose logs -f --tail=100
```

- [ ] **Step 2: Delete the bun check block (lines 19–30)**

Remove these lines entirely from `start.ps1`:

```powershell
# Check bun is installed before starting the backend
$bunFound = (Get-Command bun -ErrorAction SilentlyContinue) -or (Test-Path "$env:USERPROFILE\.bun\bin\bun.exe")
if (-not $bunFound) {
    Write-Host ""
    Write-Host "ERRORE: bun non e' installato o non e' nel PATH." -ForegroundColor Red
    Write-Host "Possibili cause:" -ForegroundColor Yellow
    Write-Host "  - bun non e' stato installato" -ForegroundColor Yellow
    Write-Host "  - bun non e' nel PATH di sistema" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Soluzione: installa bun da https://bun.sh e riprova." -ForegroundColor Cyan
    Write-Host ""
    exit 1
}
```

- [ ] **Step 3: Replace compose target**

Change the three compose lines from:

```powershell
docker compose -f docker-compose.yml -f docker-compose.dev.yml down
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
docker compose logs -f --tail=100
```

To:

```powershell
docker compose -f docker-compose.debug.yml down
docker compose -f docker-compose.debug.yml up -d
docker compose -f docker-compose.debug.yml logs -f --tail=100
```

- [ ] **Step 4: Verify final `start.ps1` content**

File should look exactly like this after edits:

```powershell
$root = $PSScriptRoot

# Check Docker is reachable before attempting compose
$dockerInfo = docker info 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERRORE: Docker non risponde." -ForegroundColor Red
    Write-Host "Possibili cause:" -ForegroundColor Yellow
    Write-Host "  - Docker Desktop non e' avviato" -ForegroundColor Yellow
    Write-Host "  - Docker non e' installato" -ForegroundColor Yellow
    Write-Host "  - Il servizio Docker e' in crash" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Soluzione: avvia Docker Desktop e riprova." -ForegroundColor Cyan
    Write-Host ""
    exit 1
}

Write-Host "Starting dev stack..."
Push-Location $root
docker compose -f docker-compose.debug.yml down
docker compose -f docker-compose.debug.yml up -d
docker compose -f docker-compose.debug.yml logs -f --tail=100
Pop-Location
```

- [ ] **Step 5: Manual smoke test**

Run `.\start.ps1` and verify:
- No bun check output
- All 6 services start: `postgres`, `minio`, `db-init`, `backend`, `frontend`, `adminer`
- Backend accessible at `http://localhost:3000`
- Frontend accessible at `http://localhost:5173`
- Adminer accessible at `http://localhost:8888`

- [ ] **Step 6: Commit**

```bash
git add start.ps1
git commit -m "fix(dev): remove host bun check, target docker-compose.debug.yml"
```
