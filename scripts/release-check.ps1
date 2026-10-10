$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$package = Get-Content -Raw (Join-Path $root "package.json") | ConvertFrom-Json
$tauri = Get-Content -Raw (Join-Path $root "src-tauri\tauri.conf.json") | ConvertFrom-Json
$cargoVersion = (Select-String -Path (Join-Path $root "src-tauri\Cargo.toml") -Pattern '^version\s*=\s*"([^"]+)"').Matches[0].Groups[1].Value
if ($package.version -ne $tauri.version -or $package.version -ne $cargoVersion) { throw "Versionsnummern stimmen nicht überein." }
if (-not $tauri.bundle.createUpdaterArtifacts) { throw "Signierte Update-Artefakte sind deaktiviert." }
if (-not $tauri.plugins.updater.pubkey) { throw "Updater-Public-Key fehlt." }
npm audit --audit-level=high
npm run build
cargo test --manifest-path (Join-Path $root "src-tauri\Cargo.toml")
Write-Host "Release-Check für GamingHub $($package.version) erfolgreich."
