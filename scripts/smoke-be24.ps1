# ==============================================================================
# SportComplex — Smoke Test Automatizado TSK-BE-24 (SCRUM-149 / HU-24 / RF-21)
# Valida: Seguridad Perimetral RBAC, Validación Zod, Resiliencia y SLA (< 2 s).
# Uso: .\scripts\smoke-be24.ps1 [-BaseUrl "http://localhost:3000"]
# ==============================================================================

param(
    [string]$BaseUrl = "http://localhost:3000"
)

$env:BASE_URL = $BaseUrl
$scriptPath = Join-Path $PSScriptRoot "smoke-be24.mts"

node --experimental-strip-types $scriptPath
exit $LASTEXITCODE
