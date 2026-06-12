$root = $PSScriptRoot

Write-Host "Starting dev stack..."
Push-Location $root
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
Pop-Location
