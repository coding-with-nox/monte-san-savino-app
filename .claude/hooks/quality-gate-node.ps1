# Quality gate per backend (Bun) e frontend (Vite/Vitest).
# Uso: quality-gate-node.ps1 <backend|frontend|all>
param([string]$Scope = "all")
$ErrorActionPreference = 'Continue'
$root = if ($env:CLAUDE_PROJECT_DIR) { $env:CLAUDE_PROJECT_DIR } else { (Get-Location).Path }

function Fail($msg, $out) {
  [Console]::Error.WriteLine("$msg Correggi prima di dichiararti finito:`n$($out | Select-Object -Last 60 | Out-String)")
  exit 2
}

if ($Scope -in @("backend", "all")) {
  Push-Location (Join-Path $root "backend")
  $tsc = & bunx tsc --noEmit 2>&1
  if ($LASTEXITCODE -ne 0) { Pop-Location; Fail "BACKEND TYPECHECK FALLITO." $tsc }
  $t = & bun test unit 2>&1
  if ($LASTEXITCODE -ne 0) { Pop-Location; Fail "BACKEND TEST FALLITI." $t }
  Pop-Location
}
if ($Scope -in @("frontend", "all")) {
  Push-Location (Join-Path $root "frontend")
  $tsc = & npx tsc -b 2>&1
  if ($LASTEXITCODE -ne 0) { Pop-Location; Fail "FRONTEND TYPECHECK FALLITO." $tsc }
  $t = & npx vitest run 2>&1
  if ($LASTEXITCODE -ne 0) { Pop-Location; Fail "FRONTEND TEST FALLITI." $t }
  Pop-Location
}
exit 0
