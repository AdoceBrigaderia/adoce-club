#requires -Version 5.1
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProjectRoot = (Get-Location).Path
$TargetRepository = "https://github.com/AdoceBrigaderia/adoce-club.git"
$TargetRemote = "fonte-oficial"
$ExpectedBranchPrefix = "fonte-oficial/portal-adoce-2026-07-25"
$Stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$LogFile = Join-Path $ProjectRoot ("CONTINUACAO_FONTE_OFICIAL_" + $Stamp + ".txt")

function Write-Log {
    param([string]$Message)
    $line = ("[{0}] {1}" -f (Get-Date -Format "HH:mm:ss"), $Message)
    Write-Host $line
    Add-Content -LiteralPath $LogFile -Value $line -Encoding UTF8
}

function Run-Git {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments,
        [switch]$AllowFailure
    )

    $previousPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"

    try {
        $output = & git @Arguments 2>&1
        $exitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousPreference
    }

    foreach ($line in @($output)) {
        $text = [string]$line
        Write-Host $text
        Add-Content -LiteralPath $LogFile -Value $text -Encoding UTF8
    }

    if (($exitCode -ne 0) -and (-not $AllowFailure)) {
        throw ("Falha ao executar: git " + ($Arguments -join " "))
    }

    return @{
        ExitCode = $exitCode
        Output = @($output)
    }
}

Write-Host ""
Write-Host "CONTINUACAO DA CONSOLIDACAO - PORTAL ADOCE" -ForegroundColor Cyan
Write-Host ("Projeto: " + $ProjectRoot)
Write-Host ""

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw "Git nao foi encontrado."
}

if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot ".git"))) {
    throw "Execute este script dentro de D:\Clube Adoce."
}

$currentBranchResult = Run-Git -Arguments @("branch", "--show-current")
$currentBranch = (($currentBranchResult.Output | Out-String).Trim())

if ([string]::IsNullOrWhiteSpace($currentBranch)) {
    throw "Nao foi possivel identificar a branch atual."
}

Write-Log ("Branch atual: " + $currentBranch)

if (-not $currentBranch.StartsWith($ExpectedBranchPrefix)) {
    Write-Host ""
    Write-Host "A branch atual nao e a branch criada para consolidacao." -ForegroundColor Yellow
    Write-Host ("Branch atual: " + $currentBranch)
    Write-Host ("Esperado: " + $ExpectedBranchPrefix)
    Write-Host ""
    $continue = Read-Host "Digite CONTINUAR para prosseguir mesmo assim"
    if ($continue.Trim().ToUpperInvariant() -ne "CONTINUAR") {
        Write-Host "Cancelado. Nenhuma alteracao foi enviada." -ForegroundColor Yellow
        exit 0
    }
}

Write-Log "Verificando arquivos muito grandes."

$largeFiles = Get-ChildItem -LiteralPath $ProjectRoot -Recurse -Force -File -ErrorAction SilentlyContinue |
    Where-Object {
        $_.FullName -notmatch "\.git\\" -and
        $_.FullName -notmatch "\\node_modules\\" -and
        $_.FullName -notmatch "\\dist\\" -and
        $_.FullName -notmatch "\\launch-dist\\" -and
        $_.Length -ge 90MB
    }

if ($largeFiles) {
    Write-Host ""
    Write-Host "ARQUIVOS ACIMA DE 90 MB FORAM ENCONTRADOS:" -ForegroundColor Red
    foreach ($file in $largeFiles) {
        Write-Host ("- {0} ({1:N2} MB)" -f $file.FullName, ($file.Length / 1MB))
        Add-Content -LiteralPath $LogFile -Value ("LARGE_FILE: " + $file.FullName) -Encoding UTF8
    }
    throw "O processo foi interrompido para evitar falha no GitHub."
}

Write-Log "Configurando o repositorio privado como remoto."

$remoteCheck = Run-Git -Arguments @("remote", "get-url", $TargetRemote) -AllowFailure

