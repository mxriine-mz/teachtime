# Installe TEAch Time sur un PC Windows : dépendances, Electron, modèle Whisper, raccourci sur le Bureau.
# Usage : clic droit > « Exécuter avec PowerShell », ou dans un terminal :
#   powershell -ExecutionPolicy Bypass -File scripts\installer.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Node.js n'est pas installé. Installe-le avec la commande suivante, puis relance ce script :" -ForegroundColor Yellow
    Write-Host "    winget install OpenJS.NodeJS.LTS" -ForegroundColor Yellow
    exit 1
}

Write-Host "1/4  Installation des dépendances (npm install)..."
npm install --no-fund --no-audit
if ($LASTEXITCODE -ne 0) { throw "npm install a échoué" }

Write-Host "2/4  Téléchargement d'Electron..."
node node_modules/electron/install.js
if (-not (Test-Path "node_modules\electron\dist\electron.exe")) { throw "Electron n'a pas été téléchargé" }

Write-Host "3/4  Téléchargement du modèle Whisper (environ 80 Mo)..."
node scripts/download-model.mjs
if ($LASTEXITCODE -ne 0) { throw "le téléchargement du modèle a échoué" }

Write-Host "4/4  Raccourci sur le Bureau..."
$electron = Join-Path $root 'node_modules\electron\dist\electron.exe'
$shell = New-Object -ComObject WScript.Shell
$lnk = $shell.CreateShortcut((Join-Path ([Environment]::GetFolderPath('Desktop')) 'TEAch Time.lnk'))
$lnk.TargetPath = $electron
$lnk.Arguments = '"' + $root + '"'
$lnk.WorkingDirectory = $root
$lnk.Description = "TEAch Time, My Cup of English"
$ico = Join-Path $root 'assets\icon-teachtime.ico'
if (Test-Path $ico) { $lnk.IconLocation = $ico }
$lnk.Save()

Write-Host ""
Write-Host "TEAch Time est installé. Double-clique sur le raccourci TEAch Time du Bureau." -ForegroundColor Green
Write-Host "Au premier lancement, choisis le même code d'urgence que sur ton autre PC."
