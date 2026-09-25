import { useEffect, useState } from "react";
import { subscribeUtility, utilityActions, type UtilityState } from "../services/utilityRuntime";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { isTauri } from "@tauri-apps/api/core";
const two=(value:number)=>String(value).padStart(2,"0"); const time=(seconds:number)=>`${two(Math.floor(seconds/60))}:${two(seconds%60)}`;
export default function UtilityOverlay(){
  const [state,setState]=useState<UtilityState|null>(null);
  useEffect(()=>subscribeUtility(setState),[]);
  useEffect(()=>{if(!state?.toast)return;const handle=window.setTimeout(()=>utilityActions.dismissToast(),9000);return()=>clearTimeout(handle)},[state?.toast?.id]);
  useEffect(()=>{if(!state?.toast||!isTauri()||document.visibilityState==="visible")return;void (async()=>{try{let allowed=await isPermissionGranted();if(!allowed)allowed=(await requestPermission())==="granted";if(allowed)sendNotification({title:state.toast!.title,body:state.toast!.text});}catch{/* Die Meldung im GamingHub bleibt als Fallback sichtbar. */}})()},[state?.toast?.id]);
  if(!state)return null;
  return <div className="utility-overlay-stack" aria-live="polite">
    {state.stopwatchRunning&&state.stopwatchVisible&&<section className="floating-stopwatch"><span>◴</span><div><small>STOPPUHR LÄUFT</small><strong>{time(state.stopwatchSeconds)}</strong></div><button title="Pause" onClick={()=>utilityActions.toggleStopwatch()}>Ⅱ</button><button title="Ausblenden – läuft weiter" onClick={()=>utilityActions.hideStopwatch()}>×</button></section>}
    {state.toast&&<section className="hub-toast"><span>{state.toast.icon}</span><div><small>GAMINGHUB</small><strong>{state.toast.title}</strong><p>{state.toast.text}</p></div><button aria-label="Schließen" onClick={()=>utilityActions.dismissToast()}>×</button></section>}
  </div>;
}
