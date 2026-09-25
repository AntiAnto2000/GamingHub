import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface Playtime { appId: number; minutes: number | null; lastPlayed: number | null }
interface Achievement { apiname: string; achieved: number; unlocktime: number; name: string; description: string }
export function useSteamTimes(enabled: boolean, steamId?: string) {
  const [times, setTimes] = useState<Playtime[]>([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  async function refresh() {
    if (!steamId) { setStatus("Bitte in den Einstellungen ein lokales Steam-Profil auswählen."); return; }
    setBusy(true);
    try {
      setTimes(await invoke<Playtime[]>("steam_playtime", { steamId }));
      setStatus(`Steam-Daten gelesen um ${new Date().toLocaleTimeString("de-DE")}. Lokaler Steam-Datenstand; laufende Spiele können verzögert erscheinen.`);
    } catch (e) { setStatus(String(e)); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    if (!enabled || !steamId) return;
    void refresh();
    const timer = window.setInterval(() => void refresh(), 10 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [enabled, steamId]);
  return { times, status, busy, refresh };
}

export default function SteamStats({ appId, time, steamId }: { appId: number; time?: Playtime; steamId?: string }) {
  const cacheKey = `gaminghub.achievements.${steamId || "none"}.${appId}`;
  const [data, setData] = useState<{ items: Achievement[]; at: string } | null>(() => {
    try {
      const v = JSON.parse(localStorage.getItem(cacheKey) ?? "null");
      return v && typeof v.at === "string" && Array.isArray(v.items) && v.items.every((a: Achievement) =>
        typeof a.apiname === "string" && typeof a.name === "string" && typeof a.description === "string" &&
        (a.achieved === 0 || a.achieved === 1) && Number.isFinite(a.unlocktime)) ? v : null;
    } catch { return null; }
  });
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function load() {
    setBusy(true); setError("");
    const apiKey = key.trim(); setKey("");
    try {
      if (!steamId) throw new Error("Bitte zuerst in den Einstellungen ein Steam-Profil auswählen.");
      const items = await invoke<Achievement[]>("steam_achievements", { steamId, appId, apiKey });
      const result = { items, at: new Date().toISOString() };
      setData(result);
      try { localStorage.setItem(cacheKey, JSON.stringify(result)); }
      catch { setError("Erfolge geladen, konnten aber nicht dauerhaft gespeichert werden."); }
    } catch (e) { setError(String(e)); }
    finally { setBusy(false); }
  }
  const unlocked = data?.items.filter(a => a.achieved === 1).length ?? 0;
  return <section className="steam-stats">
    <p><strong>{time?.minutes != null ? `${Math.floor(time.minutes / 60)} Std. ${time.minutes % 60} Min.` : "Spielzeit nicht verfügbar"}</strong><br /><small>Steam-Spielzeit · lokaler Datenstand</small></p>
    <p className="muted">Zuletzt gespielt: {time?.lastPlayed ? new Date(time.lastPlayed * 1000).toLocaleDateString("de-DE") : "Unbekannt"}</p>
    <details>
      <summary>🏆 {data ? `${unlocked} / ${data.items.length} Achievements` : "Achievements importieren"}</summary>
      {data && <>
        <progress aria-label="Achievement-Fortschritt" max={Math.max(data.items.length, 1)} value={unlocked} />
        <p className="muted">Importiert: {new Date(data.at).toLocaleString("de-DE")}</p>
        <div className="achievement-list">{data.items.length ? [...data.items].sort((a,b) => b.achieved-a.achieved || b.unlocktime-a.unlocktime).map(a =>
          <div key={a.apiname}><strong>{a.achieved === 1 ? "✓" : "○"} {a.name || a.apiname}</strong><p>{a.description}</p><small>{a.achieved === 1 ? a.unlocktime > 0 ? new Date(a.unlocktime * 1000).toLocaleDateString("de-DE") : "Freigeschaltet" : "Noch gesperrt"}</small></div>
        ) : <p>Steam meldet keine Achievements.</p>}</div>
      </>}
      <p className="muted">Steam Web API-Schlüssel hier eingeben. Er wird nur für diesen Abruf an Steam gesendet und nicht gespeichert. Deine Spieldetails müssen zugänglich sein.</p>
      <label>API-Schlüssel<input type="password" autoComplete="off" value={key} maxLength={32} onChange={e => setKey(e.target.value)} /></label>
      <button className="secondary" disabled={busy || !/^[a-f0-9]{32}$/i.test(key.trim())} onClick={load}>{busy ? "Lädt …" : "Achievements von Steam laden"}</button>
      {error && <p role="alert" className="notice">{error}{data ? " Der vorherige Import bleibt sichtbar." : ""}</p>}
    </details>
  </section>;
}
