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
        Write-Host "Creato .env da .env.example." -ForegroundColor Yellow
    }

    # JWT_SECRET is required (no default). Generate a random one if missing/empty; never print it.
    if (Test-Path ".env") {
        $envLines = [System.IO.File]::ReadAllLines((Join-Path $root ".env"))
        $jwtIdx = -1
        $jwtSet = $false
        for ($i = 0; $i -lt $envLines.Length; $i++) {
            if ($envLines[$i] -match '^\s*JWT_SECRET\s*=(.*)$') {
                $jwtIdx = $i
                if ($Matches[1].Trim().Trim('"').Trim("'").Length -gt 0) { $jwtSet = $true }
                break
            }
        }
        if (-not $jwtSet) {
            $bytes = New-Object byte[] 48
            $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
            try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
            $newLine = "JWT_SECRET=" + [Convert]::ToBase64String($bytes)
            if ($jwtIdx -ge 0) {
                $envLines[$jwtIdx] = $newLine
            } else {
                $envLines = $envLines + $newLine
            }
            [System.IO.File]::WriteAllLines((Join-Path $root ".env"), $envLines, (New-Object System.Text.UTF8Encoding($false)))
            Write-Host "Generato JWT_SECRET casuale in .env (valore non mostrato)." -ForegroundColor Yellow
        }
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