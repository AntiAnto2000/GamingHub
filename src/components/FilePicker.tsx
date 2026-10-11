import { useRef, useState } from "react";

type Props = {
  accept?: string;
  label: string;
  hint?: string;
  disabled?: boolean;
  compact?: boolean;
  onFile: (file: File) => void | Promise<void>;
};

export default function FilePicker({ accept, label, hint, disabled, compact, onFile }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [dragging, setDragging] = useState(false);

  const choose = async (file?: File) => {
    if (!file || disabled) return;
    setFileName(file.name);
    await onFile(file);
    if (input.current) input.current.value = "";
  };

  return <div
    className={`hub-file-picker${compact ? " compact" : ""}${dragging ? " dragging" : ""}${disabled ? " disabled" : ""}`}
    onDragEnter={event => { event.preventDefault(); if (!disabled) setDragging(true); }}
    onDragOver={event => event.preventDefault()}
    onDragLeave={() => setDragging(false)}
    onDrop={event => { event.preventDefault(); setDragging(false); void choose(event.dataTransfer.files?.[0]); }}
  >
    <input ref={input} type="file" accept={accept} disabled={disabled} onChange={event => void choose(event.target.files?.[0])}/>
    <button type="button" className="hub-file-action" disabled={disabled} onClick={() => input.current?.click()}>
      <span className="hub-file-icon">⇧</span><span><strong>{label}</strong><small>{fileName || hint || "Datei auswählen oder hier ablegen"}</small></span>
    </button>
    {fileName && <span className="hub-file-ready" title={fileName}>✓ Ausgewählt</span>}
  </div>;
}
