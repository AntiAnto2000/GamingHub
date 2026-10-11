export default function Changelog({close}:{close:()=>void}){
  const entries=[
    ["01","Launcher zuerst","Die Minecraft-Seite öffnet jetzt direkt deine Prism-Modpacks; Launcher und Server wurden sinnvoll neu angeordnet."],
    ["02","Server-Mod direkt laden","Im Server-Dashboard findest du die passende Fabric-Telemetrie-Mod jetzt inklusive Voraussetzungen und Installationshinweis."],
    ["03","Musik & Design Feinschliff","Musikplayer, Klangstudio, Hintergründe und experimentelle Einstellungen wurden klarer und kompakter gestaltet."],
  ];
  return <div className="utility-modal-backdrop" onMouseDown={close}><section className="utility-modal changelog-modal" role="dialog" aria-modal="true" aria-label="Neu in Version 1.4.0" onMouseDown={event=>event.stopPropagation()}><header><span>✦</span><div><small>GAMINGHUB STABLE</small><h2>Neu in Version 1.4.0</h2></div><button className="utility-close" aria-label="Schließen" onClick={close}>×</button></header><div className="changelog-list">{entries.map(([number,title,text])=><article key={number}><b>{number}</b><div><strong>{title}</strong><p>{text}</p></div></article>)}</div><button className="primary modal-main" onClick={close}>Alles klar</button></section></div>;
}
