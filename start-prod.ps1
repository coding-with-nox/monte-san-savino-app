$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

$dockerInfo = docker info 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERRORE: Docker non risponde." -ForegroundColor Red
    Write-Host "Avvia Docker Desktop e riprova." -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

Push-Location $root
try {
    if (-not (Test-Path ".env") -and (Test-Path ".env.example")) {
        Copy-Item ".env.example" ".env"
        Write-Host "Creato .env da .env.example. Controlla JWT_SECRET prima di usare dati reali." -ForegroundColor Yellow
    }

    Write-Host "Starting packaged stack..."
    docker compose -f docker-compose.yml pull
    docker compose -f docker-compose.yml up -d
    docker compose -f docker-compose.yml ps
    Write-Host ""
    Write-Host "App: http://localhost:8080" -ForegroundColor Cyan
    Write-Host "API: http://localhost:3000/docs" -ForegroundColor Cyan
}
finally {
    Pop-Location
}