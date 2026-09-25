import { useState } from "react";
export default function GameImagePicker({ value, onChange }: { value?: string; onChange: (value?: string) => void }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function read(file?: File) {
    if (!file) return;
    setError(""); setBusy(true);
    let url = "";
    try {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) throw Error("Bitte JPG, PNG oder WebP bis 10 MB auswählen.");
      url = URL.createObjectURL(file);
      const img = new Image(); img.src = url; await img.decode();
      const canvas = document.createElement("canvas"); canvas.width = 512; canvas.height = 288;
      const ctx = canvas.getContext("2d"); if (!ctx) throw Error("Bild konnte nicht verarbeitet werden.");
      const scale = Math.max(512 / img.width, 288 / img.height);
      ctx.drawImage(img, (512 - img.width * scale) / 2, (288 - img.height * scale) / 2, img.width * scale, img.height * scale);
      const data = canvas.toDataURL("image/jpeg", 0.75);
      if (data.length >= 250000) throw Error("Das Bild ist zu detailreich. Bitte ein kleineres Bild wählen.");
      onChange(data);
    } catch (e) { setError(String(e)); }
    finally { if (url) URL.revokeObjectURL(url); setBusy(false); }
  }
  return <div><label>Spielbild / Icon<input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={e => { void read(e.target.files?.[0]); e.target.value = ""; }} /></label>
    <p className="muted">Das Bild wird mittig auf 16:9 zugeschnitten und lokal gespeichert. JPG, PNG oder WebP, maximal 10 MB.</p>
    {value && <><img className="cover-preview" src={value} alt="Vorschau des Spielbilds" /><button type="button" className="text-button" onClick={() => onChange(undefined)}>Standardbild verwenden</button></>}
    {busy && <p role="status">Bild wird vorbereitet …</p>}{error && <p role="alert">{error}</p>}
  </div>;
}
