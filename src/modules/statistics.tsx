import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Empty, Heading } from "../components/ui";
import { duration, gib, statusLabel, useNative } from "../services/native";
import type { ModuleProps } from "./types";
import { useSteamTimes } from "../components/SteamStats";
export default function Statistics({ games, settings }: ModuleProps) {
  const hub = useNative();
  const steam = useSteamTimes(hub.native, settings.steamId);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const sorted = [...hub.sessions].sort((a, b) => b.startedAt - a.startedAt);
  const localSeconds = sorted.reduce((sum, session) => sum + session.durationSeconds, 0);
  const steamRows = games.flatMap(game => {
    if (!game.steamAppId) return [];
    const time = steam.times.find(item => item.appId === game.steamAppId);
    return time?.minutes == null ? [] : [{ id: game.id, name: game.name, minutes: time.minutes, lastPlayed: time.lastPlayed }];
  }).sort((a,b) => b.minutes-a.minutes);
  const steamMinutes = steamRows.reduce((sum,row) => sum+row.minutes,0);
  const byGame = Object.values(
    sorted.reduce<
      Record<string, { name: string; seconds: number; count: number }>
    >((out, s) => {
      const row = out[s.gameId] ?? { name: s.name, seconds: 0, count: 0 };
      row.seconds += s.durationSeconds;
      row.count++;
      out[s.gameId] = row;
      return out;
    }, {}),
  ).sort((a, b) => b.seconds - a.seconds);
  async function finish(id: string) {
    setBusy(id);
    try {
      await invoke("finish_session", { id });
      await hub.refresh();
      setError("");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <Heading eyebrow="DEINE AKTIVITÄT" title="Spielzusammenfassung">
        Deine Sessions, Laufzeiten und die Systemauslastung während des
        Spielens.
      </Heading>
      {(hub.storageError || error) && (
        <p className="notice" role="alert">
          {hub.storageError || error}
        </p>
      )}
      <div className="metrics statistics-metrics">
        <section className="panel metric">
          <span>Bibliothek</span>
          <div className="metric-value">{games.length}</div>
          <p>Gespeicherte Einträge</p>
        </section>
        <section className="panel metric">
          <span>Steam-Spielzeit</span>
          <div className="metric-value compact-value">{duration(steamMinutes * 60)}</div>
          <p>{steamRows.length} Spiele mit lokalem Steam-Datenstand</p>
        </section>
        <section className="panel metric">
          <span>GamingHub-Spielzeit</span>
          <div className="metric-value compact-value">{duration(localSeconds)}</div>
          <p>Über GamingHub aufgezeichnet</p>
        </section>
        <section className="panel metric">
          <span>GamingHub-Sessions</span>
          <div className="metric-value">{sorted.length}</div>
          <p>
            {sorted.filter((s) => s.status === "running").length} gerade aktiv
          </p>
        </section>
      </div>
      <section className="panel info-panel statistics-steam">
        <div className="section-title"><div><h2>Steam-Spielzeiten</h2><p className="muted">Direkt aus deinem ausgewählten lokalen Steam-Profil.</p></div><button className="secondary" disabled={steam.busy || !settings.steamId} onClick={() => void steam.refresh()}>{steam.busy ? "Aktualisiert …" : "Jetzt aktualisieren"}</button></div>
        {steam.status && <p className={steam.times.length ? "muted" : "notice"}>{steam.status}</p>}
        {!settings.steamId ? <p>Wähle in den Einstellungen zuerst dein Steam-Profil aus.</p> : steamRows.length ? steamRows.map(row => <div className="detail-row" key={row.id}><span>{row.name}<small>{row.lastPlayed ? `Zuletzt gespielt: ${new Date(row.lastPlayed*1000).toLocaleDateString("de-DE")}` : "Noch kein letztes Spieldatum"}</small></span><strong>{duration(row.minutes*60)}</strong></div>) : !steam.busy && <p>Für deine importierten Steam-Spiele wurden noch keine lokalen Spielzeiten gefunden.</p>}
      </section>
      {!sorted.length ? (
        <section className="panel">
          <Empty icon="▥" title="Bereit für deine erste Session">
            Starte ein Spiel über GamingHub. Hier erscheinen Laufzeit und
            Messwerte automatisch.
          </Empty>
        </section>
      ) : (
        <>
          <section className="panel info-panel">
            <h2>Deine Spiele im Überblick</h2>
            {byGame.map((row) => (
              <div className="detail-row" key={row.name + row.seconds}>
                <span>
                  {row.name} · {row.count} Sessions
                </span>
                <span>{duration(row.seconds)}</span>
              </div>
            ))}
          </section>
          <h2 className="section-title">Sessionverlauf</h2>
          <div className="session-list">
            {sorted.map((s) => (
              <details
                className="panel session"
                key={s.id}
                open={s.status === "running"}
              >
                <summary>
                  <span>
                    <strong>{s.name}</strong>
                    <small>
                      {new Date(s.startedAt * 1000).toLocaleString("de-DE")} ·{" "}
                      {statusLabel[s.status] || s.status}
                    </small>
                  </span>
                  <span>{duration(s.durationSeconds)}</span>
                </summary>
                <div className="session-body">
                  <div className="detail-row">
                    <span>CPU Ø / Spitze</span>
                    <span>
                      {s.samples
                        ? `${(s.cpuSum / s.samples).toFixed(1)} % / ${s.cpuPeak.toFixed(1)} %`
                        : "Keine Messwerte"}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span>GPU Ø / Spitze</span>
                    <span>
                      {s.gpuSamples
                        ? `${(s.gpuSum / s.gpuSamples).toFixed(1)} % / ${s.gpuPeak} %`
                        : "Keine Messwerte"}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span>RAM-Spitze</span>
                    <span>
                      {s.samples ? gib(s.ramPeak) : "Keine Messwerte"}
                    </span>
                  </div>
                  {s.exitCode !== null && s.exitCode !== 0 && (
                    <p className="notice">Prozess-Exitcode: {s.exitCode}</p>
                  )}
                  {s.status === "interrupted" && (
                    <p className="notice">
                      GamingHub wurde während der Session geschlossen. Die
                      Laufzeit endet bei der zuletzt gespeicherten Messung.
                    </p>
                  )}
                  {s.durationSeconds < 15 && s.status !== "running" && (
                    <p className="muted">
                      Sehr kurzer Prozesslauf: Ein Launcher könnte an einen
                      anderen Prozess übergeben haben. Dies ist dann keine
                      vollständige Spielzeit.
                    </p>
                  )}
                  {s.status === "running" && (
                    <button
                      className="secondary"
                      disabled={!!busy}
                      onClick={() => finish(s.id)}
                    >
                      Aufzeichnung beenden · Spiel läuft weiter
                    </button>
                  )}
                  <p className="muted">
                    Messwerte des gesamten PCs während dieser Session.
                  </p>
                </div>
              </details>
            ))}
          </div>
        </>
      )}
      <p className="muted">
        Lokale Sessions werden erfasst, wenn du eine EXE direkt über GamingHub startest. Steam-Spiele übergeben ihren Start an Steam; deren Spielzeit wird deshalb separat aus deinem lokalen Steam-Profil gelesen und alle zehn Minuten aktualisiert.
      </p>
    </>
  );
}
