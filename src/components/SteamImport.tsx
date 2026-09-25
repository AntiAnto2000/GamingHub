import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { mergeSteamGames, type SteamScan } from "../services/steam";
import type { Game } from "../modules/types";
import type { Dispatch, SetStateAction } from "react";

export default function SteamImport({
  games,
  setGames,
  onClose,
}: {
  games: Game[];
  setGames: Dispatch<SetStateAction<Game[]>>;
  onClose: () => void;
}) {
  const [scan, setScan] = useState<SteamScan | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [folder, setFolder] = useState<string | null>(null);
  async function search(manual = false) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const chosen = manual
        ? await invoke<string | null>("pick_steam_folder")
        : folder;
      if (manual && !chosen) return;
      const result = await invoke<SteamScan>("scan_steam", { folder: chosen });
      setFolder(chosen);
      setScan(result);
      setSelected([]);
      setQuery("");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  const visible =
    scan?.games.filter((g) =>
      g.name
        .toLocaleLowerCase("de-DE")
        .includes(query.toLocaleLowerCase("de-DE")),
    ) ?? [];
  const allVisible =
    visible.length > 0 && visible.every((g) => selected.includes(g.appId));
  function importSelected() {
    const chosen = scan?.games.filter((g) => selected.includes(g.appId)) ?? [];
    setGames((old) => mergeSteamGames(old, chosen));
    setMessage(
      `${chosen.length} ${chosen.length === 1 ? "Steam-Eintrag wurde" : "Steam-Einträge wurden"} übernommen bzw. aktualisiert.`,
    );
    setSelected([]);
  }
  return (
    <section
      className="panel steam-import"
      aria-label="Steam-Spiele importieren"
    >
      <div className="section-title">
        <div>
          <span className="eyebrow">STEAM LINKING</span>
          <h2>Deine Steam-Spiele übernehmen</h2>
        </div>
        <button className="text-button" disabled={busy} onClick={onClose}>
          Schließen
        </button>
      </div>
      <p>
        GamingHub liest deine lokalen Steam-Bibliotheken. Keine zusätzliche
        Anmeldung nötig. Nur installierte Spiele werden angeboten.
      </p>
      <div className="steam-actions">
        <button className="primary" disabled={busy} onClick={() => search()}>
          {busy
            ? "Suche läuft …"
            : scan
              ? "Erneut durchsuchen"
              : "Steam-Spiele suchen"}
        </button>
        <button
          className="secondary"
          disabled={busy}
          onClick={() => search(true)}
        >
          Bibliotheksordner auswählen …
        </button>
      </div>
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      {scan && (
        <>
          <p className="muted">
            {scan.games.length} installierte Spiele · {scan.libraries.length}{" "}
            Bibliotheken geprüft
          </p>
          <details>
            <summary className="muted">
              Geprüfte Bibliotheken und Hinweise
            </summary>
            {scan.libraries.map((path) => (
              <p className="steam-path" key={path}>
                {path}
              </p>
            ))}
            {scan.warnings.map((warning, i) => (
              <p className="notice" key={i}>
                {warning}
              </p>
            ))}
          </details>
          {!scan.games.length ? (
            <p className="notice">
              Keine installierten Steam-Spiele gefunden. Prüfe, ob die Spiele
              installiert und ihre Laufwerke verbunden sind. Du kannst den
              Steam- oder SteamLibrary-Ordner auch selbst auswählen.
            </p>
          ) : (
            <>
              <label className="search">
                <input
                  aria-label="Gefundene Steam-Spiele filtern"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Gefundene Spiele filtern …"
                />
              </label>
              <div className="steam-actions">
                <button
                  className="text-button"
                  disabled={!visible.length || busy}
                  onClick={() =>
                    setSelected((old) =>
                      allVisible
                        ? old.filter(
                            (id) => !visible.some((g) => g.appId === id),
                          )
                        : [
                            ...new Set([
                              ...old,
                              ...visible.map((g) => g.appId),
                            ]),
                          ],
                    )
                  }
                >
                  {allVisible
                    ? "Sichtbare Auswahl aufheben"
                    : "Alle sichtbaren auswählen"}
                </button>
                <span className="muted">{selected.length} ausgewählt</span>
              </div>
              <div className="steam-results">
                {visible.map((game) => (
                  <label className="steam-result" key={game.appId}>
                    <input
                      type="checkbox"
                      checked={selected.includes(game.appId)}
                      disabled={busy}
                      onChange={(e) =>
                        setSelected((old) =>
                          e.target.checked
                            ? [...old, game.appId]
                            : old.filter((id) => id !== game.appId),
                        )
                      }
                    />
                    <span>
                      <strong>{game.name}</strong>
                      <small>
                        {game.updateRequired
                          ? "Update in Steam erforderlich · "
                          : ""}
                        {game.installDir}
                      </small>
                    </span>
                    <span className="pill neutral">
                      {games.some((g) => g.steamAppId === game.appId)
                        ? "Bereits verknüpft"
                        : "Neu"}
                    </span>
                  </label>
                ))}
                {!visible.length && (
                  <p className="muted">Keine Treffer für diesen Filter.</p>
                )}
              </div>
              <button
                className="primary"
                disabled={busy || !selected.length}
                onClick={importSelected}
              >
                Auswahl übernehmen ({selected.length})
              </button>
            </>
          )}
        </>
      )}
      <p className="feedback" role="status">
        {message}
      </p>
      <p className="muted">
        Bereits verknüpfte Steam-Spiele werden aktualisiert, nicht doppelt
        angelegt. Manuell hinzugefügte EXE-Einträge bleiben separat. Die
        automatische GamingHub-Spielzeitmessung für Steam-Starts folgt später.
      </p>
    </section>
  );
}
