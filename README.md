# GamingHub 1.0

GamingHub ist eine lokale Windows-Zentrale für Spiele, Apps, Musik, Discord, Minecraft-Server und PC-Monitoring.

## Highlights

- Universelle Bibliothek für Steam-Spiele und eigene Programme
- Sammlungen, Favoriten, Startargumente und exportierbare Spielprofile
- Gaming-Modus, globale Schnellleiste (`Strg+K`) und Command Center (`Strg+Umschalt+G`)
- Spotify-Suche, Playlists und persistenter Mini-Player
- Minecraft-/Fabric-Dashboard, Discord und Microsoft Store
- Lokale Spielsessions, Aktivitätsverlauf und Wochenrückblick
- Anpassbares Cockpit, Themes, Akzentfarben, Hintergründe und drei Ansichtsmodi
- Windows-Tray, Diagnose/Reparatur, lokale Backups und Crashprotokolle
- Signierter automatischer Updater

Persönliche Bibliotheken und Einstellungen bleiben lokal. Zugangsdaten werden nicht in Backups geschrieben und unterstützte Tokens liegen im Windows-Anmeldespeicher.

## Entwicklung

```powershell
npm install
npm run tauri dev
```

Vor einem Release:

```powershell
npm run release:check
```

Die Veröffentlichungsschritte und das signierte `latest.json`-Format stehen in `UPDATE-PUBLISHING.md`.
