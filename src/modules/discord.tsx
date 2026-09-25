import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Heading } from "../components/ui";
import { useNative } from "../services/native";
interface Server { id: string; name: string }
interface Channel { id: string; name: string; type: number }
export interface Message { id: string; content: string; timestamp: string; author: { username: string; global_name?: string }; attachments: { filename: string }[] }
export let recentMessages: Message[] = [];
const serverKey = "gaminghub.discordServers.v1";
const selectionKey = "gaminghub.discordSelection.v1";
export function authorColor(name: string) { const colors=["#b9f57b","#c3a2ff","#70c9eb","#ffb86b","#ff8fab","#8be9fd"]; let n=0; for(const c of name)n=(n*31+c.charCodeAt(0))>>>0; return colors[n%colors.length]; }
export default function Discord() {
  const { native } = useNative();
  const [token, setToken] = useState("");
  const [servers, setServers] = useState<Server[]>(() => { try { return JSON.parse(localStorage.getItem(serverKey) || "[]"); } catch { return []; } });
  const [channels, setChannels] = useState<Channel[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const savedSelection = (() => { try { return JSON.parse(localStorage.getItem(selectionKey) || "{}"); } catch { return {}; } })();
  const [server, setServer] = useState(String(savedSelection.server || "")); const [channel, setChannel] = useState(String(savedSelection.channel || ""));
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [at, setAt] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  async function load(kind: string, id = "") {
    setBusy(true); setError("");
    try {
      const data = await invoke<Server[] | Channel[] | Message[]>("discord_read", { token: token.trim(), kind, id });
      if (kind === "servers") { const list=data as Server[]; setServers(list); localStorage.setItem(serverKey,JSON.stringify(list)); setConnected(true); setConnecting(false); }
      else if (kind === "channels") {
        const list = (data as Channel[]).filter(c => c.type === 0 || c.type === 5);
        setChannels(list);
        const preferred = list.some(item => item.id === channel) ? channel : list[0]?.id || "";
        if (preferred) { setChannel(preferred); localStorage.setItem(selectionKey, JSON.stringify({server:id,channel:preferred})); await load("messages", preferred); }
      }
      else { setMessages(data as Message[]); recentMessages = data as Message[]; setAt(new Date().toLocaleTimeString("de-DE")); }
    } catch (e) { setError(String(e)); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    if (!native) return;
    void invoke<boolean>("discord_token_status").then(async saved => {
      setConnected(saved);
      if (!saved) { setConnecting(true); return; }
      if (server) await load("channels", server); else await load("servers");
    }).catch(reason => { setError(String(reason)); setConnecting(true); });
  }, [native]);
  async function connect() {
    setBusy(true); setError("");
    try { await invoke("discord_save_token", { token: token.trim() }); setToken(""); setConnected(true); await load("servers"); }
    catch (reason) { setError(String(reason)); }
    finally { setBusy(false); }
  }
  async function forget() {
    setBusy(true);
    try { await invoke("discord_forget_token"); localStorage.removeItem(serverKey); localStorage.removeItem(selectionKey); setServers([]); clear(); setConnected(false); setConnecting(true); setToken(""); setError(""); }
    catch (reason) { setError(String(reason)); }
    finally { setBusy(false); }
  }
  function clear() { setChannels([]); setMessages([]); setServer(""); setChannel(""); setAt(""); }
  return <>
    <Heading eyebrow="DEINE COMMUNITY" title="Discord">Lies die letzten Nachrichten deiner Serverkanäle.</Heading>
    <section className="panel form-panel discord-connect-panel">
      <div className="section-title"><div><h2>Deine Server</h2><p className="muted">Einmal verbinden – danach bleibt Discord über den sicheren Windows-Anmeldespeicher angemeldet.</p></div><span className={"discord-connection-state " + (connected ? "online" : "")}>{connected ? "● VERBUNDEN" : "○ NICHT VERBUNDEN"}</span></div>
      {connected && !connecting && <><div className="discord-actions"><button className="secondary" disabled={busy} onClick={() => void load("servers")}>Server aktualisieren</button><button className="text-button danger-text" disabled={busy} onClick={() => void forget()}>Verbindung vergessen</button></div><div className="saved-server-list">{servers.map(s=><button key={s.id} className={"saved-server " + (server===s.id ? "active" : "")} onClick={()=>{setServer(s.id);setChannel("");localStorage.setItem(selectionKey,JSON.stringify({server:s.id,channel:""}));void load("channels",s.id)}}><span className="discord-server-mark">{s.name.slice(0,2).toUpperCase()}</span><strong>{s.name}</strong><i>›</i></button>)}</div></>}
      {connecting && <>
      <p>Der Bot benötigt Lesezugriff auf deinen Server. Der Token wird verschlüsselt vom Windows-Anmeldespeicher verwaltet und nicht im Browser gespeichert.</p>
      <details><summary>Einrichtung Schritt für Schritt</summary><ol>
        <li>Im Discord Developer Portal eine Anwendung und einen Bot anlegen.</li>
        <li>Unter „Bot“ den „Message Content Intent“ einschalten.</li>
        <li>Den Bot über OAuth2 mit dem Scope „bot“ auf deinen Server einladen. Nur „View Channels“ und „Read Message History“ auswählen.</li>
        <li>Den Bot-Token hier eingeben, dann Server und Textkanal auswählen. Keinen persönlichen Account-Token verwenden.</li>
      </ol><p>Developer Portal: discord.com/developers/applications</p></details>
      <label>Bot-Token<input type="password" autoComplete="off" value={token} disabled={busy} onChange={e => setToken(e.target.value)} /></label>
      <div className="toolbar"><button className="primary" disabled={!native || busy || !token.trim()} onClick={() => void connect()}>{busy ? "Verbindet …" : "Sicher verbinden"}</button><button className="secondary" disabled={busy} onClick={() => setConnecting(false)}>Abbrechen</button></div>
      {busy && <p role="status">Discord wird geladen …</p>}{error && <p className="notice" role="alert">{error}</p>}
      </>}
    </section>
    {connected && server && <section className="panel form-panel discord-channel-panel"><div className="section-title"><h2>Textkanal</h2><button className="secondary" disabled={!channel || busy} onClick={() => void load("messages", channel)}>Aktualisieren</button></div><label>Kanal auswählen<select disabled={busy || !channels.length} value={channel} onChange={e => { const next=e.target.value; setChannel(next); setMessages([]); setAt(""); localStorage.setItem(selectionKey,JSON.stringify({server,channel:next})); if (next) void load("messages", next); }}><option value="">Textkanal auswählen</option>{channels.map(c => <option key={c.id} value={c.id}># {c.name}</option>)}</select></label>{busy && <p role="status">Discord wird geladen …</p>}{error && <p className="notice" role="alert">{error}</p>}</section>}
    {at && <section className="panel form-panel"><h2>Nachrichten · Stand {at}</h2><p className="muted">Bis zu 30 Nachrichten, neueste zuerst. Aktualisierung per Button.</p>
      {!messages.length && <p>Discord liefert keine Nachrichten. Prüfe bei Bedarf die Leserechte des Bots.</p>}
      {messages.map(m => { const author=m.author.global_name || m.author.username; return <article className="discord-message" key={m.id}><span className="discord-avatar" style={{background:authorColor(author)}}>{author.slice(0,1).toUpperCase()}</span><div className="discord-message-body"><div><strong style={{color:authorColor(author)}}>{author}</strong><small>{new Date(m.timestamp).toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"})}</small></div><p>{m.content || "Kein Text verfügbar: Anhang/Systemnachricht oder fehlender Message Content Intent."}</p>{m.attachments?.map(a => <span className="discord-attachment" key={a.filename}>📎 {a.filename}</span>)}</div></article>})}
    </section>}
    <section className="panel form-panel"><h2>Persönliche Nachrichten · noch nicht verbunden</h2><p>Ein Server-Bot kann deine persönlichen Chats nicht lesen. Die Anzeige über Windows-Benachrichtigungen benötigt eine zusätzliche Windows-App-Paketierung und eine Zugriffsfreigabe. Sie ist in dieser Version noch nicht verfügbar.</p><button className="secondary" disabled={!native} onClick={() => invoke("open_discord").catch(e => setError(String(e)))}>Persönliche Chats in Discord öffnen</button></section>
  </>;
}
