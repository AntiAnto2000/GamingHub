export interface DiagnosticResult { name: string; status: "ok" | "warning" | "error"; detail: string }
const LOCAL_KEYS = ["gaminghub.settings.v1", "gaminghub.games.v1", "gaminghub.activity.v1", "gaminghub.moduleOrder.v1"];
export function runLocalDiagnostics(): DiagnosticResult[] {
  const results: DiagnosticResult[] = [];
  for (const key of LOCAL_KEYS) {
    const raw = localStorage.getItem(key);
    if (!raw) { results.push({ name: key, status: "warning", detail: "Noch nicht angelegt" }); continue; }
    try { JSON.parse(raw); results.push({ name: key, status: "ok", detail: `${Math.round(raw.length / 1024 * 10) / 10} KB · gültig` }); }
    catch { results.push({ name: key, status: "error", detail: "Beschädigtes JSON erkannt" }); }
  }
  results.push({ name: "Netzwerk", status: navigator.onLine ? "ok" : "warning", detail: navigator.onLine ? "Online" : "Offline" });
  results.push({ name: "Speicher", status: "ok", detail: `${Math.round(JSON.stringify(localStorage).length / 1024)} KB lokal verwendet` });
  return results;
}
export function repairLocalData(): string[] {
  const repaired: string[] = [];
  for (const key of LOCAL_KEYS) {
    const raw = localStorage.getItem(key); if (!raw) continue;
    try { JSON.parse(raw); } catch { localStorage.setItem(`${key}.recovery.${Date.now()}`, raw); localStorage.removeItem(key); repaired.push(key); }
  }
  return repaired;
}
