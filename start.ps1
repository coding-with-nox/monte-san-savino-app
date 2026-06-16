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

Write-Host "Starting dev stack..."
Push-Location $root
docker compose -f docker-compose.yml -f docker-compose.dev.yml down
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
docker compose logs -f --tail=100
Pop-Location
