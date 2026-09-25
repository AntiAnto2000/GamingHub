import { useNative, gib } from "../services/native";
import { useEffect, useRef, useState, type ReactNode } from "react";

export function SelectMenu<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly { value: T; label: string }[]; onChange: (value: T) => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    addEventListener("mousedown", close); return () => removeEventListener("mousedown", close);
  }, []);
  const current = options.find(option => option.value === value)?.label || value;
  return <div className={"hub-select" + (open ? " open" : "")} ref={root}>
    <button type="button" className="hub-select-trigger" aria-label={label} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(value => !value)}><span>{current}</span><i>⌄</i></button>
    {open && <div className="hub-select-menu" role="listbox" aria-label={label}>{options.map(option => <button type="button" role="option" aria-selected={option.value === value} key={option.value} onClick={() => { onChange(option.value); setOpen(false); }}><span>{option.label}</span>{option.value === value && <b>✓</b>}</button>)}</div>}
  </div>;
}
export function Heading({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="page-heading">
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      <p>{children}</p>
    </div>
  );
}
export function Metrics() {
  const { telemetry: data, native, error } = useNative();
  const cards = [
    {
      name: "CPU",
      value: data?.cpu,
      detail: data?.cpuName || "Prozessorauslastung",
      note: "Systemweite CPU-Auslastung",
    },
    {
      name: "GPU",
      value: data?.gpu,
      detail: data?.gpuName || "Grafikauslastung",
      note:
        data?.gpuTemperature != null
          ? `${data.gpuTemperature} °C · ${gib(data.vramUsed)} VRAM`
          : data?.gpuError
            ? "Treiber liefert keinen Wert"
            : "NVIDIA-Treibermessung",
    },
    {
      name: "RAM",
      value: data?.ramTotal ? (data.ramUsed / data.ramTotal) * 100 : null,
      detail: "Arbeitsspeicher",
      note: data
        ? `${gib(data.ramUsed)} / ${gib(data.ramTotal)}`
        : "Systemweiter Speicher",
    },
  ];
  return (
    <div className="metrics">
      {cards.map((m) => (
        <section className="panel metric" key={m.name}>
          <div className="metric-top">
            <span>{m.name}</span>
            <span aria-hidden="true">◈</span>
          </div>
          <div className="metric-value">
            {m.value == null ? "—" : m.value.toFixed(1)}
            <small> %</small>
          </div>
          <div className="meter">
            <span
              style={{ width: `${Math.min(100, Math.max(0, m.value ?? 0))}%` }}
            />
          </div>
          <p className="metric-note" title={m.detail}>
            {m.detail}
          </p>
          <small className="muted metric-note" title={m.note}>
            {!native
              ? "Im Desktopfenster verfügbar"
              : error
                ? "Messung unterbrochen"
                : !data
                  ? "Erste Messung läuft …"
                  : m.note}
          </small>
        </section>
      ))}
    </div>
  );
}
export function Empty({
  icon,
  title,
  children,
  action,
}: {
  icon: string;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon" aria-hidden="true">
        {icon}
      </div>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
