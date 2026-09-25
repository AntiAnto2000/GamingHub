import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Empty, Heading, Metrics } from "../components/ui";
import type { ModuleProps } from "./types";
import { recentMessages, authorColor } from "./discord";
import { useNative } from "../services/native";
import { controlEmbeddedMusic, subscribeEmbeddedMusic, type EmbeddedMusicState } from "../services/musicBridge";
import UtilityWidget from "../components/UtilityWidget";

interface HomeMusicStatus {
  connected: boolean; title: string; artist: string; album: string; playing: boolean;
  canToggle: boolean; canNext: boolean; canPrevious: boolean; canStop: boolean;
}

function HomeMusicPlayer({ navigate }: { navigate: (id: string) => void }) {
  const { native } = useNative();
  const [status, setStatus] = useState<HomeMusicStatus | null>(null);
  const [embedded, setEmbedded] = useState<EmbeddedMusicState>({ active: false, title: "", artist: "", album: "", playing: false });
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  async function refresh() {
    if (!native) return;
    try { setStatus(await invoke<HomeMusicStatus>("music_status")); setError(""); }
    catch (reason) { setError(String(reason)); }
  }
  useEffect(() => {
    if (!native) return;
    let cancelled = false;
    let timer = 0;
    const poll = async () => { await refresh(); if (!cancelled) timer = window.setTimeout(poll, 2500); };
    void poll();
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [native]);
  useEffect(() => subscribeEmbeddedMusic(setEmbedded), []);
  const visible = embedded.active ? {
    connected: true, title: embedded.title, artist: embedded.artist, album: embedded.album,
    playing: embedded.playing, canToggle: true, canNext: true, canPrevious: true, canStop: true,
  } : status;
  async function control(action: "previous" | "toggle" | "stop" | "next") {
    setBusy(action); setError("");
    try {
      if (embedded.active) await controlEmbeddedMusic(action);
      else { await invoke("music_control", { action }); await refresh(); }
    }
    catch (reason) { setError(String(reason)); }
    finally { setBusy(""); }
  }
  return <section className="panel music-teaser home-mini-player">
    <div className="mini-player-top"><span className="eyebrow">DEIN SOUNDTRACK</span><span className={"mini-player-state " + (visible?.playing ? "playing" : "")}>{visible?.connected ? (visible.playing ? "WIEDERGABE" : "PAUSIERT") : "OFFLINE"}</span></div>
    <div className="mini-player-track"><div className="record" aria-hidden="true">♫</div><div><h2>{visible?.title || "Spotify ist bereit"}</h2><p>{visible?.connected ? [visible.artist, visible.album].filter(Boolean).join(" · ") || "Spotify" : "Öffne Spotify und starte einen Titel."}</p></div></div>
    <div className="mini-player-controls" aria-label="Musiksteuerung">
      <button aria-label="Vorheriger Titel" title="Zurück" disabled={!visible?.canPrevious || !!busy} onClick={() => void control("previous")}>⏮</button>
      <button className="mini-main-control" aria-label={visible?.playing ? "Wiedergabe stoppen" : "Wiedergabe starten"} title={visible?.playing ? "Stopp" : "Start"} disabled={!!busy || (visible?.playing ? !visible.canStop : !visible?.canToggle)} onClick={() => void control(visible?.playing ? "stop" : "toggle")}>{busy === "toggle" || busy === "stop" ? "…" : visible?.playing ? "■" : "▶"}</button>
      <button aria-label="Nächster Titel" title="Weiter" disabled={!visible?.canNext || !!busy} onClick={() => void control("next")}>⏭</button>
    </div>
    {error && <p className="mini-player-error" role="alert">{error}</p>}
    <div className="mini-player-links">{!visible?.connected && native && <button className="text-button" onClick={() => void invoke("open_spotify").then(refresh).catch(reason => setError(String(reason)))}>Spotify öffnen</button>}<button className="text-button" onClick={() => navigate("music")}>Musikbereich öffnen ↗</button></div>
  </section>;
}
const cockpitChoices = [
  { id: "favorites", label: "Favoriten", icon: "★", page: "games" },
  { id: "library", label: "Bibliothek", icon: "▤", page: "apps" },
  { id: "music", label: "Musik", icon: "♫", page: "music" },
  { id: "system", label: "System", icon: "▣", page: "pc" },
  { id: "recent", label: "Zuletzt gestartet", icon: "↶", page: "games" },
  { id: "clock", label: "Uhr", icon: "◷", page: "home" },
  { id: "calendar", label: "Kalender", icon: "▦", page: "home" },
  { id: "alarm", label: "Wecker", icon: "◉", page: "home" },
  { id: "stopwatch", label: "Stoppuhr", icon: "◴", page: "home" },
  { id: "timer", label: "Timer", icon: "⌛", page: "home" },
] as const;
export default function Home({ settings, setSettings, games, navigate }: ModuleProps) {
  const [customizing, setCustomizing] = useState(false);
  const favorites = games.filter(game => game.favorite);
  const recentGames = [...games].filter(game => game.lastLaunchedAt).sort((a,b) => (b.lastLaunchedAt || 0) - (a.lastLaunchedAt || 0));
  const lastGame = recentGames[0];
  const hour = new Date().getHours();
  const greeting = hour < 5 ? "Gute Nacht" : hour < 11 ? "Guten Morgen" : hour < 18 ? "Hallo" : "Guten Abend";
  const show = (key: "showHero" | "showSystem" | "showLibrary" | "showMusic" | "showDiscord") => settings[key] !== false;
  const widgetIds = settings.cockpitWidgets || ["favorites", "library", "music", "system", "recent"];
  const toggleWidget = (id: string) => setSettings({ ...settings, cockpitWidgets: widgetIds.includes(id) ? widgetIds.filter(item => item !== id) : [...widgetIds, id] });
  const moveWidget = (id: string, direction: -1 | 1) => {
    const next = [...widgetIds]; const from = next.indexOf(id); const to = from + direction;
    if (from < 0 || to < 0 || to >= next.length) return;
    [next[from], next[to]] = [next[to], next[from]]; setSettings({ ...settings, cockpitWidgets: next });
  };
  return (
    <>
      <Heading
        eyebrow="DEIN ÜBERBLICK"
        title={`${greeting}, ${settings.name.trim() || "Gamer"}.`}
      >
        Alles für dein nächstes Spiel. An einem Ort.
      </Heading>
      {!settings.focusMode && <><section className="hub-cockpit" aria-label="GamingHub 0.4 Schnellübersicht">
        <div className="cockpit-title"><div><span className="eyebrow">DEIN COCKPIT</span><strong>Alles Wichtige auf einen Blick</strong><small>Stelle dir deine Schnellübersicht selbst zusammen.</small></div><button className="cockpit-edit" onClick={() => setCustomizing(value => !value)}>{customizing ? "Fertig" : "Anpassen"}</button></div>
        {widgetIds.map(id => {
          const item = cockpitChoices.find(choice => choice.id === id); if (!item) return null;
          if (["clock","calendar","alarm","stopwatch","timer"].includes(id)) return <UtilityWidget key={id} id={id as "clock"|"calendar"|"alarm"|"stopwatch"|"timer"}/>;
          const value = id === "favorites" ? String(favorites.length) : id === "library" ? String(games.length) : id === "recent" ? (lastGame?.name || "Noch keines") : id === "music" ? "Player" : "Live";
          const detail = id === "favorites" ? "Lieblingsspiele" : id === "library" ? "Einträge" : id === "recent" ? (lastGame ? new Date(lastGame.lastLaunchedAt!).toLocaleDateString("de-DE") : "Spiel starten") : id === "music" ? "Musik öffnen" : "Werte prüfen";
          return <button className="cockpit-widget" key={id} onClick={() => navigate(item.page)}><span>{item.icon}</span><strong>{value}</strong><small>{detail}</small></button>;
        })}
      </section>{customizing && <section className="cockpit-customizer panel"><div><strong>Cockpit gestalten</strong><small>Widgets einblenden und Reihenfolge ändern</small></div>{cockpitChoices.map(item => { const active=widgetIds.includes(item.id); const index=widgetIds.indexOf(item.id); return <div className="cockpit-option" key={item.id}><label><input type="checkbox" checked={active} onChange={() => toggleWidget(item.id)}/><span>{item.icon}</span>{item.label}</label><div><button disabled={!active || index===0} onClick={() => moveWidget(item.id,-1)}>↑</button><button disabled={!active || index===widgetIds.length-1} onClick={() => moveWidget(item.id,1)}>↓</button></div></div>})}</section>}</>}
      {show("showSystem") && !settings.focusMode && <><div className="section-title">
        <h2>Dein System</h2>
        <button className="text-button" onClick={() => navigate("pc")}>
          PC-Monitoring ↗
        </button>
      </div>
      <Metrics /></>}
      <div className="home-bottom">
        {show("showLibrary") && !settings.focusMode && <section className="panel">
          <div className="section-title inset">
            <h2>Deine Bibliothek</h2>
            <span className="pill neutral">
              {games.length} {games.length === 1 ? "Eintrag" : "Einträge"}
            </span>
          </div>
          {games.length ? (
            <div className="library-preview">
              {(favorites.length ? favorites : games).slice(0, 3).map((g) => (
                <button
                  key={g.id}
                  className="preview-game"
                  onClick={() => navigate("games")}
                >
                  <span className="game-letter">
                    {g.cover ? <img className="game-thumb" src={g.cover} alt="" /> : g.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span>
                    {g.name}
                    <small>{g.favorite ? "★ Favorit" : "In der Bibliothek öffnen"}</small>
                  </span>
                  <span>↗</span>
                </button>
              ))}
            </div>
          ) : (
            <Empty
              icon="＋"
              title="Platz für deine Favoriten"
              action={
                <button className="secondary" onClick={() => navigate("games")}>
                  Erstes Spiel hinzufügen
                </button>
              }
            >
              Deine Bibliothek beginnt mit einem Spiel.
            </Empty>
          )}
        </section>}
        {show("showMusic") && <HomeMusicPlayer navigate={navigate} />}
        {show("showDiscord") && !settings.focusMode && <section className="panel home-discord-panel">
          <div className="discord-home-visual"><span>◉</span><i></i><b></b></div>
          <div className="section-title inset"><h2>Discord</h2><span className="pill neutral">Letzte Nachrichten</span></div>
          {recentMessages.length ? <div className="home-discord-list">{recentMessages.slice(0, 30).map(m => {const author=m.author.global_name || m.author.username; return <article key={m.id}><strong style={{color:authorColor(author)}}>{author}</strong><small>{new Date(m.timestamp).toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"})}</small><p>{m.content || "Anhang oder Systemnachricht"}</p></article>})}</div> : <p className="muted">Lade Nachrichten zuerst im Discord-Bereich.</p>}
          <button className="text-button" onClick={() => navigate("discord")}>Discord öffnen ↗</button>
        </section>}
      </div>
    </>
  );
}
