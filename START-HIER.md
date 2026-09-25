# GamingHub V0.1 – Start und Bedienung

## Eigene Spielbilder

Games → Bearbeiten → Spielbild / Icon: JPG, PNG oder WebP bis 10 MB auswählen, die Vorschau prüfen und „Eintrag speichern“ drücken. GamingHub schneidet mittig auf 16:9 zu. Das Bild erscheint auf der Spielkarte und im Home-Dashboard. „Standardbild verwenden“ entfernt das eigene Bild nach dem Speichern. Ein erneuter Steam-Import behält eigene Bilder bei. Bilder werden mit der Bibliothek lokal gespeichert; bei erschöpftem Browserspeicher erscheint eine Fehlermeldung, und die Änderung gilt nur für die Sitzung.

## Discord-Servernachrichten

Im neuen Discord-Bereich steht eine Einrichtungshilfe. Unter https://discord.com/developers/applications eine Anwendung mit Bot anlegen, „Message Content Intent“ aktivieren und den Bot auf den eigenen Server einladen (Scope `bot`, Rechte `View Channels` und `Read Message History`; kein Administrator nötig). Den Bot-Token nur in GamingHubs Passwortfeld eingeben. Anschließend „Server laden“, Server und Textkanal auswählen. GamingHub liest bis zu 30 Nachrichten per HTTPS; der Aktualisieren-Button lädt erneut. Anhänge werden als Dateinamen dargestellt, Discord-Markdown und Erwähnungen als Text. Threads und Foren sind noch nicht enthalten.

Es werden keine Nachrichten gesendet. Token und geladene Nachrichten werden nicht dauerhaft gespeichert und beim Verlassen des Moduls verworfen. Ohne eingerichteten Bot konnte bisher kein echter Serverabruf getestet werden. Frontend-Build und Backend-Routenvalidierung sind geprüft.

Persönliche Chats sind noch nicht integriert: Der Server-Bot hat keinen Zugriff darauf. Ein Windows-Benachrichtigungsleser benötigt ein App-Paket mit `userNotificationListener` sowie die Windows-Zustimmung des Nutzers. Diese Paketierung fehlt im aktuellen Tauri-Entwicklungsstart. „Persönliche Chats in Discord öffnen“ öffnet deshalb aktuell Discord im Browser. Eine vollständige private Chat-Historie ist auch über Benachrichtigungen nicht verfügbar.

## Steam-Spielzeit und Achievements

Im Game Launcher erscheint auf jeder Steam-Spielkarte die gespeicherte Steam-Spielzeit sowie das Datum „Zuletzt gespielt“. Das verknüpfte Profil ist `76561199838638815`. „Spielzeiten aktualisieren“ liest den lokalen Steam-Datenstand erneut. Steam kann diesen erst nach Spielende aktualisieren; fehlende Werte werden als unbekannt angezeigt. Diese historischen Zeiten werden nicht zu den separat aufgezeichneten GamingHub-Sessions addiert.

Auf einer Spielkarte „Achievements importieren“ aufklappen. Einen persönlichen Steam Web API-Schlüssel direkt in das Passwortfeld eingeben und „Achievements von Steam laden“ drücken. Schlüsselverwaltung: https://steamcommunity.com/dev/apikey . Den Schlüssel nicht im Chat teilen. GamingHub sendet ihn ausschließlich für diesen Abruf per HTTPS an Steam und speichert ihn nicht. Das Eingabefeld wird beim Abruf geleert.

Die importierten Erfolge mit Freischaltdatum werden lokal je Profil und Spiel gespeichert. Der Importzeitpunkt bleibt sichtbar. Bei einem fehlgeschlagenen neuen Abruf bleibt der vorherige Import erhalten. Private Spieldetails oder Spiele ohne Achievement-Unterstützung können keine Liste liefern. Der Abruf verändert keine Achievements in Steam.

Geprüft: Frontend-Build, Profilvalidierung, Achievement-Antwortverarbeitung und Lesen der echten lokalen Spielzeiten. Ein authentifizierter Achievement-Abruf ist ohne den persönlichen Schlüssel noch nicht getestet.

Stand: 12. September 2026. GamingHub bietet einen EXE-Launcher, Steam-Import, Live-Messwerte und lokale Sessionzusammenfassungen. Das Projekt verwendet Tauri 2, React und TypeScript. App-Kennung: `com.anton.gaminghub`.

## App starten

Öffne PowerShell:

```powershell
cd 'C:\Users\anton\Documents\Codex\2026-09-11\ja-genau-das-blockiert-dich-berhaupt\outputs\gaminghub'
npm.cmd run tauri dev
```

