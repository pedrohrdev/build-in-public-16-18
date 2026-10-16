param([Parameter(Mandatory = $true)][string]$AppDir)
$ErrorActionPreference = 'Stop'
$shell = New-Object -ComObject WScript.Shell
$desktop = [Environment]::GetFolderPath('Desktop')
$shortcut = $shell.CreateShortcut((Join-Path $desktop 'Meus habitos.lnk'))
$shortcut.TargetPath = Join-Path $AppDir 'scripts\abrir.bat'
$shortcut.WorkingDirectory = $AppDir
$shortcut.IconLocation = Join-Path $AppDir 'app\favicon.ico'
$shortcut.Description = 'Abre seu painel pessoal de habitos no navegador'
$shortcut.Save()
