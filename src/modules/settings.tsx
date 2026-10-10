import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Heading, SelectMenu } from "../components/ui";
import type { ModuleProps } from "./types";
import { repairLocalData, runLocalDiagnostics, type DiagnosticResult } from "../services/diagnostics";
export default function SettingsPage({ settings, setSettings, games, setGames }: ModuleProps) {
  const [steamProfiles, setSteamProfiles] = useState<{steamId:string;accountId:number}[]>([]);
  const [steamStatus, setSteamStatus] = useState("");
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([]);
  const [repairStatus, setRepairStatus] = useState("");
  const fullDiagnostics = async () => { const local=runLocalDiagnostics(); try { const native=await invoke<DiagnosticResult[]>("native_diagnostics"); setDiagnostics([...local,...native]); } catch { setDiagnostics(local); } };
  const detectSteam = async () => { setSteamStatus("Steam-Konten werden gesucht …"); try { const items=await invoke<{steamId:string;accountId:number}[]>("steam_profiles"); setSteamProfiles(items); setSteamStatus(items.length ? `${items.length} Konto${items.length===1?"":"en"} gefunden.` : "Kein lokales Steam-Konto gefunden."); if(!settings.steamId && items[0]) setSettings({...settings,steamId:items[0].steamId}); } catch(error){ setSteamStatus(String(error)); } };
  const defaults = { showSystem: true, showLibrary: true, showMusic: true, showDiscord: true };
  const enabled = (key: keyof typeof defaults) => settings[key] ?? defaults[key];
  const exportSettings = () => {
    const payload = { format: "gaminghub-backup", version: 3, exportedAt: new Date().toISOString(), settings, games };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a");
    link.href = url; link.download = "gaminghub-einstellungen.json"; link.click(); URL.revokeObjectURL(url);
  };
  const importBackup = async (file?: File) => {
    if (!file || file.size > 5_000_000) return;
    const parsed = JSON.parse(await file.text());
    if (parsed?.format !== "gaminghub-backup" || !parsed.settings || !Array.isArray(parsed.games)) throw new Error("Diese Datei ist kein gültiges GamingHub-Backup.");
    setSettings(parsed.settings); setGames(parsed.games);
  };
  const profiles = settings.gamingProfiles || [];
  const addProfile = () => setSettings({ ...settings, gamingProfiles: [...profiles, { id: crypto.randomUUID(), name: `Profil ${profiles.length + 1}`, companionApps: [], enabled: true }] });
  const exportProfiles = () => { const blob=new Blob([JSON.stringify({format:"gaminghub-profiles",version:1,profiles},null,2)],{type:"application/json"}); const url=URL.createObjectURL(blob); const link=document.createElement("a"); link.href=url; link.download="gaminghub-profile.json"; link.click(); URL.revokeObjectURL(url); };
  const setBackground = async (file?: File) => { if(!file || file.size > 4_000_000 || !file.type.startsWith("image/")) return; const reader=new FileReader(); reader.onload=()=>setSettings({...settings,backgroundImage:String(reader.result)}); reader.readAsDataURL(file); };
  return (
    <>
      <Heading eyebrow="MACH ES ZU DEINEM" title="Einstellungen">
        Kleine Details, die deinen Hub persönlich machen.
      </Heading>
      <section className="panel form-panel profile-settings">
        <div className="settings-section-head"><div className="profile-avatar">{(settings.name.trim() || "G")[0].toUpperCase()}</div><div><h2>Dein Profil</h2><p>So erscheint GamingHub für dich.</p></div></div>
        <label className="field-label">
          Anzeigename
          <input
            maxLength={40}
            value={settings.name}
            onChange={(e) => setSettings({ ...settings, name: e.target.value })}
            placeholder="Dein Name"
          />
        </label>
        <p className="field-help">Dieser Name erscheint in deiner Begrüßung auf Home.</p>
        <fieldset>
          <legend>Akzentfarbe</legend>
          <div className="color-options">
            {([
              ["mint", "Mint"],
              ["violet", "Violett"],
              ["ocean", "Ozeanblau"],
              ["amber", "Bernstein"],
              ["coral", "Koralle"],
              ["pink", "Pink"],
              ["ice", "Eisblau"],
              ["red", "Rot"],
            ] as const).map(([accent, label]) => (
              <label key={accent}>
                <input
                  type="radio"
                  name="accent"
                  value={accent}
                  checked={settings.accent === accent}
                  onChange={() => setSettings({ ...settings, accent, customAccent: undefined })}
                />
                <span className={`swatch ${accent}`} />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="accent-custom-row"><div><strong>Eigene Farbe</strong><small>Wähle exakt deinen gewünschten Akzent.</small></div><input aria-label="Eigene Akzentfarbe" type="color" value={settings.customAccent || "#a8ff6a"} onChange={e => setSettings({...settings,customAccent:e.target.value})}/><button type="button" className="secondary" disabled={!settings.customAccent} onClick={() => setSettings({...settings,customAccent:undefined})}>Zurücksetzen</button></div>
        <p className="notice">
          Änderungen werden automatisch lokal auf diesem Gerät gespeichert.
        </p>
      </section>
      <section className="panel form-panel">
        <h2>Darstellung</h2>
        <fieldset><legend>Hintergrund & Theme</legend><div className="theme-options">{([['graphite','Graphit'],['midnight','Mitternacht'],['forest','Wald'],['aurora','Aurora'],['crimson','Crimson'],['daylight','Tageslicht']] as const).map(([theme,label]) => <label key={theme} className={`theme-card ${theme}`}><input type="radio" name="theme" checked={(settings.theme || 'graphite') === theme} onChange={() => setSettings({...settings, theme})}/><span>{label}</span><small>{theme === 'graphite' ? 'Neutral und clean' : theme === 'midnight' ? 'Tiefblau und ruhig' : theme === 'forest' ? 'Dunkelgrün und warm' : theme === 'aurora' ? 'Farbiger Lichtschein' : theme === 'daylight' ? 'Hell und kontrastreich' : 'Dunkelrot und intensiv'}</small></label>)}</div></fieldset>
        <fieldset><legend>Abstände</legend><div className="segmented">{([['comfortable','Komfortabel'],['compact','Kompakt']] as const).map(([density,label]) => <label key={density}><input type="radio" name="density" checked={(settings.density || 'comfortable') === density} onChange={() => setSettings({...settings,density})}/><span>{label}</span></label>)}</div></fieldset>
        <fieldset><legend>Ansichtsmodus</legend><div className="segmented">{([['compact','Kompakt'],['standard','Standard'],['couch','Couch']] as const).map(([layoutMode,label]) => <label key={layoutMode}><input type="radio" name="layout" checked={(settings.layoutMode || 'standard') === layoutMode} onChange={() => setSettings({...settings,layoutMode})}/><span>{label}</span></label>)}</div></fieldset>
        <fieldset><legend>Eigener Hintergrund</legend><div className="background-picker"><label className="secondary import-button">Bild auswählen<input type="file" accept="image/*" onChange={e => void setBackground(e.target.files?.[0])}/></label><label>Intensität<input type="range" min="0.05" max="0.55" step="0.05" value={settings.backgroundOpacity ?? .18} onChange={e => setSettings({...settings,backgroundOpacity:Number(e.target.value)})}/></label><button className="text-button remove" disabled={!settings.backgroundImage} onClick={() => setSettings({...settings,backgroundImage:undefined})}>Hintergrund entfernen</button></div></fieldset>
        <fieldset><legend>Startseite</legend>
          <label>Beim Start öffnen<SelectMenu label="Startseite" value={settings.startPage || "home"} options={[{value:"home",label:"Home"},{value:"games",label:"Steam"},{value:"apps",label:"Apps"},{value:"music",label:"Musik"},{value:"pc",label:"PC-Monitoring"}]} onChange={startPage => setSettings({...settings,startPage})}/></label>
          <div className="settings-checks">
            {([['showSystem','Systemwerte'],['showLibrary','Bibliothek'],['showMusic','Soundtrack'],['showDiscord','Discord']] as const).map(([key,label]) => <label key={key}><input type="checkbox" checked={enabled(key)} onChange={e => setSettings({...settings,[key]:e.target.checked})}/><span>{label}</span></label>)}
            <label><input type="checkbox" checked={settings.focusMode || false} onChange={e => setSettings({...settings,focusMode:e.target.checked})}/><span>Fokusmodus</span></label>
            <label><input type="checkbox" checked={settings.reduceMotion || false} onChange={e => setSettings({...settings,reduceMotion:e.target.checked})}/><span>Animationen reduzieren</span></label>
          </div>
        </fieldset>
      </section>
      <section className="panel info-panel">
        <div className="settings-section-head"><div className="connection-icon">S</div><div><h2>Steam-Verbindung</h2><p>Jeder Nutzer verwendet sein eigenes lokales Profil.</p></div></div>
        <label className="field-label">Steam-ID64<input inputMode="numeric" maxLength={17} value={settings.steamId || ""} onChange={event => setSettings({...settings,steamId:event.target.value.replace(/\D/g,"")})} placeholder="Wird automatisch erkannt" /></label>
        {steamProfiles.length > 0 && <div className="detected-profiles">{steamProfiles.map(profile => <button className={settings.steamId===profile.steamId?"active":""} key={profile.steamId} onClick={() => setSettings({...settings,steamId:profile.steamId})}><strong>Konto {profile.accountId}</strong><small>{profile.steamId}</small></button>)}</div>}
        <div className="settings-actions"><button className="secondary" onClick={() => void detectSteam()}>Lokale Konten erkennen</button></div>{steamStatus && <p className="muted" role="status">{steamStatus}</p>}
      </section>
      <section className="panel info-panel">
        <div className="settings-section-head"><div className="connection-icon">◈</div><div><h2>Gaming-Modus & Spielprofile</h2><p>Bereite Spiele, Begleitprogramme und Musik als ein gemeinsames Setup vor.</p></div></div>
        <div className="profile-list">{profiles.map(profile => <article key={profile.id}><label>Name<input value={profile.name} maxLength={60} onChange={event => setSettings({...settings,gamingProfiles:profiles.map(item => item.id===profile.id?{...item,name:event.target.value}:item)})}/></label><label>Spiel<SelectMenu label="Spiel auswählen" value={profile.gameId || ""} options={[{value:"",label:"Kein bestimmtes Spiel"},...games.map(game=>({value:game.id,label:game.name}))]} onChange={gameId => setSettings({...settings,gamingProfiles:profiles.map(item => item.id===profile.id?{...item,gameId:gameId||undefined}:item)})}/></label><label>Spotify-URI<input value={profile.spotifyUri || ""} onChange={event => setSettings({...settings,gamingProfiles:profiles.map(item => item.id===profile.id?{...item,spotifyUri:event.target.value}:item)})}/></label><div className="profile-actions"><label className="hub-check"><input type="checkbox" checked={profile.enabled} onChange={event => setSettings({...settings,gamingProfiles:profiles.map(item => item.id===profile.id?{...item,enabled:event.target.checked}:item)})}/><span>Aktiv</span></label><button className="text-button remove" onClick={() => setSettings({...settings,gamingProfiles:profiles.filter(item => item.id!==profile.id)})}>Entfernen</button></div></article>)}</div>
        <div className="settings-actions"><button className="secondary" onClick={addProfile}>＋ Spielprofil</button><button className="secondary" disabled={!profiles.length} onClick={exportProfiles}>Profile exportieren</button><button className="primary" disabled={!profiles.some(profile => profile.enabled)} onClick={() => { const selected=profiles.find(profile=>profile.id===settings.activeGamingProfile&&profile.enabled)||profiles.find(profile=>profile.enabled); if(selected){ setSettings({...settings,activeGamingProfile:selected.id,focusMode:true}); dispatchEvent(new CustomEvent("gaminghub:profile-activated",{detail:selected})); } }}>Gaming-Modus aktivieren</button></div>
        <p className="field-help">Der Gaming-Modus reduziert Ablenkungen. Profile können exportiert werden, enthalten aber niemals Passwörter oder Tokens.</p>
      </section>
      <section className="panel info-panel">
        <h2>Daten & Diagnose</h2>
        <div className="diagnostic-grid"><div><small>Speicher</small><strong>{Math.round(JSON.stringify(localStorage).length / 1024)} KB lokal</strong></div><div><small>Netzwerk</small><strong>{navigator.onLine ? "Online" : "Offline"}</strong></div><div><small>Spotify</small><strong>{sessionStorage.getItem("gaminghub.spotify.token") ? "Verbunden" : "Nicht verbunden"}</strong></div></div>
        <p>Deine Bibliothek und persönlichen Einstellungen bleiben lokal auf diesem PC. Spotify-Anmeldung, Discord-Token und Steam-API-Schlüssel werden niemals exportiert.</p>
        <div className="settings-actions"><button className="secondary" onClick={exportSettings}>Backup exportieren</button><label className="secondary import-button">Backup importieren<input type="file" accept="application/json,.json" onChange={e => void importBackup(e.target.files?.[0]).catch(error => alert(String(error)))} /></label><button className="secondary" onClick={() => location.reload()}>App neu laden</button></div>
        <div className="settings-actions"><button className="secondary" onClick={() => void fullDiagnostics()}>Vollständige Diagnose</button><button className="secondary" onClick={() => { const repaired=repairLocalData(); setRepairStatus(repaired.length ? `${repaired.length} beschädigte Bereiche wurden gesichert und zurückgesetzt. Bitte App neu laden.` : "Keine beschädigten lokalen Daten gefunden."); void fullDiagnostics(); }}>Automatisch reparieren</button><button className="secondary" onClick={() => void invoke<string>("read_crash_log").then(text => { const blob=new Blob([text],{type:"text/plain"}); const url=URL.createObjectURL(blob); const link=document.createElement("a"); link.href=url; link.download="gaminghub-diagnose.txt"; link.click(); URL.revokeObjectURL(url); }).catch(error => setRepairStatus(String(error)))}>Diagnose exportieren</button></div>
        {diagnostics.length > 0 && <div className="diagnostic-results">{diagnostics.map(item => <div key={item.name} data-status={item.status}><i>{item.status === "ok" ? "✓" : item.status === "warning" ? "!" : "×"}</i><span><strong>{item.name}</strong><small>{item.detail}</small></span></div>)}</div>}{repairStatus && <p className="notice" role="status">{repairStatus}</p>}
      </section>
      <section className="panel info-panel update-settings">
        <div className="settings-section-head"><div className="connection-icon">↻</div><div><h2>GamingHub Updates</h2><p>Neue signierte Versionen automatisch erkennen und direkt installieren.</p></div></div>
        <div className="settings-checks"><label><input type="checkbox" checked={settings.automaticUpdates !== false} onChange={e => setSettings({...settings,automaticUpdates:e.target.checked})}/><span>Beim Start automatisch nach Updates suchen</span></label></div>
        <label className="field-label">Update-Kanal<SelectMenu label="Update-Kanal" value={settings.updateChannel || "stable"} options={[{value:"stable",label:"Stable – empfohlen"},{value:"beta",label:"Beta – früher testen"},{value:"experimental",label:"Experimental – intern"}]} onChange={updateChannel => setSettings({...settings,updateChannel})}/></label>
        <div className="settings-checks"><label><input type="checkbox" checked={settings.commandCenterEnabled !== false} onChange={e => setSettings({...settings,commandCenterEnabled:e.target.checked})}/><span>Command Center aktivieren (Strg + Umschalt + G)</span></label></div>
        <div className="settings-actions"><button className="primary" onClick={() => dispatchEvent(new Event("gaminghub:check-update"))}>Jetzt nach Updates suchen</button></div>
        <p className="field-help">Update-Pakete werden vor der Installation kryptografisch geprüft. Manipulierte Dateien weist GamingHub ab.</p>
      </section>
      <section className="panel info-panel privacy-panel">
        <h2>Datenschutz & verbundene Dienste</h2>
        <div className="privacy-list"><div><strong>Spotify</strong><p>Anmeldung und Wiedergabe laufen direkt über Spotify. Die Sitzung bleibt nur bis zum Schließen der App erhalten.</p></div><div><strong>Steam</strong><p>Lokale Bibliotheks- und Spielzeitdaten werden auf diesem PC gelesen. Ein eingegebener API-Schlüssel wird nach dem Abruf verworfen.</p></div><div><strong>Discord</strong><p>Ein Bot-Token wird nur für den aktuellen Abruf verwendet und nicht in GamingHub-Backups geschrieben.</p></div><div><strong>GamingHub</strong><p>Bibliothek, Designs und Notizen werden lokal gespeichert. Es gibt kein GamingHub-Cloudkonto.</p></div></div>
      </section>
      <section className="panel info-panel">
        <h2>Über GamingHub</h2>
        <div className="detail-row">
          <span>Version</span>
          <span>0.9.5 · Release Candidate</span>
        </div>
        <div className="detail-row">
          <span>Basis</span>
          <span>Tauri · React · TypeScript</span>
        </div>
        <p>
          Deine persönliche Zentrale mit getrennten Modulen. Weitere Bereiche
          können später ergänzt werden.
        </p>
      </section>
    </>
  );
}
