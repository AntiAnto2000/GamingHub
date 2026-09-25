import { useCallback, useEffect, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

type Phase = "idle" | "checking" | "available" | "downloading" | "current" | "error" | "unconfigured";
const CONFIGURED = true;

export default function UpdateCenter({ automatic = true }: { automatic?: boolean }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState(0);
  const [update, setUpdate] = useState<Update | null>(null);
  const running = useRef(false);
  const runCheck = useCallback(async (manual = false) => {
    if (running.current) return;
    if (!CONFIGURED) { setPhase("unconfigured"); setMessage("Der sichere Updater ist eingebaut. Zum Aktivieren fehlt nur noch das GitHub-Repository."); return; }
    if (!isTauri()) { setPhase("error"); setMessage("Update-Prüfungen funktionieren nur in der installierten GamingHub-App."); return; }
    running.current = true; setPhase("checking"); setMessage("Suche nach einer neuen GamingHub-Version …");
    try {
      const found = await check({ timeout: 15000 });
      if (!found) { setPhase("current"); setMessage("GamingHub ist aktuell."); if (!manual) window.setTimeout(() => setPhase("idle"), 4000); return; }
      setUpdate(found); setPhase("available"); setMessage(`Version ${found.version} ist bereit.`);
    } catch (error) { setPhase("error"); setMessage(`Update-Prüfung fehlgeschlagen: ${String(error)}`); }
    finally { running.current = false; }
  }, []);
  useEffect(() => {
    const listener = () => void runCheck(true);
    addEventListener("gaminghub:check-update", listener);
    const timer = automatic ? window.setTimeout(() => void runCheck(false), 5000) : undefined;
    return () => { removeEventListener("gaminghub:check-update", listener); if (timer) clearTimeout(timer); };
  }, [automatic, runCheck]);
  async function install() {
    if (!update) return;
    setPhase("downloading"); setMessage("Update wird sicher heruntergeladen …"); let total = 0, received = 0;
    try {
      await update.downloadAndInstall(event => {
        if (event.event === "Started") total = event.data.contentLength ?? 0;
        if (event.event === "Progress") { received += event.data.chunkLength; setProgress(total ? Math.min(100, Math.round(received / total * 100)) : 0); }
        if (event.event === "Finished") { setProgress(100); setMessage("Update installiert. GamingHub wird neu gestartet."); }
      });
      await relaunch();
    } catch (error) { setPhase("error"); setMessage(`Installation fehlgeschlagen: ${String(error)}`); }
  }
  if (phase === "idle") return null;
  return <section className="update-center" role="status" aria-live="polite"><span className="update-icon">↻</span><div><small>GAMINGHUB UPDATE</small><strong>{phase === "available" ? `Version ${update?.version}` : phase === "downloading" ? `Download ${progress}%` : "Updater"}</strong><p>{message}</p>{phase === "downloading" && <div className="update-progress"><i style={{width:`${progress}%`}} /></div>}</div>{phase === "available" && <button className="primary" onClick={() => void install()}>Installieren</button>}{(phase === "current" || phase === "error" || phase === "unconfigured") && <button className="utility-close" aria-label="Schließen" onClick={() => setPhase("idle")}>×</button>}</section>;
}
