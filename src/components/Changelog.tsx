export default function Changelog({close}:{close:()=>void}){
  const entries=[
    ["01","Neue Player-Steuerung","Start, Pause, Stopp sowie Vor- und Zurück verwenden jetzt klare, einheitliche Vektor-Icons."],
    ["02","Symmetrische Einstellungen","Sektionen, Aktionszeilen, Profilfelder, Checkboxen und Farbauswahl folgen demselben Raster."],
    ["03","Ruhigeres Design","Abstände, Radien, Größen und Interaktionen wurden appweit harmonisiert."],
  ];
  return <div className="utility-modal-backdrop" onMouseDown={close}><section className="utility-modal changelog-modal" role="dialog" aria-modal="true" aria-label="Neu in Version 1.1" onMouseDown={event=>event.stopPropagation()}><header><span>✦</span><div><small>GAMINGHUB STABLE</small><h2>Neu in Version 1.1</h2></div><button className="utility-close" aria-label="Schließen" onClick={close}>×</button></header><div className="changelog-list">{entries.map(([number,title,text])=><article key={number}><b>{number}</b><div><strong>{title}</strong><p>{text}</p></div></article>)}</div><button className="primary modal-main" onClick={close}>Alles klar</button></section></div>;
}
