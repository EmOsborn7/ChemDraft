import {useEffect,useId,useMemo,useRef,useState} from "react";
import type {ChemDraftDocument} from "@chemdraft/chem-core";
import {exportDocumentToSvg} from "@chemdraft/export-engine";
import {adjustArrangementSpacing,arrangementSpacingRange,arrangementSpacingPreviewBounds} from "./documentWorkflow";

export function ArrangementSpacingDialog({document:source,onSave,onCancel}:{
  document:ChemDraftDocument;onSave(factor:number):void;onCancel():void;
}) {
  const [percent,setPercent]=useState(100);
  const id=useId(),form=useRef<HTMLFormElement>(null),slider=useRef<HTMLInputElement>(null);
  const range=useMemo(()=>arrangementSpacingRange(source),[source]);
  const result=useMemo(()=>adjustArrangementSpacing(source,percent/100),[source,percent]);
  const preview=useMemo(()=>{
    const b=arrangementSpacingPreviewBounds(source)!;
    const width=b.width*1.5+80,height=b.height*1.5+80;
    const svg=exportDocumentToSvg(result.document,{pageIndex: Math.max(0, source.pages.findIndex(page => page.id === source.selection.pageId)),includePageGuides:false,includeWarnings:false}).contents
      .replace(/width="[^"]+" height="[^"]+" viewBox="[^"]+"/,
        `width="${width}" height="${height}" viewBox="${b.x+b.width/2-width/2} ${b.y+b.height/2-height/2} ${width} ${height}"`);
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  },[source,result.document]);
  useEffect(()=>{
    const previous=document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    slider.current?.focus();return ()=>{if(previous?.isConnected) previous.focus();};
  },[]);
  return <div className="plugin-prompt-backdrop">
    <form ref={form} className="plugin-prompt-dialog arrangement-spacing-dialog" role="dialog" aria-modal="true" aria-labelledby={id}
      onSubmit={event=>{event.preventDefault();if(result.ok) onSave(percent/100);}}
      onKeyDown={event=>{
        event.stopPropagation();if(event.key==="Escape") {event.preventDefault();onCancel();}
        if(event.key==="Tab") {
          const controls=form.current?.querySelectorAll<HTMLElement>('input,button:not(:disabled)');
          const first=controls?.[0],last=controls?.[controls.length-1];
          if(event.shiftKey && document.activeElement===first) {event.preventDefault();last?.focus();}
          else if(!event.shiftKey && document.activeElement===last) {event.preventDefault();first?.focus();}
        }
      }}>
      <header className="plugin-prompt-header"><h2 id={id}>Adjust arrangement spacing</h2></header>
      <div className="plugin-prompt-body">
        <img className="arrangement-spacing-preview" src={preview} alt="Arrangement spacing preview" />
        <label htmlFor={`${id}-spacing`}>Spacing <output>{percent}%</output></label>
        <input ref={slider} id={`${id}-spacing`} type="range" min={Math.round(range.min*100)} max={Math.round(range.max*100)}
          step="1" value={percent} aria-valuetext={`${percent}% of original spacing`}
          onChange={event=>setPercent(Number(event.currentTarget.value))} />
        <div className="arrangement-spacing-scale" aria-hidden="true"><span>Closer</span><span>Farther apart</span></div>
        <p>Molecule sizes stay fixed. Only the spacing between selected compounds changes.</p>
        {!result.ok && <p role="status">{result.status}</p>}
      </div>
      <footer className="plugin-prompt-actions">
        <button className="plugin-manager-button" type="button" onClick={onCancel}>Cancel</button>
        <button className="plugin-manager-button" type="submit" disabled={!result.ok}>Save</button>
      </footer>
    </form>
  </div>;
}