if ($remoteCheck.ExitCode -eq 0) {
    Run-Git -Arguments @("remote", "set-url", $TargetRemote, $TargetRepository) | Out-Null
}
else {
    Run-Git -Arguments @("remote", "add", $TargetRemote, $TargetRepository) | Out-Null
}

Write-Log "Remoto configurado."

# Remove do indice, sem apagar do computador, qualquer item sensivel que por acaso esteja rastreado.
$SensitiveTrackedPatterns = @(
    ".env",
    ".env.local",
    ".env.production",
    ".env.development",
    ".env.test",
    ".private",
    ".netlify",
    "node_modules",
    "dist",
    "launch-dist",
    "output",
    "outputs",
    "exports",
    ".codex-remote-attachments"
)

foreach ($pattern in $SensitiveTrackedPatterns) {
    Run-Git -Arguments @("rm", "-r", "--cached", "--ignore-unmatch", "--", $pattern) -AllowFailure | Out-Null
}

Write-Log "Preparando arquivos para commit."
Run-Git -Arguments @("add", "-A") | Out-Null

$stagedResult = Run-Git -Arguments @("diff", "--cached", "--name-only") -AllowFailure
$stagedFiles = @($stagedResult.Output | ForEach-Object { ([string]$_).Trim() } | Where-Object { $_ -ne "" })

$blockedStaged = @($stagedFiles | Where-Object {
    $_ -match '(^|/)\.env($|\.)' -or
    $_ -match '(^|/)\.private(/|$)' -or
    $_ -match '(^|/)node_modules(/|$)' -or
    $_ -match '(^|/)\.netlify(/|$)' -or
    $_ -match '\.(pem|key|pfx|p12)$'
})

if ($blockedStaged.Count -gt 0) {
    Write-Host ""
    Write-Host "ARQUIVOS PROIBIDOS FORAM PREPARADOS PARA COMMIT:" -ForegroundColor Red
    foreach ($item in $blockedStaged) {
        Write-Host ("- " + $item)
        Add-Content -LiteralPath $LogFile -Value ("BLOCKED_STAGED: " + $item) -Encoding UTF8
    }

    Run-Git -Arguments @("reset") -AllowFailure | Out-Null
    throw "O commit foi interrompido e os arquivos foram removidos da preparacao."
}

Write-Log ("Arquivos preparados: " + $stagedFiles.Count)

Write-Host ""
Write-Host "Nenhum deploy sera feito." -ForegroundColor Green
Write-Host "A proxima etapa cria um commit e envia somente esta branch ao repositorio privado."
Write-Host ""
$confirmation = Read-Host "Digite SIM para continuar"

if ($confirmation.Trim().ToUpperInvariant() -ne "SIM") {
    Run-Git -Arguments @("reset") -AllowFailure | Out-Null
    Write-Log "Operacao cancelada antes do commit."
    Write-Host "Cancelado. Nenhum commit ou push foi realizado." -ForegroundColor Yellow
    exit 0
}

if ($stagedFiles.Count -gt 0) {
    Run-Git -Arguments @(
        "commit",
        "-m",
        "chore: consolida fonte oficial do portal Adoce em 25/07/2026"
    ) | Out-Null
    Write-Log "Commit criado."
}
else {
    Write-Log "Nenhuma alteracao nova para commit."
}

Write-Log "Enviando a branch para o GitHub privado."

$pushResult = Run-Git -Arguments @(
    "push",
    "-u",
    $TargetRemote,
    ("HEAD:refs/heads/" + $currentBranch)
) -AllowFailure

if ($pushResult.ExitCode -ne 0) {
    Write-Host ""
    Write-Host "A branch foi preservada localmente, mas o push falhou." -ForegroundColor Yellow
    Write-Host ("Envie este arquivo: " + $LogFile)
    exit 2
}

Write-Log "Push concluido."

Write-Host ""
Write-Host "CONSOLIDACAO CONCLUIDA" -ForegroundColor Cyan
Write-Host "Repositorio: AdoceBrigaderia/adoce-club"
Write-Host ("Branch: " + $currentBranch)
Write-Host ("Diagnostico: " + $LogFile)
Write-Host ""
Write-Host "Nenhuma alteracao foi publicada no site de producao."
