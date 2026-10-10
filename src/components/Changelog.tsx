export default function Changelog({close}:{close:()=>void}){
  const entries=[
    ["01","Universelle Bibliothek","Steam-Spiele, eigene Programme, Sammlungen und Profile leben jetzt an einem Ort."],
    ["02","Gaming-Modus & Command Center","Profile starten dein Setup; Strg + Umschalt + G öffnet die schnelle Steuerzentrale."],
    ["03","Wochenrückblick & Verlauf","Spielstarts und wichtige Ereignisse werden lokal zusammengefasst."],
    ["04","Neues Designsystem","Eigene Hintergründe, drei Ansichtsmodi, konsistente Dialoge und verbesserte Barrierefreiheit."],
    ["05","Stable-Technik","Tray-Menü, Reparaturdiagnose, Crashprotokolle, sichere Zugangsdaten und geprüfte Updates."],
  ];
  return <div className="utility-modal-backdrop" onMouseDown={close}><section className="utility-modal changelog-modal" role="dialog" aria-modal="true" aria-label="Neu in Version 1.0" onMouseDown={event=>event.stopPropagation()}><header><span>✦</span><div><small>GAMINGHUB STABLE</small><h2>Neu in Version 1.0</h2></div><button className="utility-close" aria-label="Schließen" onClick={close}>×</button></header><div className="changelog-list">{entries.map(([number,title,text])=><article key={number}><b>{number}</b><div><strong>{title}</strong><p>{text}</p></div></article>)}</div><button className="primary modal-main" onClick={close}>Alles klar</button></section></div>;
}
