import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Empty, Heading, SelectMenu } from "../components/ui";
import { useNative, duration } from "../services/native";
import type { ModuleProps, Game } from "./types";
import SteamImport from "../components/SteamImport";
import GameImagePicker from "../components/GameImagePicker";
import SteamStats, { useSteamTimes } from "../components/SteamStats";
export default function Games({ games, setGames, settings, libraryKind = "steam" }: ModuleProps) {
  const hub = useNative();
  const visibleGames = games.filter(g => libraryKind === "steam" ? g.steamAppId !== undefined : g.steamAppId === undefined);
  const steamTimes = useSteamTimes(hub.native, settings.steamId);
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [path, setPath] = useState("");
  const [cover, setCover] = useState<string | undefined>();
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "favorites">("all");
  const [sort, setSort] = useState<"name" | "recent" | "random">("name");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [steamOpen, setSteamOpen] = useState(false);
  const editingSteam =
    games.find((g) => g.id === editing)?.steamAppId !== undefined;
  const filtered = visibleGames.filter((g) =>
    (filter === "all" || g.favorite) && [g.name, ...(g.tags || []), g.notes || ""].join(" ")
      .toLocaleLowerCase("de-DE").includes(query.toLocaleLowerCase("de-DE")),
  ).sort((a, b) => sort === "recent" ? (b.lastLaunchedAt || 0) - (a.lastLaunchedAt || 0) : sort === "random" ? a.id.localeCompare(b.id) : a.name.localeCompare(b.name, "de"));
  function edit(game?: Game) {
    setEditing(game?.id ?? null);
    setName(game?.name ?? "");
    setPath(game?.path ?? "");
    setCover(game?.cover);
    setTags((game?.tags || []).join(", "));
    setNotes(game?.notes || "");
    setAdding(true);
    setSteamOpen(false);
    setError("");
  }
  async function pick() {
    setBusy("pick");
    setError("");
    try {
      const selected = await invoke<string | null>("pick_game");
      if (selected) {
        setPath(selected);
        if (!name)
          setName(
            selected
              .split(/[\\/]/)
              .pop()!
              .replace(/\.exe$/i, ""),
          );
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy("");
    }
  }
  async function launch(game: Game) {
    setBusy(game.id);
    setError("");
    setMessage("");
    try {
      if (game.steamAppId !== undefined) {
        await invoke("launch_steam", {
          appId: game.steamAppId,
          library: game.steamLibrary,
        });
        setMessage(
          `Startauftrag für ${game.name} an Steam übergeben. Bitte dort gegebenenfalls anmelden oder das Update abschließen. Die GamingHub-Spielzeit wird für Steam-Starts noch nicht erfasst.`,
        );
        setGames(old => old.map(item => item.id === game.id ? { ...item, lastLaunchedAt: Date.now() } : item));
        return;
      }
      await invoke("launch_game", {
        gameId: game.id,
        name: game.name,
        path: game.path,
      });
      setMessage(`${game.name} gestartet. Die Session wird aufgezeichnet.`);
      setGames(old => old.map(item => item.id === game.id ? { ...item, lastLaunchedAt: Date.now() } : item));
      await hub.refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy("");
    }
  }
  async function finish(id: string) {
    setBusy(id);
    setError("");
    try {
      await invoke("finish_session", { id });
      setMessage("Aufzeichnung beendet. Das Programm läuft weiter.");
      await hub.refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <Heading eyebrow={libraryKind === "steam" ? "STEAM-BIBLIOTHEK" : "DEINE APPS"} title={libraryKind === "steam" ? "Steam" : "Apps"}>
        {libraryKind === "steam" ? "Starte deine Steam-Spiele direkt und behalte deine Sessions im Blick." : "Verwalte eigene Programme und Microsoft-Store-Apps an einem Ort."}
      </Heading>
      {!hub.native && (
        <p className="notice">
          Dateiauswahl und Programmstart sind im GamingHub-Desktopfenster
          verfügbar.
        </p>
      )}
      {hub.storageError && (
        <p role="alert" className="notice">
          {hub.storageError}
        </p>
      )}
      <div className="toolbar">
        <label className="search">
          ⌕{" "}
          <input
            aria-label="Bibliothek durchsuchen"
            placeholder="Bibliothek durchsuchen …"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <SelectMenu label="Bibliothek filtern" value={filter} options={[{value:"all",label:"Alle Einträge"},{value:"favorites",label:"Nur Favoriten"}]} onChange={setFilter}/>
        <SelectMenu label="Bibliothek sortieren" value={sort} options={[{value:"name",label:"Name A–Z"},{value:"recent",label:"Zuletzt gestartet"},{value:"random",label:"Zufallsauswahl"}]} onChange={setSort}/>
        {sort === "random" && filtered.length > 0 && <button className="secondary" onClick={() => { const pick = filtered[Math.floor(Math.random() * filtered.length)]; setMessage(`Wie wäre es mit ${pick.name}?`); }}>🎲 Spiel wählen</button>}
        {libraryKind === "steam" && <button
          className="secondary"
          disabled={!hub.native || !!busy}
          onClick={() => {
            setSteamOpen(!steamOpen);
            setAdding(false);
          }}
        >
          Steam-Spiele importieren
        </button>}
        {libraryKind === "apps" && <button
          className="primary"
          onClick={() => (adding ? setAdding(false) : edit())}
        >
          {adding ? "Schließen" : "＋ Spiel hinzufügen"}
        </button>}
      </div>
      {steamOpen && (
        <SteamImport
          games={games}
          setGames={setGames}
          onClose={() => setSteamOpen(false)}
        />
      )}
      {libraryKind === "steam" && visibleGames.length > 0 && <section className="panel steam-time-toolbar">
        <div className="steam-time-copy"><strong>Steam-Spielzeit & Achievements</strong><p className="muted">{settings.steamId ? `Profil ${settings.steamId}` : "Kein Steam-Profil ausgewählt"}</p><p role="status">{steamTimes.status || "Steam-Daten werden beim Öffnen automatisch gelesen."}</p></div>
        <div className="steam-time-footer"><small>Automatisch alle 10 Minuten</small><button className="secondary compact-button" disabled={!hub.native || steamTimes.busy} onClick={steamTimes.refresh}>{steamTimes.busy ? "Aktualisiert …" : "Jetzt aktualisieren"}</button></div>
      </section>}
      {adding && (
        <form
          className="panel form-panel"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            const entry = {
              ...games.find((g) => g.id === editing),
              id: editing ?? crypto.randomUUID(),
              name: name.trim(),
              path: path.trim(),
              cover,
              tags: tags.split(",").map(tag => tag.trim()).filter(Boolean).slice(0, 12),
              notes: notes.trim().slice(0, 1000),
            };
            setGames((old) =>
              editing
                ? old.map((g) => (g.id === editing ? entry : g))
                : [...old, entry],
            );
            setAdding(false);
            setMessage(`${entry.name} gespeichert.`);
          }}
        >
          <h2>{editing ? "Eintrag bearbeiten" : "Neuer Bibliothekseintrag"}</h2>
          <GameImagePicker value={cover} onChange={setCover} />
          <label>
            Name
            <input
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            {editingSteam
              ? "Steam-Installationsordner"
              : "Programmdatei (.exe)"}
            <input
              readOnly={editingSteam}
              maxLength={2000}
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="C:\Spiele\Spiel.exe"
            />
          </label>
          <button
            className="secondary"
            type="button"
            disabled={editingSteam || !hub.native || !!busy}
            onClick={pick}
          >
            {busy === "pick" ? "Dateiauswahl geöffnet …" : "Datei auswählen …"}
          </button>
          <label>Tags <input maxLength={160} value={tags} onChange={e => setTags(e.target.value)} placeholder="Co-op, Story, Entspannt" /></label>
          <label>Notizen <textarea maxLength={1000} rows={4} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Eigene Notizen, Builds oder Ziele …" /></label>
          <p className="muted">
            {editingSteam ? (
              "Dieser Eintrag startet über Steam. Bei einem verschobenen Spiel bitte die Bibliothek erneut importieren."
            ) : (
              <>
                Wähle möglichst die eigentliche Spiel-EXE. Steam-/Epic-Launcher
                können den Start an einen anderen Prozess übergeben; dessen
                Spielzeit wird dann nicht automatisch erfasst. Keine
                Verknüpfungen oder Startargumente.
              </>
            )}
          </p>
          <button className="primary" type="submit" disabled={!name.trim()}>
            Eintrag speichern
          </button>
        </form>
      )}
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      <p className="feedback" role="status">
        {message}
      </p>
      {!games.length ? (
        <section className="panel">
          <Empty icon="▦" title="Deine Bibliothek ist noch leer">
          {libraryKind === "steam" ? "Importiere deine Steam-Spiele." : "Füge eine Programmdatei oder Store-App hinzu."}
          </Empty>
        </section>
      ) : filtered.length ? (
        <div className="game-grid">
          {filtered.map((g, i) => {
            const active = hub.sessions.find(
              (s) => s.gameId === g.id && s.status === "running",
            );
            return (
              <article className="panel game-card" key={g.id}>
                <button className={"favorite-button" + (g.favorite ? " active" : "")} aria-label={g.favorite ? `${g.name} aus Favoriten entfernen` : `${g.name} favorisieren`} title="Favorit" onClick={() => setGames(old => old.map(item => item.id === g.id ? { ...item, favorite: !item.favorite } : item))}>{g.favorite ? "★" : "☆"}</button>
                <div className={`game-cover cover-${i % 3}`}>
                  {g.cover ? <img className="custom-game-cover" src={g.cover} alt={g.name} /> : <span>{g.name.slice(0, 2).toUpperCase()}</span>}
                  <small>
                    {active
                      ? "SESSION AKTIV"
                      : g.steamAppId !== undefined
                        ? "STEAM"
                        : "DEINE BIBLIOTHEK"}
                  </small>
                </div>
                <div className="game-info">
                  <h2>{g.name}</h2>
                  {!!g.tags?.length && <div className="game-tags">{g.tags.map(tag => <span key={tag}>{tag}</span>)}</div>}
                  {g.steamAppId !== undefined && <SteamStats appId={g.steamAppId} steamId={settings.steamId} time={steamTimes.times.find(t => t.appId === g.steamAppId)} />}
                  <p className="path" title={g.path}>
                    {g.path || "Bitte Programmdatei hinterlegen"}
                  </p>
                  {g.notes && <p className="game-notes">{g.notes}</p>}
                  {active ? (
                    <>
                      <p className="feedback">
                        Läuft · {duration(active.durationSeconds)}
                      </p>
                      <button
                        className="secondary"
                        disabled={!!busy}
                        onClick={() => finish(active.id)}
                      >
                        Nur Aufzeichnung beenden
                      </button>
                    </>
                  ) : (
                    <button
                      className="primary launch"
                      disabled={
                        !hub.native ||
                        !g.path ||
                        !!busy ||
                        (g.steamAppId === undefined && !!hub.storageError)
                      }
                      onClick={() => launch(g)}
                    >
                      {busy === g.id
                        ? "Wird gestartet …"
                        : g.steamAppId !== undefined
                          ? "▶ Über Steam starten"
                          : "▶ Starten"}
                    </button>
                  )}
                  <div className="card-actions">
                    <button
                      className="text-button"
                      disabled={!!active || !!busy}
                      onClick={() => edit(g)}
                    >
                      Bearbeiten
                    </button>
                    <button
                      className="text-button remove"
                      disabled={!!active || !!busy}
                      aria-label={`${g.name} aus Bibliothek entfernen`}
                      onClick={() => {
                        setGames((old) =>
                          old.filter((item) => item.id !== g.id),
                        );
                        setMessage(`${g.name} aus der Bibliothek entfernt.`);
                      }}
                    >
                      Entfernen
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <Empty icon="⌕" title="Keine Treffer">
          Versuche einen anderen Suchbegriff.
        </Empty>
      )}
      <p className="muted">
        GamingHub misst die Laufzeit des gestarteten Prozesses. Lass den Hub
        geöffnet. Das Beenden einer Aufzeichnung schließt niemals dein Spiel.
        Steam-Starts werden an Steam übergeben und erzeugen noch keine
        GamingHub-Session.
      </p>
    </>
  );
}
