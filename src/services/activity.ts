export type ActivityKind = "launch" | "music" | "achievement" | "system" | "profile";
export interface ActivityEntry { id: string; kind: ActivityKind; title: string; detail: string; timestamp: number }
const KEY = "gaminghub.activity.v1";
export function readActivity(): ActivityEntry[] {
  try { const value = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(value) ? value.slice(0, 250) : []; } catch { return []; }
}
export function addActivity(kind: ActivityKind, title: string, detail: string) {
  const next = [{ id: crypto.randomUUID(), kind, title, detail, timestamp: Date.now() }, ...readActivity()].slice(0, 250);
  localStorage.setItem(KEY, JSON.stringify(next));
  dispatchEvent(new CustomEvent("gaminghub:activity", { detail: next }));
}
export function weeklyActivity(entries: ActivityEntry[]) {
  const cutoff = Date.now() - 7 * 86400000;
  const recent = entries.filter(entry => entry.timestamp >= cutoff);
  const launches = recent.filter(entry => entry.kind === "launch");
  const counts = launches.reduce<Record<string, number>>((all, entry) => ({ ...all, [entry.title]: (all[entry.title] || 0) + 1 }), {});
  const favorite = Object.entries(counts).sort((a,b) => b[1] - a[1])[0];
  return { events: recent.length, launches: launches.length, favorite: favorite?.[0] || "Noch keines", activeDays: new Set(recent.map(entry => new Date(entry.timestamp).toDateString())).size };
}
