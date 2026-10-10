export default function Changelog({close}:{close:()=>void}){
  const entries=[
    ["01","Modrinth-Modpacks","Lokale Modrinth-Profile lassen sich finden, importieren und direkt aus der Minecraft-Bibliothek öffnen."],
    ["02","Hintergrundthemen repariert","Graphit, Mitternacht, Wald, Aurora, Crimson und Tageslicht werden jetzt sofort und dauerhaft angewendet."],
    ["03","Neues Designsystem","Player-Icons, Einstellungen, Abstände und Bedienelemente sind klarer und symmetrischer."],
  ];
  return <div className="utility-modal-backdrop" onMouseDown={close}><section className="utility-modal changelog-modal" role="dialog" aria-modal="true" aria-label="Neu in Version 1.2" onMouseDown={event=>event.stopPropagation()}><header><span>✦</span><div><small>GAMINGHUB STABLE</small><h2>Neu in Version 1.2</h2></div><button className="utility-close" aria-label="Schließen" onClick={close}>×</button></header><div className="changelog-list">{entries.map(([number,title,text])=><article key={number}><b>{number}</b><div><strong>{title}</strong><p>{text}</p></div></article>)}</div><button className="primary modal-main" onClick={close}>Alles klar</button></section></div>;
}
