# GamingHub Server Telemetry installieren

Die Mod ist ausschließlich für Fabric-Server mit Minecraft 26.2 vorgesehen. Auf den PCs der Spieler muss sie nicht installiert werden.

1. Fabric Loader 0.19.5 oder neuer und Fabric API für Minecraft 26.2 auf dem Server installieren.
2. `gaminghub-telemetry-mc26.2-0.1.1.jar` in den Ordner `mods` des Servers legen.
3. Server einmal starten. Dabei wird `config/gaminghub-telemetry.json` erzeugt.
4. Bei externen Servern in dieser Datei `bind` auf `0.0.0.0` setzen und TCP-Port 8765 nur für vertrauenswürdige Adressen freigeben.
5. Den erzeugten 48-stelligen Token im GamingHub-Server-Dashboard eingeben. Den Token niemals öffentlich teilen.

Andere Minecraft-Versionen werden von dieser JAR nicht unterstützt.
