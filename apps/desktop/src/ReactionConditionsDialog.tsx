import { useEffect, useId, useRef, useState } from "react";
import type { TextSpan } from "@chemdraft/chem-core";
import { nativeTextSubscriptOffsetEm } from "@chemdraft/layout-engine";
import { textObjectSpansForTextChange, updateTextObjectSpansInRange } from "./documentWorkflow";

const conditionSymbols = [
  ["°", "Degree"], ["±", "Plus or minus"], ["−", "Minus"], ["Δ", "Heat (delta)"],
  ["ν", "Nu (light)"], ["µ", "Micro"], ["·", "Middle dot"], ["×", "Times"]
] as const;

export function ReactionConditionsDialog({ initialText, initialSpans = [], initialSide, onSave, onCancel }: {
  initialText: string; initialSpans?: readonly TextSpan[]; initialSide: 1 | -1;
  onSave(text: string, side: 1 | -1, spans: TextSpan[]): void; onCancel(): void;
}) {
  const [content, setContent] = useState(() => ({text:initialText,
    spans:textObjectSpansForTextChange({text:initialText,spans:[...initialSpans]},initialText)}));
  const [typingScript, setTypingScript] = useState<TextSpan["script"]>("normal");
  const [range, setRange] = useState({start:0,end:0});
  const [side, setSide] = useState(initialSide);
  const input = useRef<HTMLTextAreaElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const id = useId();
  const activeScript = (() => {
    if (range.start===range.end) return typingScript;
    let offset=0;
    const scripts=new Set<TextSpan["script"]>();
    for (const span of content.spans) {
      const start=offset; offset+=span.text.length;
      if (offset>range.start && start<range.end) scripts.add(span.script);
    }
    return scripts.size===1 ? [...scripts][0] : undefined;
  })();
  const selection = () => ({start:input.current?.selectionStart ?? range.start,end:input.current?.selectionEnd ?? range.end});
  const restoreSelection = (start:number,end=start) => {
    requestAnimationFrame(() => {input.current?.focus();input.current?.setSelectionRange(start,end);setRange({start,end});});
  };
  const insertSymbol = (symbol:string) => {
    const {start,end}=selection();
    if (content.text.length-(end-start)+symbol.length>2000) return;
    const text=content.text.slice(0,start)+symbol+content.text.slice(end);
    // Symbols use the current typing mode; surrounding formatted runs remain intact.
    setContent({text,spans:textObjectSpansForTextChange(content,text,typingScript)});
    restoreSelection(start+symbol.length);
  };
  const format = (script:TextSpan["script"]) => {
    const selected=selection();
    if (selected.start===selected.end) setTypingScript(script);
    else setContent(current => ({...current,spans:updateTextObjectSpansInRange(current,selected,span=>({...span,script}))}));
    restoreSelection(selected.start,selected.end);
  };
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    input.current?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, []);
  return <div className="plugin-prompt-backdrop">
    <form ref={form} className="plugin-prompt-dialog reaction-conditions-dialog" role="dialog" aria-modal="true" aria-labelledby={id}
      onSubmit={event => {event.preventDefault(); onSave(content.text, side, content.spans);}}
      onKeyDown={event => {
        event.stopPropagation();
        if (event.key === "Escape") {event.preventDefault(); onCancel();}
        if (event.key === "Tab") {
          const controls = form.current?.querySelectorAll<HTMLElement>('textarea,select,button');
          const first = controls?.[0], last = controls?.[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) {event.preventDefault();last?.focus();}
          else if (!event.shiftKey && document.activeElement === last) {event.preventDefault();first?.focus();}
        }
      }}>
      <header className="plugin-prompt-header"><h2 id={id}>Reaction conditions</h2></header>
      <div className="plugin-prompt-body">
        <label htmlFor={`${id}-text`}>Reagents, temperature, time, or yield</label>
        <div className="reaction-conditions-tools" role="group" aria-label="Condition symbols and formatting">
          {conditionSymbols.map(([symbol,name]) => <button key={symbol} type="button" className="plugin-manager-button"
            aria-label={`Insert ${name.toLowerCase()} symbol`} title={name}
            onPointerDown={event=>event.preventDefault()} onClick={()=>insertSymbol(symbol)}>{symbol}</button>)}
          {(["normal","subscript","superscript"] as const).map(script => <button key={script} type="button"
            className="plugin-manager-button" aria-label={script === "normal" ? "Normal text" : script === "subscript" ? "Subscript" : "Superscript"}
            aria-pressed={activeScript===script}
            onPointerDown={event=>event.preventDefault()} onClick={()=>format(script)}>
            {script === "normal" ? "Normal" : script === "subscript" ? <>X<sub>2</sub></> : <>X<sup>2</sup></>}
          </button>)}
        </div>
        <textarea ref={input} id={`${id}-text`} rows={4} maxLength={2000} value={content.text}
          aria-describedby={`${id}-format-help`}
          onSelect={()=>setRange(selection())}
          placeholder={'e.g. K₂CO₃, THF\n80 °C, 2 h\n85% yield'}
          onChange={event => {const text=event.currentTarget.value;
            setContent(current=>({text,spans:textObjectSpansForTextChange(current,text,typingScript)}));}} />
        <p id={`${id}-format-help`} className="reaction-conditions-format-help">Select text to format it, or choose a format before typing.</p>
        <div className="reaction-conditions-preview" aria-label="Formatted conditions preview">
          {content.spans.map((span,index) => <span key={index} style={{verticalAlign:span.script === "normal" ? "baseline" : span.script === "subscript" ? `-${nativeTextSubscriptOffsetEm}em` : "super",
            fontSize:span.script === "normal" ? undefined : "72%"}}>{span.text}</span>)}
          {!content.text && <span className="reaction-conditions-preview-placeholder">Formatted preview</span>}
        </div>
        <label htmlFor={`${id}-side`}>Label position</label>
        <select id={`${id}-side`} value={side} onChange={event => setSide(event.currentTarget.value === "-1" ? -1 : 1)}>
          <option value="1">Above / outside the curve</option><option value="-1">Below / inside the curve</option>
        </select>
        <p>Labels follow their arrow and stay on the chosen side. Drag a label to adjust crowded positions, or double-click to edit. Clear the text to remove it.</p>
      </div>
      <footer className="plugin-prompt-actions">
        <button className="plugin-manager-button" type="button" onClick={onCancel}>Cancel</button>
        <button className="plugin-manager-button" type="submit">Save</button>
      </footer>
    </form>
  </div>;
}
