$ErrorActionPreference = 'Stop'
$app = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $app
if (!(Test-Path -LiteralPath (Join-Path $app '.env.local'))) {
    throw 'Execute npm run setup:windows primeiro para configurar seus dados.'
}
if (!(Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
    throw 'Instale o Node.js LTS e abra o atalho novamente.'
}
$url = 'http://localhost:3618'
function Test-Painel {
    try {
        $null = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
        return $true
    } catch { return $false }
}
if (!(Test-Painel)) {
    # Uma janela separada mantem o servidor ativo; feche-a para parar.
    Start-Process -FilePath $env:ComSpec -WorkingDirectory $app -ArgumentList '/k', 'npm.cmd run dev -- --hostname 127.0.0.1'
    $ready = $false
    for ($i = 0; $i -lt 90; $i++) {
        if (Test-Painel) { $ready = $true; break }
        Start-Sleep -Seconds 1
    }
    if (!$ready) { throw 'O painel nao iniciou. Confira o erro na janela do servidor.' }
}
Start-Process $url
