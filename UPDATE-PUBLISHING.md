# GamingHub Updates veröffentlichen

Der Updater ist in Version 0.8 eingebaut und für das öffentliche Repository `AntiAnto2000/GamingHub` aktiviert.

## Release bauen

Die private Schlüsseldatei `.secrets/gaminghub-updater.key` niemals hochladen oder verschicken. Sie muss separat und sicher gesichert werden.

In PowerShell im GamingHub-Ordner:

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content -Raw -LiteralPath ".secrets\gaminghub-updater.key"
npm run tauri build
```

Tauri erstellt neben dem NSIS-Installer eine Signaturdatei. Installer und Signatur werden an ein GitHub Release angehängt.

## latest.json

```json
{
  "version": "0.8.0",
  "notes": "GamingHub 0.8 Early Access",
  "pub_date": "2026-09-25T12:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "INHALT_DER_SIG_DATEI",
      "url": "https://github.com/AntiAnto2000/GamingHub/releases/download/v0.8.0/GamingHub_0.8.0_x64-setup.exe"
    }
  }
}
```

`latest.json` ebenfalls als Release-Datei anhängen. Danach findet jede installierte Version ab 0.8 zukünftige Releases automatisch.
