export interface UtilityState {
  stopwatchSeconds: number; stopwatchRunning: boolean; stopwatchVisible: boolean;
  timerSeconds: number; timerRunning: boolean;
  alarm: string; alarmActive: boolean;
  toast: null | { id: number; icon: string; title: string; text: string };
}
type Saved = { watchBase:number; watchStarted:number|null; watchVisible:boolean; timerEnd:number|null; timerLeft:number; alarm:string; alarmActive:boolean; lastAlarm:string };
const key="gaminghub.utilityRuntime.v1";
const read=():Saved=>{try{return {...{watchBase:0,watchStarted:null,watchVisible:true,timerEnd:null,timerLeft:0,alarm:"08:00",alarmActive:false,lastAlarm:""},...JSON.parse(localStorage.getItem(key)||"{}")}}catch{return {watchBase:0,watchStarted:null,watchVisible:true,timerEnd:null,timerLeft:0,alarm:"08:00",alarmActive:false,lastAlarm:""}}};
let saved=read(); let toast:UtilityState["toast"]=null; let nextToast=1; const listeners=new Set<(state:UtilityState)=>void>();
const watchSeconds=()=>saved.watchBase+(saved.watchStarted?Math.max(0,Math.floor((Date.now()-saved.watchStarted)/1000)):0);
const timerSeconds=()=>saved.timerEnd?Math.max(0,Math.ceil((saved.timerEnd-Date.now())/1000)):saved.timerLeft;
const snapshot=():UtilityState=>({stopwatchSeconds:watchSeconds(),stopwatchRunning:saved.watchStarted!==null,stopwatchVisible:saved.watchVisible,timerSeconds:timerSeconds(),timerRunning:saved.timerEnd!==null,alarm:saved.alarm,alarmActive:saved.alarmActive,toast});
const persist=()=>localStorage.setItem(key,JSON.stringify(saved)); const emit=()=>{const state=snapshot();listeners.forEach(listener=>listener(state))};
const notify=(icon:string,title:string,text:string)=>{toast={id:nextToast++,icon,title,text};emit()};
window.setInterval(()=>{const now=new Date();if(saved.timerEnd&&saved.timerEnd<=Date.now()){saved.timerEnd=null;saved.timerLeft=0;persist();notify("⌛","Timer abgelaufen","Deine eingestellte Zeit ist vorbei.")}const minute=`${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;const today=`${now.toDateString()}-${minute}`;if(saved.alarmActive&&saved.alarm===minute&&saved.lastAlarm!==today){saved.lastAlarm=today;saved.alarmActive=false;persist();notify("◉","Wecker",`Es ist ${minute} Uhr.`)}emit()},1000);
export const subscribeUtility=(listener:(state:UtilityState)=>void)=>{listeners.add(listener);listener(snapshot());return()=>{listeners.delete(listener)}};
export const utilityActions={
  toggleStopwatch(){if(saved.watchStarted){saved.watchBase=watchSeconds();saved.watchStarted=null}else{saved.watchStarted=Date.now();saved.watchVisible=true}persist();emit()},
  resetStopwatch(){saved.watchBase=0;saved.watchStarted=null;saved.watchVisible=true;persist();emit()},
  hideStopwatch(){saved.watchVisible=false;persist();emit()}, showStopwatch(){saved.watchVisible=true;persist();emit()},
  toggleTimer(minutes:number){if(saved.timerEnd){saved.timerLeft=timerSeconds();saved.timerEnd=null}else{const seconds=saved.timerLeft||minutes*60;saved.timerEnd=Date.now()+seconds*1000;saved.timerLeft=0}persist();emit()},
  resetTimer(){saved.timerEnd=null;saved.timerLeft=0;persist();emit()},
  setAlarm(value:string,active:boolean){saved.alarm=value;saved.alarmActive=active;persist();emit()},
  dismissToast(){toast=null;emit()},
};
