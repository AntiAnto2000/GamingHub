export default function Changelog({close}:{close:()=>void}){
  const entries=[
    ["01","Sicherer Auto-Updater","GamingHub prüft beim Start auf neue Versionen, lädt sie mit Fortschrittsanzeige und installiert ausschließlich kryptografisch signierte Pakete."],
    ["02","Update-Zentrale","In den Einstellungen lassen sich automatische Prüfungen steuern und jederzeit manuell starten."],
    ["03","Windows-Benachrichtigungen","Timer und Wecker können sich künftig auch außerhalb des sichtbaren GamingHub-Fensters melden."],
    ["04","Release vorbereitet","Signierte Update-Artefakte und ein sauberer GitHub-Releases-Workflow bilden die Basis für die Friends Beta."],
  ];
  return <div className="utility-modal-backdrop" onMouseDown={close}><section className="utility-modal changelog-modal" role="dialog" aria-modal="true" aria-label="Neu in Version 0.8" onMouseDown={event=>event.stopPropagation()}><header><span>✦</span><div><small>GAMINGHUB EARLY ACCESS</small><h2>Neu in Version 0.8</h2></div><button className="utility-close" aria-label="Schließen" onClick={close}>×</button></header><div className="changelog-list">{entries.map(([number,title,text])=><article key={number}><b>{number}</b><div><strong>{title}</strong><p>{text}</p></div></article>)}</div><button className="primary modal-main" onClick={close}>Alles klar</button></section></div>;
}
