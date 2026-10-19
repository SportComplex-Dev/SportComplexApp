# Supervisión L3 background: quota-pause + worker_done
# Uso: powershell -File scripts/supervisar-celulas.ps1
$ErrorActionPreference = 'Continue'
$workdir = 'C:/Users/josed/orca/workspaces/SportComplexApp/osprey'
$log = "$workdir/cells-mailbox/SUPERVISION-LOG.md"
$terms = @(
  'term_172e8263-dbc3-46ad-a898-cc34c51e36dc',
  'term_c2773f11-05b6-41bd-afd9-3f3f28a8181b',
  'term_dc4177c5-c70c-4ebe-a92f-368425d214b9',
  'term_d714e374-cd12-4189-b755-4f0d0b4498cd'
)
function Log($m) {
  $ts = (Get-Date).ToUniversalTime().ToString('yyyy-MM-dd HH:mm:ssZ')
  Add-Content $log "[$ts] $m"
}
Log('supervision start')
for ($i = 1; $i -le 18; $i++) {
  # 1) scan quota en los 4 PTY
  foreach ($t in $terms) {
    $out = (orca terminal read --terminal $t --limit 30 --json 2>&1 | Out-String)
    if ($out -match '429|RESOURCE_EXHAUSTED|quota exhausted|Quota exceeded') {
      Log("QUOTA detectado en $t. Pausando las 4.")
      foreach ($u in $terms) {
        orca terminal send --terminal $u --interrupt --json 2>&1 | Out-Null
      }
      Log('PAUSA-QUOTA aplicada. Esperando re-enrol del usuario.')
      exit 42
    }
  }
  # 2) espera coordinada 5 min
  $raw = (orca orchestration check --wait --types worker_done,escalation,question --timeout-ms 280000 --json 2>&1 | Out-String)
  Log("ciclo $i check: " + ($raw | Select-String -Pattern '"count":\s*\d+' | Select-Object -First 1))
  if ($raw -match '"count":\s*([1-9])') {
    Log("DELIVERY con mensajes. Ver: orca orchestration inbox. Fin de supervision.")
    exit 0
  }
}
Log('18 ciclos sin delivery ni quota. Fin.')
exit 3
