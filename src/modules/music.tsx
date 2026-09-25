import { useEffect, useRef, useState } from "react";
import { availableSpotifyDevices, controlSpotifyDevice, type SpotifyDevice, artistCatalog, artistTracks, beginSpotifyLogin, finishSpotifyLogin, genreTrackPool, playContextOnDevice, playOnDevice, searchArtists, searchPlaylists, searchTracks, spotifyToken, type SpotifyArtist, type SpotifyPlaylist, type SpotifyTrack } from "../services/spotify";
import "./music.css";
import { publishEmbeddedMusic, registerEmbeddedMusicControls } from "../services/musicBridge";
interface Player {
  addListener(event: string, callback: (data: any) => void): void;
  connect(): Promise<boolean>; disconnect(): void; activateElement(): Promise<void>;
  togglePlay(): Promise<void>; previousTrack(): Promise<void>; nextTrack(): Promise<void>;
}
type SDKWindow = Window & { Spotify?: { Player: new (options: { name: string; getOAuthToken: (callback: (token: string) => void) => void; volume: number }) => Player }; onSpotifyWebPlaybackSDKReady?: () => void };
const messageOf = (e: unknown) => e instanceof Error ? e.message : String(e);
const duration = (ms?: number) => ms == null ? "–" : Math.floor(ms / 60000) + ":" + String(Math.floor(ms / 1000) % 60).padStart(2, "0");
function shuffledQueue(current: SpotifyTrack, source: SpotifyTrack[]) {
  const unique = [...new Map(source.filter(track => track.id !== current.id).map(track => [track.id, track])).values()];
  const result: string[] = [];
  while (result.length < 99 && unique.length) {
    const round = [...unique];
    for (let index = round.length - 1; index > 0; index--) {
      const swap = Math.floor(Math.random() * (index + 1));
      [round[index], round[swap]] = [round[swap], round[index]];
    }
    result.push(...round.map(track => track.uri));
  }
  return result.slice(0, 99);
}
export default function Music() {
  const [connected, setConnected] = useState(Boolean(spotifyToken()));
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>(() => { try { const value = JSON.parse(localStorage.getItem("gaminghub.spotify.recent.v1") || "[]"); return Array.isArray(value) ? value.filter(item => typeof item === "string").slice(0, 6) : []; } catch { return []; } });
  const [liked, setLiked] = useState<string[]>(() => { try { const value = JSON.parse(localStorage.getItem("gaminghub.spotify.liked.v1") || "[]"); return Array.isArray(value) ? value.filter(item => typeof item === "string") : []; } catch { return []; } });
  const [history, setHistory] = useState<SpotifyTrack[]>(() => { try { const value = JSON.parse(localStorage.getItem("gaminghub.spotify.history.v1") || "[]"); return Array.isArray(value) ? value.filter(item => item?.id).slice(0, 20) : []; } catch { return []; } });
  const [mode, setMode] = useState<"artist" | "track" | "playlist">("artist");
  const [artists, setArtists] = useState<SpotifyArtist[]>([]);
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [selected, setSelected] = useState<SpotifyArtist | null>(null);
  const [tracks, setTracks] = useState<SpotifyTrack[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [catalog, setCatalog] = useState(false);
  const [autoMix, setAutoMix] = useState(true);
  const [mixInfo, setMixInfo] = useState("");
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const [trackError, setTrackError] = useState("");
  const [playerError, setPlayerError] = useState("");
  const [device, setDevice] = useState("");
  const [outputs, setOutputs] = useState<SpotifyDevice[]>([]);
  const [output, setOutput] = useState("");
  const [deviceMessage, setDeviceMessage] = useState("");
  const [checkingDevices, setCheckingDevices] = useState(false);
  const target = output || device;
  const outputRef = useRef(output);
  outputRef.current = output;
  async function refreshOutputs() {
    setCheckingDevices(true); setDeviceMessage("");
    try {
      const devices = await availableSpotifyDevices();
      setOutputs(devices);
      setOutput(previous => devices.some(d => d.id === previous) ? previous : "");
      if (!devices.length) setDeviceMessage("Keine Ausgabe gefunden. Öffne Spotify auf diesem PC mit demselben Konto, starte dort kurz Musik und aktualisiere die Liste.");
    } catch (e) { setDeviceMessage(messageOf(e)); }
    finally { setCheckingDevices(false); }
  }
  async function remoteControl(command: "pause" | "play" | "next" | "previous") {
    await controlSpotifyDevice(target, command);
    if (command === "pause" || command === "play") setPaused(command === "pause");
    else setCurrent(null);
  }
  const [playerGeneration, setPlayerGeneration] = useState(0);
  const [current, setCurrent] = useState<SpotifyTrack | null>(null);
  const [paused, setPaused] = useState(true);
  const [busy, setBusy] = useState(false);
  const player = useRef<Player | null>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const request = useRef(0);
  useEffect(() => {
    let alive = true;
    void finishSpotifyLogin().then(ok => { if (alive && ok) setConnected(true); }).catch(e => { if (alive) setError(messageOf(e)); });
    return () => { alive = false; request.current++; };
  }, []);
  useEffect(() => {
    setDevice(""); setCurrent(null); setPaused(true);
    if (!connected) return;
    let disposed = false;
    let instance: Player | null = null;
    const sdk = window as SDKWindow;
    const initialize = () => {
      if (disposed || instance || !sdk.Spotify) return;
      instance = new sdk.Spotify.Player({ name: "GamingHub", volume: 0.5, getOAuthToken: cb => cb(spotifyToken() || "") });
      player.current = instance;
      instance.addListener("ready", ({ device_id }) => { if (!disposed) { setDevice(device_id); setPlayerError(""); } });
      instance.addListener("not_ready", () => { if (!disposed) setDevice(""); });
      instance.addListener("player_state_changed", state => { if (!disposed && !outputRef.current) { setCurrent(state?.track_window.current_track ?? null); setPaused(state?.paused ?? true); } });
      for (const event of ["initialization_error", "authentication_error", "account_error", "playback_error"]) instance.addListener(event, (detail) => { if (!disposed) setPlayerError(event === "initialization_error" ? "Der Player wird in diesem Fenster nicht unterstützt. Spotify kann separat geöffnet werden." : "Player nicht verfügbar (" + event + "): " + String(detail?.message || "Keine weitere Angabe").slice(0, 240)); });
      void instance.connect().then(ok => { if (!disposed && !ok) setPlayerError("Player konnte sich nicht verbinden."); }).catch(e => { if (!disposed) setPlayerError(messageOf(e)); });
    };
    sdk.onSpotifyWebPlaybackSDKReady = initialize;
    initialize();
    const timeout = window.setTimeout(() => { if (!disposed && !instance) setPlayerError("Spotify-Player konnte nicht geladen werden. Bitte Verbindung prüfen und neu laden."); }, 15000);
    return () => { disposed = true; clearTimeout(timeout); instance?.disconnect(); player.current = null; if (sdk.onSpotifyWebPlaybackSDKReady === initialize) sdk.onSpotifyWebPlaybackSDKReady = undefined; };
  }, [connected, playerGeneration]);
  useEffect(() => {
    publishEmbeddedMusic({
      active: Boolean(current),
      title: current?.name || "",
      artist: current?.artists.map(artist => artist.name).join(", ") || "",
      album: current?.album?.name || "",
      playing: Boolean(current) && !paused,
    });
  }, [current, paused]);
  useEffect(() => registerEmbeddedMusicControls(async command => {
    setPlayerError("");
    if (command === "previous") return outputRef.current ? remoteControl("previous") : player.current!.previousTrack();
    if (command === "next") return outputRef.current ? remoteControl("next") : player.current!.nextTrack();
    if (outputRef.current) return remoteControl(pausedRef.current ? "play" : "pause");
    await player.current!.togglePlay();
  }), []);
  async function search() {
    if (!query.trim()) return;
    const term = query.trim(); const nextRecent = [term, ...recent.filter(item => item.toLocaleLowerCase("de-DE") !== term.toLocaleLowerCase("de-DE"))].slice(0, 6); setRecent(nextRecent); localStorage.setItem("gaminghub.spotify.recent.v1", JSON.stringify(nextRecent));
    const id = ++request.current; setTrackError(""); setSearching(true); setError(""); setSelected(null); setTracks([]); setLoading(false); setCatalog(false); setArtists([]); setPlaylists([]); setSearched(false);
    try {
      if (mode === "track") { const result = await searchTracks(query.trim()); if (id === request.current) setTracks(result); }
      else if (mode === "playlist") { const result = await searchPlaylists(query.trim()); if (id === request.current) setPlaylists(result); }
      else { const result = await searchArtists(query.trim()); if (id === request.current) setArtists(result); }
      if (id === request.current) setSearched(true);
    } catch (e) { if (id === request.current) setError(messageOf(e)); }
    finally { if (id === request.current) setSearching(false); }
  }
  async function select(artist: SpotifyArtist) {
    const id = ++request.current;
    setSelected(artist); setTracks([]); setTrackError(""); setLoading(true); setCatalog(false);
    try { const results = await artistTracks(artist.id, artist.name); if (id === request.current) setTracks(results); }
    catch (e) { if (id === request.current) setTrackError(messageOf(e)); }
    finally { if (id === request.current) setLoading(false); }
  }
  async function loadCatalog() {
    if (!selected) return;
    const id = ++request.current;
    setTracks([]); setTrackError(""); setLoading(true); setCatalog(true);
    try { const results = await artistCatalog(selected.id); if (id === request.current) setTracks(results); }
    catch (e) { if (id === request.current) setTrackError(messageOf(e)); }
    finally { if (id === request.current) setLoading(false); }
  }
  async function action(run: () => Promise<unknown>) {
    setBusy(true); setPlayerError("");
    try { await run(); } catch (e) { setPlayerError(messageOf(e)); } finally { setBusy(false); }
  }
  function toggleLiked(track: SpotifyTrack) {
    setLiked(old => { const next = old.includes(track.id) ? old.filter(id => id !== track.id) : [track.id, ...old].slice(0, 100); localStorage.setItem("gaminghub.spotify.liked.v1", JSON.stringify(next)); return next; });
  }
  function remember(track: SpotifyTrack) {
    setHistory(old => { const next = [track, ...old.filter(item => item.id !== track.id)].slice(0, 20); localStorage.setItem("gaminghub.spotify.history.v1", JSON.stringify(next)); return next; });
  }
  return <div className="music-page">
    <header className="music-header"><div><span className="music-kicker">DEIN SOUNDTRACK</span><h1>Musik</h1><p>Finde deinen nächsten Track. Bleib im Flow.</p></div><button className="secondary" onClick={() => void beginSpotifyLogin().then(ok => { if (ok) { setConnected(true); setError(""); } }).catch(e => setError(messageOf(e)))}>{connected ? "Spotify erneut verbinden" : "Mit Spotify verbinden"}</button></header>
    {error && <p className="music-alert" role="alert">{error}</p>}
    <section className="music-search-panel" aria-label="Spotify-Suche"><div className="music-section-heading"><h2>Entdecken</h2><span>Musik von Spotify</span></div>
      <div className="music-search-modes" role="group" aria-label="Suchmodus">
        {([["artist", "Künstler"], ["track", "Songs"], ["playlist", "Playlists"]] as const).map(([value, label]) => <button type="button" key={value} aria-pressed={mode === value} onClick={() => { request.current++; setMode(value); setArtists([]); setPlaylists([]); setTracks([]); setSelected(null); setSearched(false); setSearching(false); setLoading(false); setCatalog(false); setError(""); setTrackError(""); }}>{label}</button>)}
      </div>
      <form className="music-search" onSubmit={e => { e.preventDefault(); void search(); }}><input aria-label={mode === "track" ? "Song suchen" : mode === "playlist" ? "Playlist suchen" : "Künstler suchen"} placeholder={mode === "track" ? "Songtitel, z. B. Numb oder All Eyez On Me" : mode === "playlist" ? "Playlist suchen, z. B. Rock Classics oder Gaming" : "Welchen Künstler möchtest du hören?"} value={query} onChange={e => setQuery(e.target.value)} disabled={!connected} /><button className="primary" disabled={!connected || searching || !query.trim()}>{searching ? "Suche läuft …" : "Suchen"}</button></form>
      {recent.length > 0 && <div className="music-recent"><span>Zuletzt gesucht</span>{recent.map(term => <button key={term} type="button" onClick={() => setQuery(term)}>{term}</button>)}<button className="clear" type="button" onClick={() => { setRecent([]); localStorage.removeItem("gaminghub.spotify.recent.v1"); }}>Leeren</button></div>}
      {!connected && <p className="music-help">Verbinde Spotify, um Künstler und ihre Titel zu entdecken.</p>}
    </section>
    <div className={"music-workspace" + (mode !== "artist" ? " songs-only" : "")}>
      {mode === "artist" && <section className="music-artists" aria-label="Künstler"><div className="music-section-heading"><h2>Künstler</h2><span>{artists.length ? artists.length + " Ergebnisse" : "Deine Suche"}</span></div>
        {searching ? <div className="music-empty" role="status">Künstler werden gesucht …</div> : artists.length ? <div>{artists.map(artist => <button key={artist.id} className={"music-artist" + (selected?.id === artist.id ? " selected" : "")} aria-pressed={selected?.id === artist.id} onClick={() => void select(artist)}>
          {artist.images?.[0] ? <img src={artist.images[0].url} alt="" /> : <span className="music-avatar">♫</span>}<span><strong>{artist.name}</strong><small>Titel entdecken</small></span><span aria-hidden="true">›</span></button>)}</div> : <div className="music-empty"><span aria-hidden="true">⌕</span><strong>{searched ? "Keine Künstler gefunden" : "Deine Musik beginnt hier"}</strong><p>{searched ? "Versuche einen anderen Namen." : "Suche oben nach einem Künstler."}</p></div>}
      </section>}
      <section className="music-tracks" aria-label={mode === "playlist" ? "Playlists" : "Titel"} aria-busy={loading || searching}><div className="music-section-heading"><div><span className="music-kicker">{mode === "playlist" ? "PLAYLISTS" : "TITEL"}</span><h2>{mode === "track" ? "Songs" : mode === "playlist" ? "Playlist auswählen" : selected?.name || "Worauf hast du Lust?"}</h2></div><div className="music-catalog-actions">{mode !== "playlist" && <label className="music-mix-toggle" title="Spielt nach dem gewählten Song zufällig gemischte Titel derselben Musikrichtung"><input type="checkbox" checked={autoMix} onChange={event => setAutoMix(event.target.checked)} /><span>Genre-Mix</span></label>}{selected && <><button className="secondary" disabled={loading} onClick={() => void (catalog ? select(selected) : loadCatalog())}>{catalog ? "10 Songs anzeigen" : "Alle Songs laden"}</button><a href={selected.external_urls.spotify} target="_blank" rel="noreferrer">Auf Spotify ↗</a></>}</div></div>
        {mode === "playlist" ? (searching ? <div className="music-empty" role="status">Playlists werden gesucht …</div> : playlists.length ? <div className="playlist-grid">{playlists.map(playlist => <article key={playlist.id} className="playlist-card">{playlist.images?.[0] ? <img src={playlist.images[0].url} alt="" /> : <div className="playlist-placeholder">♫</div>}<div><strong>{playlist.name}</strong><small>{playlist.owner?.display_name || "Spotify"}{playlist.items?.total ? ` · ${playlist.items.total} Titel` : ""}</small><p>{playlist.description?.replace(/<[^>]*>/g, "") || "Spotify-Playlist"}</p></div><div className="playlist-actions"><a href={playlist.external_urls.spotify} target="_blank" rel="noreferrer">Spotify ↗</a><button className="primary" disabled={!target || busy} onClick={() => void action(async () => { if (!output) await player.current?.activateElement(); await playContextOnDevice(target, playlist.uri); setPaused(false); })}>▶ Playlist starten</button></div></article>)}</div> : <div className="music-empty"><span>▤</span><strong>{searched ? "Keine Playlists gefunden" : "Finde deine Playlist"}</strong><p>Suche oben nach Name, Stimmung oder Musikrichtung.</p></div>) : trackError ? <div className="music-alert" role="alert">{trackError}<button className="secondary" onClick={() => selected && void select(selected)}>Erneut versuchen</button></div> : (loading || (mode === "track" && searching)) ? <div className="music-empty" role="status">Titel werden geladen …</div> : tracks.length ? <div className="music-track-list">{tracks.map((track, index) => <div className="music-track" key={track.id}><span className="music-number">{index + 1}</span>
          {track.album?.images?.[0] ? <img src={track.album.images[0].url} alt="" /> : <span className="music-cover">♫</span>}
          <div><strong>{track.name}</strong><small>{track.artists.map(a => a.name).join(", ")}</small></div><span className="music-duration">{duration(track.duration_ms)}</span><button className={"music-like" + (liked.includes(track.id) ? " active" : "")} aria-label={liked.includes(track.id) ? "Aus Favoriten entfernen" : "Als Favorit speichern"} onClick={() => toggleLiked(track)}>{liked.includes(track.id) ? "♥" : "♡"}</button><button className="music-play" aria-label={track.name + " abspielen"} title={target ? (autoMix ? "Starten und Genre-Mix abspielen" : "Auf gewählter Ausgabe abspielen") : "Bitte Ausgabe auswählen"} disabled={!target || busy} onClick={() => void action(async () => { if (!output) await player.current?.activateElement(); let pool = tracks; setMixInfo(autoMix ? "Musikrichtung wird ermittelt …" : ""); if (autoMix) { try { const result = await genreTrackPool(track, selected ?? undefined); if (result.tracks.length) { pool = result.tracks; setMixInfo(`${result.genre} · ${result.tracks.length} passende Songs`); } else if (result.genre) setMixInfo(`${result.genre} erkannt · keine weiteren Songs gefunden, vorhandene Treffer werden verwendet`); else setMixInfo("Keine grobe Musikrichtung erkannt · vorhandene Treffer werden verwendet"); } catch (reason) { setMixInfo(`Genre-Suche fehlgeschlagen: ${messageOf(reason)}`); pool = tracks; } } const queue = autoMix ? shuffledQueue(track, pool) : []; await playOnDevice(target, track.uri, queue); remember(track); if (output) { setCurrent(track); setPaused(false); } })}>▶</button></div>)}</div> : <div className="music-empty"><span aria-hidden="true">♫</span><strong>{mode === "track" ? (searched ? "Keine Songs gefunden" : "Welchen Song möchtest du hören?") : selected ? "Keine passenden Titel gefunden" : "Wähle einen Künstler"}</strong><p>{mode === "track" ? (searched ? "Versuche einen anderen Titel oder ergänze den Künstlernamen." : "Gib oben einen Songtitel ein und klicke auf Suchen.") : selected ? "Auf Spotify findest du den vollständigen Katalog." : "Seine Titel erscheinen hier — mit einem Klick abspielbar."}</p></div>}
        {mode !== "playlist" && tracks.length > 0 && <p className="music-help">{mixInfo || (autoMix ? "Genre-Mix aktiv · beim Start wird eine grobe Musikrichtung ermittelt" : catalog ? `${tracks.length} eindeutige Songs aus Alben und Singles · alphabetisch` : "Suchergebnisse von Spotify · keine Top-Titel-Rangliste")}</p>}
        {history.length > 0 && <details className="music-history"><summary>Zuletzt gespielt ({history.length})</summary><div>{history.slice(0, 8).map(track => <button key={track.id} onClick={() => { setQuery(`${track.name} ${track.artists[0]?.name || ""}`); setMode("track"); }}>{liked.includes(track.id) ? "♥ " : ""}{track.name}<small>{track.artists.map(a => a.name).join(", ")}</small></button>)}</div><button className="text-button" onClick={() => { setHistory([]); localStorage.removeItem("gaminghub.spotify.history.v1"); }}>Verlauf löschen</button></details>}
      </section>
    </div>
    <section className="music-deck" aria-label="Musikplayer">
      <div className="music-deck-top">
        <span className="music-kicker">DEIN PLAYER</span>
        <span className={"music-connection" + (playerError ? " has-error" : "")} role="status">{busy ? "Wird vorbereitet …" : playerError ? "Verbindung prüfen" : !connected ? "Nicht verbunden" : current ? (paused ? "Pausiert" : "Wiedergabe angefordert") : "Titel auswählen"}</span>
      </div>
      <div className="music-deck-main">
        <div className="music-deck-track">
          {current?.album?.images?.[0] ? <img className="music-deck-cover" src={current.album.images[0].url} alt="" /> : <div className="music-deck-cover placeholder" aria-hidden="true">♫</div>}
          <div><h2>{current?.name || "Dein nächster Lieblingssong"}</h2><p>{current ? current.artists.map(a => a.name).join(", ") : "Wähle einen Titel aus deinen Suchergebnissen."}</p><span className="music-deck-source">{output ? outputs.find(item => item.id === output)?.name || "Spotify-Gerät" : "GamingHub · integrierter Player"}</span></div>
        </div>
        <div className="music-deck-controls">
          <button className="music-skip" aria-label="Vorheriger Titel" disabled={!current || busy} onClick={() => void action(() => output ? remoteControl("previous") : player.current!.previousTrack())}>⏮</button>
          <button className="music-main-play" aria-label={paused ? "Wiedergabe" : "Pause"} disabled={!current || busy} onClick={() => void action(() => output ? remoteControl(paused ? "play" : "pause") : player.current!.togglePlay())}>{busy ? "…" : paused ? "▶" : "Ⅱ"}</button>
          <button className="music-skip" aria-label="Nächster Titel" disabled={!current || busy} onClick={() => void action(() => output ? remoteControl("next") : player.current!.nextTrack())}>⏭</button>
        </div>
      </div>
      <div className="music-deck-output">
        <label htmlFor="music-output">Audioausgabe</label>
        <select id="music-output" value={output} disabled={busy} onChange={e => { setOutput(e.target.value); setCurrent(null); setPaused(true); setPlayerError(""); }}>
          <option value="">GamingHub · integrierter Player</option>
          {outputs.map(item => <option key={item.id} value={item.id}>{item.name}{item.is_active ? " · aktiv" : ""}</option>)}
        </select>
        <button className="secondary" disabled={!connected || checkingDevices || busy} onClick={() => void refreshOutputs()}>{checkingDevices ? "Sucht …" : "Aktualisieren"}</button>
      </div>
      {deviceMessage && <p className="music-deck-note" role="status">{deviceMessage}</p>}
      {playerError && <div className="music-deck-error" role="alert"><div><strong>Wiedergabe noch nicht verfügbar</strong><p>{playerError}</p></div></div>}
      <details className="music-deck-help">
        <summary>Verbindung & Hilfe</summary>
        <p>Für die Spotify-App: Öffne Spotify mit demselben Konto, aktualisiere die Ausgaben und wähle dein Gerät aus.</p>
        <button className="secondary" disabled={!connected || busy} onClick={() => { setDevice(""); setPlayerError(""); setPlayerGeneration(value => value + 1); }}>Integrierten Player neu verbinden</button>
      </details>
    </section>
  </div>;
}
