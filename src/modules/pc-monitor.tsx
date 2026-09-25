import { Heading, Metrics } from "../components/ui";
import { useNative, gib } from "../services/native";
export default function PcMonitor() {
  const { telemetry: data, history, error, native } = useNative();
  const ram = data?.ramTotal ? data.ramUsed / data.ramTotal * 100 : null;
  const status = (value: number | null | undefined) => value == null ? ["Wartet", "idle"] : value >= 90 ? ["Kritisch", "danger"] : value >= 75 ? ["Hoch", "warn"] : ["Normal", "good"];
  const health = [["CPU", data?.cpu], ["GPU", data?.gpu], ["RAM", ram]] as const;
  return (
    <>
      <Heading eyebrow="DEIN SETUP · LIVE" title="PC-Monitoring">
        Echte Systemwerte, alle zwei Sekunden aktualisiert.
      </Heading>
      <Metrics />
      <section className="health-strip" aria-label="Systemzustand">{health.map(([label,value]) => { const [text,tone]=status(value); return <div className={`health-item ${tone}`} key={label}><span>{label}</span><strong>{text}</strong><small>{value == null ? "–" : `${value.toFixed(0)} %`}</small></div>; })}<div className={`health-item ${data?.gpuTemperature != null && data.gpuTemperature >= 85 ? "danger" : data?.gpuTemperature != null && data.gpuTemperature >= 75 ? "warn" : "good"}`}><span>GPU TEMP</span><strong>{data?.gpuTemperature == null ? "Nicht verfügbar" : data.gpuTemperature >= 85 ? "Kritisch" : data.gpuTemperature >= 75 ? "Warm" : "Normal"}</strong><small>{data?.gpuTemperature == null ? "–" : `${data.gpuTemperature} °C`}</small></div></section>
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      {!native && (
        <p className="notice">
          Live-Messwerte sind im Desktopfenster verfügbar.
        </p>
      )}
      <section className="panel info-panel">
        <div className="section-title">
          <h2>Auslastungsverlauf</h2>
          <span className="pill neutral">
            Letzte {history.length * 2} Sekunden
          </span>
        </div>
        <div className="chart-legend">
          <span>CPU</span>
          <span>GPU</span>
          <span>RAM</span>
        </div>
        <svg
          className="performance-chart"
          viewBox="0 0 600 150"
          role="img"
          aria-label="Auslastungsverlauf CPU, GPU und RAM von 0 bis 100 Prozent"
        >
          <path
            d="M0 10H600 M0 75H600 M0 140H600"
            stroke="#344032"
            fill="none"
          />
          {(["cpu", "gpu", "ram"] as const).map((metric, index) => (
            <polyline
              key={metric}
              fill="none"
              stroke={["#b9f57b", "#c3a2ff", "#70c9eb"][index]}
              strokeWidth="2"
              points={history
                .flatMap((sample, i) => {
                  const val =
                    metric === "ram"
                      ? sample.ramTotal
                        ? (sample.ramUsed / sample.ramTotal) * 100
                        : null
                      : sample[metric];
                  return val === null
                    ? []
                    : [`${(i * 600) / 59},${140 - val * 1.3}`];
                })
                .join(" ")}
            />
          ))}
        </svg>
        <div className="muted">
          Oben 100 % · unten 0 %. Systemweite Werte, nicht nur das aktive Spiel.
        </div>
      </section>
      <section className="panel info-panel">
        <h2>Hardware & Speicher</h2>
        {[
          ["Prozessor", data?.cpuName || "Wird ermittelt …"],
          ["Grafikkarte", data?.gpuName || "Nicht verfügbar"],
          [
            "GPU-Temperatur",
            data?.gpuTemperature == null
              ? "Nicht verfügbar"
              : `${data.gpuTemperature} °C`,
          ],
          [
            "Grafikspeicher",
            `${gib(data?.vramUsed)} / ${gib(data?.vramTotal)}`,
          ],
          ["Arbeitsspeicher", `${gib(data?.ramUsed)} / ${gib(data?.ramTotal)}`],
          [
            "Letzte Messung",
            data
              ? new Date(data.timestamp * 1000).toLocaleTimeString("de-DE")
              : "Noch keine",
          ],
        ].map(([label, value]) => (
          <div className="detail-row" key={label}>
            <span>{label}</span>
            <span>{value}</span>
          </div>
        ))}
        {data?.gpuError && (
          <p className="notice">GPU-Messung nicht verfügbar: {data.gpuError}</p>
        )}
        <p className="muted">
          GPU-Daten kommen direkt vom NVIDIA-Treiber (erste NVIDIA-GPU). Andere
          GPU-Hersteller und CPU-Temperaturen sind noch nicht unterstützt.
        </p>
      </section>
    </>
  );
}