Lass das Terminal während der Entwicklung geöffnet. Beenden mit Strg+C. Starte nur eine Sitzung gleichzeitig, da der Entwicklungsserver Port 1420 verwendet. Falls Befehle nach einer Installation nicht gefunden werden, öffne PowerShell neu. Alternativ für die aktuelle Sitzung:

```powershell
$env:Path = 'C:\Program Files\nodejs;C:\Users\anton\.cargo\bin;' + $env:Path
```

Das Fenster heißt GamingHub und startet standardmäßig mit 1280 × 900 Pixeln. Es kann verkleinert und der Inhalt gescrollt werden.

## Was bereits funktioniert

1. **Home:** Persönliche Begrüßung, Uhrzeit, Bibliotheksübersicht und Verknüpfungen zu den Modulen.
2. **Games:** EXE-Dateien auswählen, bearbeiten und starten. Steam-Spiele gesammelt importieren und über Steam starten. Entfernen löscht nur den Eintrag, keine Dateien auf dem PC.
3. **Statistiken:** Bibliotheksanzahl und erfasste EXE-Sessions mit Laufzeit, durchschnittlicher CPU-/GPU-Auslastung und Spitzenwerten. Steam-Starts werden noch nicht als Sessions erfasst.
4. **Einstellungen:** Anzeigename und Akzentfarbe (Mint oder Violett) ändern. Änderungen werden automatisch lokal gespeichert.
5. **Navigation:** Alle sechs Module sind über eine gemeinsame Registrierung verbunden.
6. **PC-Monitoring:** CPU, RAM und NVIDIA-GPU-Auslastung im Zwei-Sekunden-Takt, GPU-Temperatur, VRAM und Verlauf.
7. **Spotify:** Titelanzeige und Steuerung über die Windows-Mediensitzung der Spotify-Desktop-App. Spotify muss selbst angemeldet sein und eine Mediensitzung bereitstellen. Der Fall ohne Sitzung wurde getestet; die tatsächliche Wiedergabesteuerung noch nicht mit aktiver Spotify-Sitzung.

## Steam-Spiele hinzufügen

1. Links **Games** öffnen.
2. **Steam-Spiele importieren** anklicken.
3. **Steam-Spiele suchen** wählen.
4. Spiele einzeln anhaken oder **Alle sichtbaren auswählen** anklicken.
5. **Auswahl übernehmen** anklicken. Bereits verknüpfte Steam-Spiele werden aktualisiert, nicht doppelt angelegt.
6. Den Importbereich schließen. Die Karten zeigen **Über Steam starten**.

Die Suche liest Steam-Installationsdateien und die dort registrierten Bibliotheken. Nur installierte Spiele mit vorhandenem Spielordner werden angeboten. Bei externen Laufwerken müssen diese verbunden sein. Falls die Erkennung nichts findet, über **Bibliotheksordner auswählen …** den Steam-/SteamLibrary-Ordner oder dessen `steamapps`-Unterordner wählen. Ein später installierter Titel erscheint nach erneutem Durchsuchen.

Steam startet das Spiel über seine App-ID, einschließlich seiner normalen Anmeldung und eventuell erforderlicher Updates. Ein angenommener Startauftrag ist keine Bestätigung, dass das Spiel bereits läuft. Manuelle EXE-Einträge bleiben getrennt. Bei verschobenen Installationen erneut importieren, um die Pfade zu aktualisieren.

Auf diesem PC wurden acht installierte Spiele ohne Lesefehler erkannt und im Desktopfenster als Steam-Karten bestätigt. Bei `skate.` meldet das Manifest einen erforderlichen Update-Schritt.

## Was noch nicht angebunden ist

- Automatische Spielzeit-Erfassung für Steam-Starts und Launcher, die an andere Prozesse übergeben.
- CPU-Temperatur und Unterstützung weiterer GPU-Hersteller.
- Spotify-Webplayer, Playlist-Suche und Spotify-Kontobibliothek.
- Release-Installer, Export/Backup und Schutz vor mehreren gleichzeitig geöffneten Hub-Instanzen.
- Minecraft ist nicht Bestandteil dieser Version.

## Speicherung

Bibliothek und Einstellungen werden in `localStorage` gespeichert, ohne Cloud-Synchronisierung. Browser-Vorschau und Tauri-App besitzen getrennte Speicher. Eine spätere Release-App kann ebenfalls einen anderen Speicherbereich als die Entwicklungsversion verwenden. Das ist noch kein Datenbank- oder Export-System. Bei nicht verfügbaren Speichermöglichkeiten zeigt die Oberfläche einen Hinweis und bleibt für die aktuelle Sitzung nutzbar.

