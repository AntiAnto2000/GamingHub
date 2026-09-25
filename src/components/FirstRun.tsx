import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Settings } from "../modules/types";

interface SteamProfile { steamId: string; accountId: number }

export default function FirstRun({ settings, save }: { settings: Settings; save: (settings: Settings) => void }) {
  const [name, setName] = useState(settings.name || "");
  const [profiles, setProfiles] = useState<SteamProfile[]>([]);
  const [steamId, setSteamId] = useState(settings.steamId || "");
  const [status, setStatus] = useState("Lokale Steam-Konten werden gesucht …");
  useEffect(() => {
    void invoke<SteamProfile[]>("steam_profiles").then(items => {
      setProfiles(items); if (!steamId && items[0]) setSteamId(items[0].steamId);
      setStatus(items.length ? `${items.length} lokales Steam-Konto${items.length === 1 ? "" : "en"} gefunden.` : "Kein lokales Steam-Konto gefunden. Du kannst Steam später einrichten.");
    }).catch(error => setStatus(String(error)));
  }, []);
  return <div className="welcome-backdrop"><section className="welcome-card" role="dialog" aria-modal="true" aria-label="GamingHub einrichten">
    <span className="welcome-version">0.8 · EARLY ACCESS</span>
    <h1>Willkommen bei GamingHub.</h1>
    <p>Diese Einrichtung gilt nur auf diesem PC. Bibliothek, Konten und Einstellungen werden nicht mit anderen Nutzern geteilt.</p>
    <label>Dein Anzeigename<input maxLength={40} value={name} onChange={event => setName(event.target.value)} placeholder="Wie dürfen wir dich nennen?" /></label>
    <fieldset><legend>Lokales Steam-Profil</legend><p className="muted">{status}</p>{profiles.map(profile => <label className="welcome-profile" key={profile.steamId}><input type="radio" name="welcome-steam" checked={steamId === profile.steamId} onChange={() => setSteamId(profile.steamId)}/><span><strong>Steam-Konto {profile.accountId}</strong><small>{profile.steamId}</small></span></label>)}{profiles.length === 0 && <input value={steamId} inputMode="numeric" onChange={event => setSteamId(event.target.value.replace(/\D/g, "").slice(0,17))} placeholder="Steam-ID64 optional eingeben" />}</fieldset>
    <div className="welcome-notes"><span>✓ Persönliche Daten bleiben lokal</span><span>✓ Spotify wird pro Nutzer verbunden</span><span>✓ Steam-Schlüssel werden nicht gespeichert</span></div>
    <button className="primary welcome-start" disabled={!name.trim()} onClick={() => save({ ...settings, name: name.trim(), steamId: steamId || undefined, welcomeComplete: true })}>GamingHub starten</button>
  </section></div>;
}
