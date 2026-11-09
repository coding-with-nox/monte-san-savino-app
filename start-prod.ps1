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

    # Required secrets have no default. Generate random values for the missing/empty ones in .env.
    # Values are never printed.
    function New-RandomSecret([int]$byteCount, [bool]$hex) {
        $bytes = New-Object byte[] $byteCount
        $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
        try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
        if ($hex) { return ([System.BitConverter]::ToString($bytes) -replace '-', '').ToLower() }
        # Base64 without '+', '/', '=' (safe in .env/compose; no '$' or quotes).
        return ([Convert]::ToBase64String($bytes) -replace '[+/=]', '')
    }

    function Test-EnvVarSet([string[]]$lines, [string]$name) {
        foreach ($l in $lines) {
            if ($l -match ('^\s*' + $name + '\s*=(.*)$')) {
                if ($Matches[1].Trim().Trim('"').Trim("'").Length -gt 0) { return $true }
            }
        }
        return $false
    }

    function Set-EnvVar([string[]]$lines, [string]$name, [string]$value) {
        $newLine = "$name=$value"
        for ($i = 0; $i -lt $lines.Length; $i++) {
            if ($lines[$i] -match ('^\s*' + $name + '\s*=')) { $lines[$i] = $newLine; return ,$lines }
        }
        return ,($lines + $newLine)
    }

    if (Test-Path ".env") {
        $envPath = Join-Path $root ".env"
        $envLines = [System.IO.File]::ReadAllLines($envPath)

        # An existing pgdata volume was initialised with the OLD password (previously defaulted to
        # "postgres"). A new random password would NOT match it and the backend would fail to
        # connect: stop and ask the operator to set POSTGRES_PASSWORD explicitly.
        if (-not (Test-EnvVarSet $envLines "POSTGRES_PASSWORD")) {
            $project = ((Split-Path $root -Leaf).ToLower() -replace '[^a-z0-9_-]', '')
            $existing = docker volume ls -q --filter "name=${project}_pgdata" 2>$null
            if ($existing -contains "${project}_pgdata") {
                Write-Host ""
                Write-Host "ERRORE: esiste gia' il volume ${project}_pgdata ma POSTGRES_PASSWORD non e' impostata in .env." -ForegroundColor Red
                Write-Host "Il database esistente usa la password con cui e' stato creato (di default: postgres)." -ForegroundColor Yellow
                Write-Host "Imposta POSTGRES_PASSWORD in .env con quella password (poi cambiala con ALTER USER) e rilancia." -ForegroundColor Yellow
                Write-Host ""
                exit 1
            }
        }

        $changed = @()
        $secrets = @(
            @{ Name = "JWT_SECRET";          Bytes = 48; Hex = $false },
            @{ Name = "POSTGRES_PASSWORD";   Bytes = 24; Hex = $false },
            @{ Name = "MINIO_ROOT_USER";     Bytes = 8;  Hex = $true  },
            @{ Name = "MINIO_ROOT_PASSWORD"; Bytes = 24; Hex = $false }
        )
        foreach ($sec in $secrets) {
            if (-not (Test-EnvVarSet $envLines $sec.Name)) {
                $envLines = Set-EnvVar $envLines $sec.Name (New-RandomSecret $sec.Bytes $sec.Hex)
                $changed += $sec.Name
            }
        }
        if ($changed.Count -gt 0) {
            [System.IO.File]::WriteAllLines($envPath, $envLines, (New-Object System.Text.UTF8Encoding($false)))
            Write-Host ("Generati valori casuali in .env per: " + ($changed -join ", ") + " (valori non mostrati).") -ForegroundColor Yellow
        }
    }

    Write-Host "Starting packaged stack..."
    docker compose -f docker-compose.yml pull
    docker compose -f docker-compose.yml up -d
    docker compose -f docker-compose.yml ps
    Write-Host ""
    Write-Host "App: http://localhost:8080" -ForegroundColor Cyan
    Write-Host "API (via nginx): http://localhost:8080/api  (es. /api/health)" -ForegroundColor Cyan
}
finally {
    Pop-Location
}