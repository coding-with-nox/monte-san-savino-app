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

Push-Location $root
try {
    if (-not (Test-Path ".env") -and (Test-Path ".env.example")) {
        Copy-Item ".env.example" ".env"
        Write-Host "Creato .env da .env.example." -ForegroundColor Yellow
    }

    # Segreti obbligatori, senza default nel compose. Genero valori casuali per quelli mancanti o
    # vuoti in .env. I valori non vengono mai stampati.
    function New-RandomSecret([int]$byteCount, [bool]$hex) {
        $bytes = New-Object byte[] $byteCount
        $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
        try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
        if ($hex) { return ([System.BitConverter]::ToString($bytes) -replace '-', '').ToLower() }
        # Base64 senza '+', '/', '=' (sicuro in .env/compose; niente '$' ne' apici).
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
        $changed = @()

        # POSTGRES_PASSWORD vale solo alla CREAZIONE del volume. Se il volume di sviluppo esiste gia'
        # (creato con la vecchia password di default "postgres") una password casuale nuova non
        # corrisponderebbe e il backend non si collegherebbe: in sviluppo mantengo quella storica.
        # Solo locale: docker-compose.debug.yml pubblica le porte solo su 127.0.0.1.
        if (-not (Test-EnvVarSet $envLines "POSTGRES_PASSWORD")) {
            $project = ((Split-Path $root -Leaf).ToLower() -replace '[^a-z0-9_-]', '')
            $existing = docker volume ls -q --filter "name=${project}_pgdata_debug" 2>$null
            if ($existing -contains "${project}_pgdata_debug") {
                $envLines = Set-EnvVar $envLines "POSTGRES_PASSWORD" "postgres"
                $changed += "POSTGRES_PASSWORD (valore storico 'postgres': il database di sviluppo esiste gia')"
            }
            else {
                $envLines = Set-EnvVar $envLines "POSTGRES_PASSWORD" (New-RandomSecret 24 $false)
                $changed += "POSTGRES_PASSWORD"
            }
        }

        $secrets = @(
            @{ Name = "JWT_SECRET";          Bytes = 48; Hex = $false },
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
            Write-Host ("Aggiornato .env per: " + ($changed -join ", ") + " (valori non mostrati).") -ForegroundColor Yellow
        }
    }
    else {
        Write-Host "ERRORE: manca .env e non c'e' .env.example da cui crearlo." -ForegroundColor Red
        exit 1
    }

    Write-Host "Starting dev stack..."
    docker compose -f docker-compose.debug.yml down
    docker compose -f docker-compose.debug.yml up -d
    docker compose -f docker-compose.debug.yml logs -f --tail=100
}
finally {
    Pop-Location
}
