export default function Changelog({close}:{close:()=>void}){
  const entries=[
    ["01","Update-Pfadschutz","GamingHub erkennt alte oder manuell angeheftete Programmdateien und wechselt sicher zur installierten Version."],
    ["02","Stabile Taskleisten-Updates","Offizielle Installationen bleiben am gleichen Speicherort, sodass angeheftete Verknüpfungen auch nach Updates gültig bleiben."],
    ["03","Prism-Launcher-Anbindung","Lokale Prism-Instanzen lassen sich weiterhin direkt aus GamingHub starten."],
  ];
  return <div className="utility-modal-backdrop" onMouseDown={close}><section className="utility-modal changelog-modal" role="dialog" aria-modal="true" aria-label="Neu in Version 1.3.1" onMouseDown={event=>event.stopPropagation()}><header><span>✦</span><div><small>GAMINGHUB STABLE</small><h2>Neu in Version 1.3.1</h2></div><button className="utility-close" aria-label="Schließen" onClick={close}>×</button></header><div className="changelog-list">{entries.map(([number,title,text])=><article key={number}><b>{number}</b><div><strong>{title}</strong><p>{text}</p></div></article>)}</div><button className="primary modal-main" onClick={close}>Alles klar</button></section></div>;
}
