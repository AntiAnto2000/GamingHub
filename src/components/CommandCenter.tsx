import { useEffect, useState } from "react";
import type { Game, Settings } from "../modules/types";
import { controlEmbeddedMusic } from "../services/musicBridge";
import { readActivity, weeklyActivity } from "../services/activity";

export default function CommandCenter({ games, settings, navigate }: { games: Game[]; settings: Settings; navigate: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { const listener = () => setOpen(value => !value); addEventListener("gaminghub:toggle-command-center", listener); return () => removeEventListener("gaminghub:toggle-command-center", listener); }, []);
  if (settings.commandCenterEnabled === false || !open) return null;
  const week = weeklyActivity(readActivity());
  const recent = [...games].filter(game => game.lastLaunchedAt).sort((a,b) => (b.lastLaunchedAt || 0) - (a.lastLaunchedAt || 0))[0];
  return <aside className="command-center" aria-label="Command Center">
    <header><div><small>COMMAND CENTER</small><strong>GamingHub im Blick</strong></div><button onClick={() => setOpen(false)} aria-label="Schließen">×</button></header>
    <section><span>Diese Woche</span><strong>{week.launches} Starts · {week.activeDays} aktive Tage</strong><small>Meistgestartet: {week.favorite}</small></section>
    <div className="command-center-grid"><button onClick={() => void controlEmbeddedMusic("previous")}>⏮<small>Zurück</small></button><button onClick={() => void controlEmbeddedMusic("toggle")}>▶<small>Play/Pause</small></button><button onClick={() => void controlEmbeddedMusic("next")}>⏭<small>Weiter</small></button></div>
    {recent && <button className="command-center-recent" onClick={() => navigate("games")}><span>↶</span><div><small>ZULETZT GESTARTET</small><strong>{recent.name}</strong></div></button>}
    <nav><button onClick={() => navigate("home")}>Home</button><button onClick={() => navigate("music")}>Musik</button><button onClick={() => navigate("pc")}>System</button></nav>
  </aside>;
}
