export default function Changelog({close}:{close:()=>void}){
  const entries=[
    ["01","Kompaktes Minecraft-Modul","Das Server-Dashboard bleibt zunächst verborgen und öffnet sich erst über einen klaren Button."],
    ["02","Weniger Hintergrundlast","Serverstatus und Telemetrie werden nur regelmäßig abgefragt, solange das Dashboard geöffnet ist."],
    ["03","Sicherer Auto-Updater","GamingHub erkennt signierte Releases, lädt sie mit Fortschrittsanzeige und startet nach der Installation neu."],
    ["04","Friends-Beta Feinschliff","Windows-Benachrichtigungen und geschützte Minecraft-Telemetrie-Tokens bleiben vollständig integriert."],
  ];
  return <div className="utility-modal-backdrop" onMouseDown={close}><section className="utility-modal changelog-modal" role="dialog" aria-modal="true" aria-label="Neu in Version 0.8.1" onMouseDown={event=>event.stopPropagation()}><header><span>✦</span><div><small>GAMINGHUB EARLY ACCESS</small><h2>Neu in Version 0.8.1</h2></div><button className="utility-close" aria-label="Schließen" onClick={close}>×</button></header><div className="changelog-list">{entries.map(([number,title,text])=><article key={number}><b>{number}</b><div><strong>{title}</strong><p>{text}</p></div></article>)}</div><button className="primary modal-main" onClick={close}>Alles klar</button></section></div>;
}
