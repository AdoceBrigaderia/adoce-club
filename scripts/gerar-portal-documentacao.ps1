$ErrorActionPreference = 'Stop'
$node = if (Get-Command node -ErrorAction SilentlyContinue) { 'node' } else { 'D:\DevTools\node-v24.16.0-win-x64\node.exe' }
& $node "$PSScriptRoot\gerar-portal-documentacao.js"
