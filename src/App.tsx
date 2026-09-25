import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { invoke } from "@tauri-apps/api/core";
import { modules } from "./modules";
import { useSavedState } from "./hooks/useSavedState";
import type { Game, Settings } from "./modules/types";
import "./App.css";
import { NativeProvider } from "./services/native";
import FirstRun from "./components/FirstRun";
import UtilityOverlay from "./components/UtilityOverlay";
import Changelog from "./components/Changelog";
import UpdateCenter from "./components/UpdateCenter";
export default function App() {
  return (
    <NativeProvider>
      <HubApp />
    </NativeProvider>
  );
}
function HubApp() {
  const savedSettings = (() => { try { return JSON.parse(localStorage.getItem("gaminghub.settings.v1") || "{}"); } catch { return {}; } })();
  const [active, setActive] = useState(window.location.pathname === "/callback" ? "music" : savedSettings.startPage || "home");
  const [order, setOrder] = useState<string[]>(() => { try { const v=JSON.parse(localStorage.getItem("gaminghub.moduleOrder.v1")||"[]"); return Array.isArray(v)&&v.every(x=>typeof x==="string")?v:[]; } catch { return []; } });
  const [dragged, setDragged] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState(false);
  const [now, setNow] = useState(new Date());
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [commandMessage, setCommandMessage] = useState("");
  const [online, setOnline] = useState(navigator.onLine);
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [games, setGames, gamesError] = useSavedState<Game[]>(
    "gaminghub.games.v1",
    [],
    (v) =>
      Array.isArray(v) &&
      v.every(
        (g) =>
          g &&
          typeof g.id === "string" &&
          typeof g.name === "string" &&
          typeof g.path === "string" &&
          (g.cover === undefined || (typeof g.cover === "string" && g.cover.startsWith("data:image/jpeg;base64,") && g.cover.length < 250000)) &&
          (g.favorite === undefined || typeof g.favorite === "boolean") &&
          (g.lastLaunchedAt === undefined || typeof g.lastLaunchedAt === "number") &&
          (g.tags === undefined || (Array.isArray(g.tags) && g.tags.every((tag: unknown) => typeof tag === "string"))) &&
          (g.notes === undefined || typeof g.notes === "string") &&
          (g.steamAppId === undefined ||
            (Number.isInteger(g.steamAppId) &&
              g.steamAppId > 0 &&
              g.steamAppId <= 4294967295 &&
              typeof g.steamLibrary === "string")),
      ),
  );
  const [settings, setSettings, settingsError] = useSavedState<Settings>(
    "gaminghub.settings.v1",
    { name: "Anton", accent: "mint" },
    (v) =>
      typeof v === "object" &&
      v !== null &&
      "name" in v &&
      typeof v.name === "string" &&
      "accent" in v &&
      ["mint", "violet", "ocean", "amber", "coral", "pink", "ice", "red"].includes(String(v.accent)),
  );
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    addEventListener("online", update); addEventListener("offline", update);
    return () => { removeEventListener("online", update); removeEventListener("offline", update); };
  }, []);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault(); setCommandOpen(value => !value);
      }
      if (event.key === "Escape") setCommandOpen(false);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const orderedModules = [...modules].sort((a,b) => { const ai=order.indexOf(a.id), bi=order.indexOf(b.id); return (ai<0?999:ai)-(bi<0?999:bi); });
  const commandResults = useMemo(() => {
    const q = commandQuery.trim().toLocaleLowerCase("de-DE");
    return {
      pages: orderedModules.filter(item => !q || item.label.toLocaleLowerCase("de-DE").includes(q)).slice(0, 5),
      games: games.filter(item => !q || item.name.toLocaleLowerCase("de-DE").includes(q)).slice(0, 6),
    };
  }, [commandQuery, games, orderedModules]);
  async function quickLaunch(game: Game) {
    setCommandMessage("");
    try {
      if (game.steamAppId !== undefined) await invoke("launch_steam", { appId: game.steamAppId, library: game.steamLibrary });
      else await invoke("launch_game", { gameId: game.id, name: game.name, path: game.path });
      setGames(old => old.map(item => item.id === game.id ? { ...item, lastLaunchedAt: Date.now() } : item));
      setCommandOpen(false);
    } catch (error) { setCommandMessage(String(error)); }
  }
  const current = modules.find((m) => m.id === active) ?? modules[0];
  const Page = current.component;
  const MusicPage = modules.find((module) => module.id === "music")!.component;
  const pageProps = {
    games,
    setGames,
    settings,
    setSettings,
    navigate: setActive,
  };
  return (
    <div className="app" data-accent={settings.accent} data-theme={settings.theme || "graphite"} data-density={settings.density || "comfortable"} data-motion={settings.reduceMotion ? "reduced" : "full"} style={settings.customAccent ? ({ "--accent": settings.customAccent } as CSSProperties) : undefined}>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-icon">GH</span>
          <div>
            GAMINGHUB<small>DEIN PERSÖNLICHER SPACE</small>
          </div>
        </div>
        <div className="nav-label nav-label-row"><span>WORKSPACE</span><button className={sortMode ? "sort-toggle active" : "sort-toggle"} onClick={() => setSortMode(!sortMode)}>{sortMode ? "Fertig" : "Sortieren"}</button></div>
        <nav aria-label="Hauptnavigation">
          {orderedModules.map((m, index) => (
            <div className="nav-row" key={m.id}>
            <button
              className={"nav-item " + (active === m.id ? "active" : "")}
              aria-current={active === m.id ? "page" : undefined}
              onClick={() => setActive(m.id)}
              draggable
              onDragStart={(e) => { setDragged(m.id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", m.id); }}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = "move"; }}
              onDragEnter={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
              onDrop={(e) => { e.preventDefault(); e.stopPropagation(); const source=dragged || e.dataTransfer.getData("text/plain"); if (!source || source === m.id) return; const ids=orderedModules.map(x=>x.id); const from=ids.indexOf(source), to=ids.indexOf(m.id); if(from<0)return; ids.splice(from,1); ids.splice(to,0,source); setOrder(ids); localStorage.setItem("gaminghub.moduleOrder.v1",JSON.stringify(ids)); setDragged(null); }}
              onDragEnd={() => setDragged(null)}
            >
              <span className="nav-symbol" aria-hidden="true">
                {m.icon}
              </span>
              {m.label}
              {active === m.id && <span className="nav-dot" />}
            </button>{sortMode && <span className="nav-reorder" aria-label={`${m.label} verschieben`}><button disabled={index===0} aria-label={`${m.label} nach oben`} onClick={() => { const ids=orderedModules.map(x=>x.id); [ids[index-1],ids[index]]=[ids[index],ids[index-1]]; setOrder(ids); localStorage.setItem("gaminghub.moduleOrder.v1",JSON.stringify(ids)); }}>↑</button><button disabled={index===orderedModules.length-1} aria-label={`${m.label} nach unten`} onClick={() => { const ids=orderedModules.map(x=>x.id); [ids[index],ids[index+1]]=[ids[index+1],ids[index]]; setOrder(ids); localStorage.setItem("gaminghub.moduleOrder.v1",JSON.stringify(ids)); }}>↓</button></span>}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="status-dot" /> Lokal auf deinem PC
          <small>GamingHub · 0.8 Early Access</small>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span>
            Workspace <span className="slash">/</span>{" "}
            <strong>{current.label}</strong>
          </span>
          <button className="version-chip" onClick={() => setChangelogOpen(true)}>0.8 · EARLY ACCESS</button><button className="command-trigger" onClick={() => setCommandOpen(true)}>⌕ Schnellstart <kbd>Strg K</kbd></button>
          <div className="clock">
            <time>
              {now.toLocaleTimeString("de-DE", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </time>
            <span>
              {now.toLocaleDateString("de-DE", {
                weekday: "short",
                day: "2-digit",
                month: "short",
              })}
            </span>
            <span className="avatar">
              {(settings.name.trim() || "Du")[0].toUpperCase()}
            </span>
          </div>
        </header>
        <main>
          {!online && <p className="offline-banner" role="status">Offline · lokale Funktionen bleiben verfügbar, Spotify und Online-Dienste warten auf die Verbindung.</p>}
          {(gamesError || settingsError) && (
            <p role="alert" className="notice">
              {gamesError || settingsError}
            </p>
          )}
          <div className={active === "music" ? "persistent-page active" : "persistent-page"} aria-hidden={active !== "music"}>
            <MusicPage {...pageProps} />
          </div>
          {active !== "music" && <Page key={active} {...pageProps} />}
        </main>
        <footer>
          DEIN SETUP. DEIN SPACE.<span>V0.8 · EARLY ACCESS</span>
        </footer>
      </div>
      {commandOpen && <div className="command-backdrop" onMouseDown={() => setCommandOpen(false)}>
        <section className="command-palette" role="dialog" aria-modal="true" aria-label="Schnellstart" onMouseDown={event => event.stopPropagation()}>
          <input autoFocus aria-label="GamingHub durchsuchen" placeholder="Seiten und Spiele durchsuchen …" value={commandQuery} onChange={event => setCommandQuery(event.target.value)} />
          {commandResults.pages.length > 0 && <><small>SEITEN</small>{commandResults.pages.map(item => <button key={item.id} onClick={() => { setActive(item.id); setCommandOpen(false); }}><span>{item.icon}</span>{item.label}<i>Öffnen</i></button>)}</>}
          {commandResults.games.length > 0 && <><small>SPIELE & APPS</small>{commandResults.games.map(game => <button key={game.id} disabled={!game.path} onClick={() => void quickLaunch(game)}><span>{game.favorite ? "★" : "▶"}</span>{game.name}<i>Starten</i></button>)}</>}
          {!commandResults.pages.length && !commandResults.games.length && <p>Keine Treffer gefunden.</p>}
          {commandMessage && <p className="notice" role="alert">{commandMessage}</p>}
        </section>
      </div>}
      {!settings.welcomeComplete && <FirstRun settings={settings} save={setSettings} />}
      <UtilityOverlay />
      <UpdateCenter automatic={settings.automaticUpdates !== false} />
      {changelogOpen && <Changelog close={() => setChangelogOpen(false)} />}
    </div>
  );
}
