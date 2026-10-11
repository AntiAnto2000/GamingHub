export default function Changelog({close}:{close:()=>void}){
  const entries=[
    ["01","Widgets frei anordnen","Home-Widgets lassen sich im Anpassungsmodus per Drag-and-drop neu sortieren und bleiben dauerhaft gespeichert."],
    ["02","Saubere Widget-Fenster","Kalender, Timer, Wecker, Uhr und Stoppuhr öffnen zuverlässig über dem gesamten Home-Bereich."],
    ["03","GamingHub Datei-Upload","Bilder, Profile und Backups verwenden jetzt ein einheitliches Upload-Design mit Drag-and-drop."],
    ["04","Home & Einstellungen","Das Discord-Widget passt sich der Akzentfarbe an und die erweiterten Einstellungen haben saubere Abstände."],
  ];
  return <div className="utility-modal-backdrop" onMouseDown={close}><section className="utility-modal changelog-modal" role="dialog" aria-modal="true" aria-label="Neu in Version 1.4.1" onMouseDown={event=>event.stopPropagation()}><header><span>✦</span><div><small>GAMINGHUB STABLE</small><h2>Neu in Version 1.4.1</h2></div><button className="utility-close" aria-label="Schließen" onClick={close}>×</button></header><div className="changelog-list">{entries.map(([number,title,text])=><article key={number}><b>{number}</b><div><strong>{title}</strong><p>{text}</p></div></article>)}</div><button className="primary modal-main" onClick={close}>Alles klar</button></section></div>;
}
