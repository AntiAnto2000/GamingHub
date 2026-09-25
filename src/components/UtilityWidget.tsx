import { useEffect, useMemo, useState } from "react";
import { subscribeUtility, utilityActions, type UtilityState } from "../services/utilityRuntime";

type UtilityId = "clock" | "calendar" | "alarm" | "stopwatch" | "timer";
const two = (value: number) => String(value).padStart(2, "0");
const clockText = (seconds: number) => `${two(Math.floor(seconds / 60))}:${two(seconds % 60)}`;
const labels: Record<UtilityId,string> = {clock:"Uhr",calendar:"Kalender",alarm:"Wecker",stopwatch:"Stoppuhr",timer:"Timer"};
const icons: Record<UtilityId,string> = {clock:"◷",calendar:"▦",alarm:"◉",stopwatch:"◴",timer:"⌛"};

function Stepper({ label, value, max, set }: { label:string; value:number; max:number; set:(value:number)=>void }) {
  return <div className="hub-stepper"><small>{label}</small><div><button aria-label={`${label} verringern`} onClick={()=>set((value-1+max+1)%(max+1))}>−</button><strong>{two(value)}</strong><button aria-label={`${label} erhöhen`} onClick={()=>set((value+1)%(max+1))}>＋</button></div></div>;
}

export default function UtilityWidget({ id }: { id: UtilityId }) {
  const [open,setOpen]=useState(false); const [now,setNow]=useState(new Date());
  const [runtime,setRuntime]=useState<UtilityState>({stopwatchSeconds:0,stopwatchRunning:false,stopwatchVisible:true,timerSeconds:0,timerRunning:false,alarm:"08:00",alarmActive:false,toast:null});
  const storedAlarm=runtime.alarm || "08:00";
  const [alarmHour,setAlarmHour]=useState(Number(storedAlarm.split(":")[0])||0); const [alarmMinute,setAlarmMinute]=useState(Number(storedAlarm.split(":")[1])||0);
  const [timerMinutes,setTimerMinutes]=useState(5);
  useEffect(()=>{const handle=window.setInterval(()=>setNow(new Date()),1000);return()=>clearInterval(handle)},[]);
  useEffect(()=>subscribeUtility(setRuntime),[]);
  useEffect(()=>{if(open)return;const [hour,minute]=runtime.alarm.split(":").map(Number);if(Number.isInteger(hour)&&Number.isInteger(minute)){setAlarmHour(hour);setAlarmMinute(minute)}},[runtime.alarm,open]);
  useEffect(()=>{if(!open)return;const close=(event:KeyboardEvent)=>{if(event.key==="Escape")setOpen(false)};addEventListener("keydown",close);return()=>removeEventListener("keydown",close)},[open]);
  const month=useMemo(()=>now.toLocaleDateString("de-DE",{month:"long",year:"numeric"}),[now.getMonth(),now.getFullYear()]);
  const alarm=`${two(alarmHour)}:${two(alarmMinute)}`;
  const summary=id==="clock"?now.toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"}):id==="calendar"?`${now.getDate()}. ${now.toLocaleDateString("de-DE",{month:"long"})}`:id==="alarm"?(runtime.alarmActive?runtime.alarm:"Nicht aktiv"):id==="stopwatch"?clockText(runtime.stopwatchSeconds):runtime.timerSeconds?clockText(runtime.timerSeconds):`${timerMinutes} Minuten`;
  const detail=id==="clock"?now.toLocaleDateString("de-DE",{weekday:"long"}):id==="calendar"?month:id==="alarm"?(runtime.alarmActive?"Wecker aktiv":"Zeit einstellen"):id==="stopwatch"?(runtime.stopwatchRunning?"Läuft":"Bereit"):(runtime.timerRunning?"Läuft":"Timer einstellen");
  const days=new Date(now.getFullYear(),now.getMonth()+1,0).getDate(); const first=(new Date(now.getFullYear(),now.getMonth(),1).getDay()+6)%7;
  return <>
    <button className="utility-widget" onClick={()=>setOpen(true)}><span>{labels[id].toUpperCase()}</span><strong className={id==="clock"?"utility-clock":""}>{summary}</strong><small>{detail}</small><i>Öffnen ↗</i></button>
    {open&&<div className="utility-modal-backdrop" onMouseDown={()=>setOpen(false)}><section className="utility-modal" role="dialog" aria-modal="true" aria-label={labels[id]} onMouseDown={event=>event.stopPropagation()}>
      <header><span>{icons[id]}</span><div><small>COCKPIT-WIDGET</small><h2>{labels[id]}</h2></div><button className="utility-close" aria-label="Schließen" onClick={()=>setOpen(false)}>×</button></header>
      {id==="clock"&&<div className="utility-clock-panel"><strong>{now.toLocaleTimeString("de-DE")}</strong><p>{now.toLocaleDateString("de-DE",{weekday:"long",day:"2-digit",month:"long",year:"numeric"})}</p></div>}
      {id==="calendar"&&<div className="hub-calendar"><h3>{month}</h3><div className="calendar-week"><b>MO</b><b>DI</b><b>MI</b><b>DO</b><b>FR</b><b>SA</b><b>SO</b></div><div className="calendar-days">{Array.from({length:first},(_,index)=><i key={`e${index}`}/>)}{Array.from({length:days},(_,index)=><span className={index+1===now.getDate()?"today":""} key={index+1}>{index+1}</span>)}</div></div>}
      {id==="alarm"&&<><div className="stepper-row"><Stepper label="Stunden" value={alarmHour} max={23} set={setAlarmHour}/><span>:</span><Stepper label="Minuten" value={alarmMinute} max={59} set={setAlarmMinute}/></div><button className={runtime.alarmActive?"secondary modal-main":"primary modal-main"} onClick={()=>utilityActions.setAlarm(alarm,!runtime.alarmActive)}>{runtime.alarmActive?"Wecker ausschalten":`Wecker auf ${alarm} stellen`}</button></>}
      {id==="stopwatch"&&<><div className="utility-time-display">{clockText(runtime.stopwatchSeconds)}</div><div className="modal-controls"><button className="primary" onClick={()=>utilityActions.toggleStopwatch()}>{runtime.stopwatchRunning?"Pause":"Start"}</button><button className="secondary" onClick={()=>utilityActions.resetStopwatch()}>Zurücksetzen</button></div>{runtime.stopwatchRunning&&!runtime.stopwatchVisible&&<button className="text-button show-floating" onClick={()=>utilityActions.showStopwatch()}>Mini-Stoppuhr wieder einblenden</button>}</>}
      {id==="timer"&&<><div className="utility-time-display">{runtime.timerSeconds?clockText(runtime.timerSeconds):`${timerMinutes} min`}</div>{runtime.timerSeconds===0&&<><div className="timer-presets">{[5,10,15,30].map(value=><button className={timerMinutes===value?"active":""} key={value} onClick={()=>setTimerMinutes(value)}>{value} min</button>)}</div><div className="timer-adjust"><button onClick={()=>setTimerMinutes(value=>Math.max(1,value-1))}>−</button><strong>{timerMinutes} Minuten</strong><button onClick={()=>setTimerMinutes(value=>Math.min(180,value+1))}>＋</button></div></>}<div className="modal-controls"><button className="primary" onClick={()=>utilityActions.toggleTimer(timerMinutes)}>{runtime.timerRunning?"Pause":runtime.timerSeconds?"Fortsetzen":"Timer starten"}</button><button className="secondary" onClick={()=>utilityActions.resetTimer()}>Zurücksetzen</button></div></>}
    </section></div>}
  </>;
}
