export default function Changelog({close}:{close:()=>void}){
  const entries=[
    ["01","Kompakte Modrinth-Bibliothek","Importierte Modpacks stehen jetzt oben; Suche und Import lassen sich platzsparend ein- und ausklappen."],
    ["02","Zuverlässiger Modrinth-Start","Modrinth wird direkt als eigener Prozess gestartet und der notwendige letzte Spielstart in der App klar erklärt."],
    ["03","Hintergrundthemen repariert","Graphit, Mitternacht, Wald, Aurora, Crimson und Tageslicht werden sofort und dauerhaft angewendet."],
  ];
  return <div className="utility-modal-backdrop" onMouseDown={close}><section className="utility-modal changelog-modal" role="dialog" aria-modal="true" aria-label="Neu in Version 1.2.1" onMouseDown={event=>event.stopPropagation()}><header><span>✦</span><div><small>GAMINGHUB STABLE</small><h2>Neu in Version 1.2.1</h2></div><button className="utility-close" aria-label="Schließen" onClick={close}>×</button></header><div className="changelog-list">{entries.map(([number,title,text])=><article key={number}><b>{number}</b><div><strong>{title}</strong><p>{text}</p></div></article>)}</div><button className="primary modal-main" onClick={close}>Alles klar</button></section></div>;
}
