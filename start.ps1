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