EXE-Sessions werden separat unter dem Tauri-App-Datenordner in `sessions.json` gespeichert, ungefähr alle zehn Sekunden. Bei Schließen/Absturz endet die Aufzeichnung bei der zuletzt gespeicherten Messung. Die laufenden Spiele werden nicht beendet. Messwerte beziehen sich auf den gesamten PC.

## Modularer Aufbau

- `src/App.tsx`: App-Rahmen, Navigation, Uhr und gemeinsamer Zustand.
- `src/modules/index.ts`: Zentrale Registrierung aller Seiten. Spätere Module werden hier ergänzt.
- `src/modules/home.tsx`: Dashboard.
- `src/modules/games.tsx`: Lokale Bibliotheksverwaltung.
- `src/modules/pc-monitor.tsx`: Live-Messdaten und Verlauf.
- `src/modules/music.tsx`: Spotify-Windows-Steuerung.
- `src/modules/statistics.tsx`: Bibliothekszählung und EXE-Sessionverlauf.
- `src/components/SteamImport.tsx`: Suche, Auswahl und Sammelimport.
- `src/services/steam.ts`: Duplikatfreier Steam-Import in die lokale Bibliothek.
- `src-tauri/src/services/steam.rs`: Steam-Erkennung, begrenzter KeyValues-Parser und validierter Steam-Start.
- `src-tauri/src/services/`: Native Hardwaremessung, Sessionverfolgung und Musiksteuerung.
- `src/modules/settings.tsx`: Profil und Akzentfarbe.
- `src/modules/types.ts`: Gemeinsame Datentypen.
- `src/hooks/useSavedState.ts`: Lokale Speicherung mit Validierung und Fehlerhinweisen.
- `src/components/ui.tsx`: Gemeinsame Überschriften, leere Zustände und Messwertkarten.
- `src/App.css`: Gestaltung und Anpassung an kleinere Fenster.
- `src-tauri/`: Nativer Rust-Teil und Fensterkonfiguration. Der bereits getestete Rust-Beispielbefehl bleibt vorhanden; sein Eingabeformular wurde durch das Dashboard ersetzt.

Die Modulregistrierung ist ein Erweiterungspunkt im Quellcode, noch kein System zum dynamischen Installieren externer Plugins.

## Prüfung am 11. September 2026

- TypeScript-Prüfung und Vite-Produktionsbuild erfolgreich.
- Nativer Entwicklungsbuild nach Anpassung der Fensterkonfiguration erfolgreich.
- Windows meldet ein reagierendes GamingHub-Fenster.
- Dashboard im Browser visuell geprüft, zusätzlich bei 800 × 600 Pixeln.
- Alle sechs Module über die Navigation aufgerufen.
- Testeintrag hinzugefügt, erfolglose Suche geprüft, Neuladen mit erhaltenem Eintrag geprüft und eigenen Testeintrag wieder entfernt.
- Anzeigename und Violett-Akzent gespeichert, Neuladen geprüft, anschließend Testprofil auf Anton/Mint zurückgesetzt.
- Browser-Konsole ohne Warnungen oder Fehler zum Prüfzeitpunkt.
- Die UI-Interaktionen wurden in der Browser-Vorschau geprüft, nicht automatisiert im nativen WebView. Die ursprüngliche React-Rust-Begrüßung hat der Nutzer zuvor im Desktopfenster erfolgreich getestet.

## Nächster Ausbauschritt

Als Nächstes kann die Prozessverfolgung für Steam-Spiele ergänzt und die Spotify-Steuerung mit einer aktiven Sitzung geprüft werden.

## Prüfung des Steam-Linkings am 12. September 2026

- TypeScript- und Frontend-Build erfolgreich; nativer Entwicklungsbuild läuft.
- Vier Rust-Tests für Parser, fehlerhafte Dateien, numerische Start-URI und mehrere Bibliotheken erfolgreich.
- Zwei Importtests für Duplikate, bestehende manuelle Einträge, umgezogene Bibliotheken und erhaltene benutzerdefinierte Namen erfolgreich.
- Echter Bibliotheksscan: acht Spiele, eine Bibliothek, keine Warnungen.
- Desktopprüfung: Suchergebnisse und anschließend alle acht Steam-Karten sichtbar.
- Der Start eines echten Spiels wurde nicht als Teil der automatischen Prüfung ausgeführt.

`npm.cmd run build` prüft und baut nur das Frontend. `npm.cmd run tauri build` ist der spätere Release-Build mit Installationspaketen; er wurde für diesen Schritt nicht ausgeführt.
