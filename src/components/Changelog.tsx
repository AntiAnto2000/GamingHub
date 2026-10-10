export default function Changelog({close}:{close:()=>void}){
  const entries=[
    ["01","Prism-Launcher-Anbindung","GamingHub erkennt deine lokalen Prism-Instanzen und zeigt sie als kompakte Modpack-Bibliothek an."],
    ["02","Echter Modpack-Direktstart","Ein Klick startet die ausgewählte Instanz über Prisms offizielle Kommandozeile direkt."],
    ["03","Kompakter Import","Die Modpack-Suche bleibt eingeklappt, bis du neue Prism-Instanzen übernehmen möchtest."],
  ];
  return <div className="utility-modal-backdrop" onMouseDown={close}><section className="utility-modal changelog-modal" role="dialog" aria-modal="true" aria-label="Neu in Version 1.3" onMouseDown={event=>event.stopPropagation()}><header><span>✦</span><div><small>GAMINGHUB STABLE</small><h2>Neu in Version 1.3</h2></div><button className="utility-close" aria-label="Schließen" onClick={close}>×</button></header><div className="changelog-list">{entries.map(([number,title,text])=><article key={number}><b>{number}</b><div><strong>{title}</strong><p>{text}</p></div></article>)}</div><button className="primary modal-main" onClick={close}>Alles klar</button></section></div>;
}
