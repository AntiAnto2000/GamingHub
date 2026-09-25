import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
export interface Telemetry {
  timestamp: number;
  cpu: number;
  cpuName: string;
  ramUsed: number;
  ramTotal: number;
  gpu: number | null;
  gpuName: string | null;
  gpuTemperature: number | null;
  vramUsed: number | null;
  vramTotal: number | null;
  gpuError: string | null;
}
export interface Session {
  id: string;
  gameId: string;
  name: string;
  path: string;
  startedAt: number;
  updatedAt: number;
  endedAt: number | null;
  durationSeconds: number;
  status: string;
  exitCode: number | null;
  samples: number;
  cpuSum: number;
  cpuPeak: number;
  gpuSamples: number;
  gpuSum: number;
  gpuPeak: number | null;
  ramPeak: number;
}
interface Snapshot {
  telemetry: Telemetry | null;
  sessions: Session[];
  storageError: string | null;
}
interface HubState extends Snapshot {
  history: Telemetry[];
  error: string;
  native: boolean;
  refresh: () => Promise<void>;
}
const Context = createContext<HubState>({
  telemetry: null,
  sessions: [],
  storageError: null,
  history: [],
  error: "",
  native: false,
  refresh: async () => {},
});
export function NativeProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<Snapshot>({
    telemetry: null,
    sessions: [],
    storageError: null,
  });
  const [error, setError] = useState("");
  const [history, setHistory] = useState<Telemetry[]>([]);
  const native = isTauri();
  async function refresh() {
    if (!native) return;
    try {
      const data = await invoke<Snapshot>("hub_snapshot");
      setSnapshot(data);
      setError("");
      if (data.telemetry)
        setHistory((old) =>
          old[old.length - 1]?.timestamp === data.telemetry!.timestamp
            ? old
            : [...old.slice(-59), data.telemetry!],
        );
    } catch (e) {
      setError(String(e));
    }
  }
  useEffect(() => {
    if (!native) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      await refresh();
      if (!cancelled) timer = setTimeout(poll, 2000);
    }
    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [native]);
  const stale =
    snapshot.telemetry && Date.now() / 1000 - snapshot.telemetry.timestamp > 10;
  return (
    <Context.Provider
      value={{
        ...snapshot,
        telemetry: stale || error ? null : snapshot.telemetry,
        history,
        error:
          error ||
          (stale
            ? "Messdaten sind veraltet. Bitte GamingHub neu starten."
            : ""),
        native,
        refresh,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useNative = () => useContext(Context);
export function gib(bytes: number | null | undefined) {
  return bytes == null ? "—" : `${(bytes / 1073741824).toFixed(1)} GB`;
}
export function duration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return hours
    ? `${hours} Std. ${mins} Min.`
    : mins
      ? `${mins} Min. ${Math.floor(seconds % 60)} Sek.`
      : `${Math.floor(seconds)} Sek.`;
}
export const statusLabel: Record<string, string> = {
  running: "Läuft",
  completed: "Beendet",
  exited_with_error: "Mit Fehlercode beendet",
  interrupted: "Aufzeichnung unterbrochen",
  manual: "Manuell abgeschlossen",
  tracking_lost: "Prozessüberwachung verloren",
};
