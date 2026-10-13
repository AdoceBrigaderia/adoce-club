[CmdletBinding()]
param([switch]$Apply)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$primary = 'D:\AdoceOnLine'
$targets = @(
  'D:\AdoceOnLine\Clube Adoce Release WhatsApp 20260901'
  'D:\AdoceOnLine\Clube Adoce Release Integracao 20260830'
  'D:\AdoceOnLine\Clube Adoce Android'
  'D:\AdoceOnLine\Clube Adoce Replica Local'
  'D:\AdoceOnLine\Clube Adoce - Arquivo Local 2026-08-07'
  'D:\AdoceOnLine\ADOCEB_2PONTOZERO'
  'D:\AdoceOnLine\revisao-marca'
  'D:\AdoceOnLine-NF'
  'D:\AdoceOnLine-NF-Live'
  'D:\adoce-java-tmp'
  'C:\Users\RubensBezerra\.codex\backups\adoce-homologacao'
  'C:\Users\RubensBezerra\Documents\Codex\2026-08-08\referenced-chatgpt-conversation-this-is-an'
  'C:\Users\RubensBezerra\.claude\projects\D--AdoceOnLine'
  'C:\Users\RubensBezerra\.claude\projects\D--Clube-Adoce-Release-Integracao-20260830'
  'C:\Users\RubensBezerra\.claude\projects\D--Clube-Adoce-Release-WhatsApp-20260901'
  'C:\Users\RubensBezerra\.codex\visualizations\2026\07\19\019f7c41-149b-7a00-9682-6629a07a60d5\adoce-site-audit-2026-07-21'
  'C:\Users\RubensBezerra\.codex\visualizations\2026\07\20\adoce-hoje-preview-fix'
  'C:\Users\RubensBezerra\.codex\visualizations\2026\07\20\adoce-producao-final'
  'C:\Users\RubensBezerra\.codex\visualizations\2026\07\20\adoce-site-revisao'
  'C:\Users\RubensBezerra\.codex\visualizations\2026\10\04\adoce-descartaveis'
  'C:\Users\RubensBezerra\AppData\Local\Temp\adoce-4174-qa-c15af08ff3b842f585a585042dae2c65'
  'C:\Users\RubensBezerra\AppData\Local\Temp\adoce-audit-build-20260826'
  'C:\Users\RubensBezerra\AppData\Local\Temp\adoce-build-check'
  'C:\Users\RubensBezerra\AppData\Local\Temp\adoce-chrome-qa-20260826-1738'
  'C:\Users\RubensBezerra\AppData\Local\Temp\adoce-chrome-qa-d8504f00cf5349dd98b0abd9b7fcd1ad'
  'C:\Users\RubensBezerra\AppData\Local\Temp\adoce-costs-before-recovery-20261008-010402'
  'C:\Users\RubensBezerra\AppData\Local\Temp\adoce-customer-access-preview-20260820'
  'C:\Users\RubensBezerra\AppData\Local\Temp\adoce-final-qa-dc95b1b6c4af429e9479d220b2f76994'
  'C:\Users\RubensBezerra\AppData\Local\Temp\adoce-isolated-slicemenu-20260825'
  'C:\Users\RubensBezerra\AppData\Local\Temp\adoce-local-audit-20260826'
  'C:\Users\RubensBezerra\AppData\Local\Temp\adoce-photo-fix-codex-20260814'
  'C:\Users\RubensBezerra\AppData\Local\Temp\adoce-previa'
  'C:\Users\RubensBezerra\AppData\Local\Temp\adoce-qa-20260822'
  'C:\Users\RubensBezerra\AppData\Local\Temp\adoce-qa-e87bba4412504dbfbf949020546bdd16'
  'C:\Users\RubensBezerra\AppData\Local\Temp\adoce-trace-bb3825ae763d453dbb0f3866c92f0c87'
  'C:\Users\RubensBezerra\AppData\Local\Temp\clube-adoce-otp-hotfix-6a869d17'
)
# This script defaults to an inventory. -Apply performs the owner's explicitly
# requested cleanup; the primary workspace is never an allowed target.
$verified = @()
foreach ($candidate in $targets) {
  if (-not (Test-Path -LiteralPath $candidate)) { continue }
  $item = Get-Item -LiteralPath $candidate -Force
  if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw "Link recusado: $candidate" }
  $absolute = (Resolve-Path -LiteralPath $candidate).Path.TrimEnd('\')
  if ($absolute -ne $candidate.TrimEnd('\') -or $absolute -eq $primary -or $absolute -eq [IO.Path]::GetPathRoot($absolute)) { throw "Destino recusado: $absolute" }
  $verified += $absolute
}
if (-not $Apply) { $verified; Write-Output 'Inventario apenas. Use -Apply para excluir os caminhos conferidos.'; exit 0 }
$results = @()
foreach ($absolute in $verified) {
  try {
    Remove-Item -LiteralPath $absolute -Recurse -Force -ErrorAction Stop
    $results += [pscustomobject]@{path=$absolute; removed=(-not (Test-Path -LiteralPath $absolute)); error=$null}
  } catch { $results += [pscustomobject]@{path=$absolute; removed=$false; error=$_.Exception.Message} }
}
$results | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath (Join-Path $primary 'entregas/remocao-pastas-resultado-20261008.json') -Encoding utf8
$results | Group-Object removed | Select-Object Name,Count
$results | Where-Object {-not $_.removed} | Select-Object path,error
if ($results | Where-Object {-not $_.removed}) { exit 1 }
