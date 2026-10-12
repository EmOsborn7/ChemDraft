import { useEffect, useId, useRef, useState } from "react";
import type { GraphicObject } from "@chemdraft/chem-core";
import { planNativeArtVisual,graphicWavyLineAmplitude,graphicWavyLineCycles,editWavyLineAppearance,MAX_WAVE_AMPLITUDE_PX } from "@chemdraft/art-engine";

export function WavinessDialog({object,onSave,onCancel}:{
  object:GraphicObject;onSave(smoothness:number|undefined,amplitudePx:number|undefined,cycles:number|undefined):void;onCancel():void;
}) {
  const initial=object.data.waveSmoothness ?? (object.data.lineStart ? 0 : 1);
  const [value,setValue]=useState(Math.round(initial*100));
  const [changed,setChanged]=useState(false);
  const [amplitude,setAmplitude]=useState(graphicWavyLineAmplitude(object));
  const [amplitudeChanged,setAmplitudeChanged]=useState(false);
  const [cycles,setCycles]=useState(graphicWavyLineCycles(object));
  const [cyclesChanged,setCyclesChanged]=useState(false);
  const id=useId(),form=useRef<HTMLFormElement>(null),slider=useRef<HTMLInputElement>(null);
  const preview=editWavyLineAppearance(object,{smoothness:changed ? value/100 : undefined,
    amplitudePx:amplitudeChanged ? amplitude : undefined,cycles:cyclesChanged ? cycles : undefined}) ?? object;
  const frame=editWavyLineAppearance(object,{amplitudePx:MAX_WAVE_AMPLITUDE_PX}) ?? object;
  const visual=planNativeArtVisual(preview,{coordinateSpace:"page"});
  useEffect(()=>{
    const previous=document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    slider.current?.focus();
    return ()=>{if(previous?.isConnected) previous.focus();};
  },[]);
  return <div className="plugin-prompt-backdrop">
    <form ref={form} className="plugin-prompt-dialog waviness-dialog" role="dialog" aria-modal="true" aria-labelledby={id}
      onSubmit={event=>{event.preventDefault();onSave(changed ? value/100 : undefined,amplitudeChanged ? amplitude : undefined,cyclesChanged ? cycles : undefined);}}
      onKeyDown={event=>{
        event.stopPropagation();
        if(event.key==="Escape") {event.preventDefault();onCancel();}
        if(event.key==="Tab") {
          const controls=form.current?.querySelectorAll<HTMLElement>('input,button');
          const first=controls?.[0],last=controls?.[controls.length-1];
          if(event.shiftKey && document.activeElement===first) {event.preventDefault();last?.focus();}
          else if(!event.shiftKey && document.activeElement===last) {event.preventDefault();first?.focus();}
        }
      }}>
      <header className="plugin-prompt-header"><h2 id={id}>Adjust waviness</h2></header>
      <div className="plugin-prompt-body">
        <svg className="waviness-preview" role="img" aria-label="Wavy line preview"
          viewBox={`${frame.x-16} ${frame.y-16} ${Math.max(1,frame.width)+32} ${Math.max(1,frame.height)+32}`}>
          <path d={visual.pathD} fill="none" stroke={typeof object.style.strokeColor==="string" ? object.style.strokeColor : "#111111"}
            strokeWidth={typeof object.style.strokeWidth==="number" ? object.style.strokeWidth : 2}
            strokeDasharray={typeof object.style.strokeDasharray==="string" ? object.style.strokeDasharray : undefined}
            strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <label htmlFor={`${id}-shape`}>Wave shape</label>
        <input ref={slider} id={`${id}-shape`} type="range" min="0" max="100" step="1" value={value}
          aria-valuetext={value===0 ? "Spiky" : value===100 ? "Smooth" : `${value}% smooth`}
          onChange={event=>{setValue(Number(event.currentTarget.value));setChanged(true);}} />
        <div className="waviness-scale" aria-hidden="true"><span>Spiky</span><span>Smooth</span></div>
        <label htmlFor={`${id}-amplitude`}>Amplitude <output>{amplitude.toFixed(1)} px</output></label>
        <input id={`${id}-amplitude`} type="range" min="0" max={MAX_WAVE_AMPLITUDE_PX} step="0.1" value={amplitude}
          aria-valuetext={amplitude===0 ? "Flat" : `${amplitude.toFixed(1)} pixels`}
          onChange={event=>{setAmplitude(Number(event.currentTarget.value));setAmplitudeChanged(true);}} />
        <div className="waviness-scale" aria-hidden="true"><span>Flat</span><span>Tall</span></div>
        <label htmlFor={`${id}-frequency`}>Frequency <output>{cycles} {cycles===1 ? "wave" : "waves"}</output></label>
        <input id={`${id}-frequency`} type="range" min="1" max={Math.max(100,graphicWavyLineCycles(object))} step="1" value={cycles}
          aria-valuetext={`${cycles} ${cycles===1 ? "wave" : "waves"} along the line`}
          onChange={event=>{setCycles(Number(event.currentTarget.value));setCyclesChanged(true);}} />
        <div className="waviness-scale" aria-hidden="true"><span>Fewer</span><span>More</span></div>
        <p>Adjust the corners, height, and number of waves along the line.</p>
      </div>
      <footer className="plugin-prompt-actions">
        <button className="plugin-manager-button" type="button" onClick={onCancel}>Cancel</button>
        <button className="plugin-manager-button" type="submit">Save</button>
      </footer>
    </form>
  </div>;
}
