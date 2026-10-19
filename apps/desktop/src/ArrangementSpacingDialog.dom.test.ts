// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { applyPatches, type TextObject } from "@chemdraft/chem-core";
import { ArrangementSpacingDialog } from "./ArrangementSpacingDialog";
import { createPhase4Document, createNativeSingleBondMolecule, selectDocumentObjects, arrangeSelectedDocumentObjects, adjustArrangementSpacing } from "./documentWorkflow";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
describe("spacing preview selected page", () => {
  it("exports page two, keeps page one untouched, and saves spacing on page two", async () => {
    let source = createPhase4Document("Two pages");
    const note: TextObject = {id:"first-page-note",type:"text",text:"PAGE ONE ONLY",spans:[],x:10,y:10,width:140,height:20,rotation:0,style:{}};
    source = applyPatches(source, [{op:"addObject",pageId:source.pages[0].id,object:note}]);
    const first = source.pages[0];
    source = {...source,pages:[first,{...first,id:"second",objects:[]}]};
    for (let i=0;i<3;i++) source=applyPatches(source,[{op:"addObject",pageId:"second",object:createNativeSingleBondMolecule(source,{x:180+i*100,y:260})}]);
    const secondNote={...note,id:"second-page-note",text:"PAGE TWO ONLY",x:200,y:300};
    source=applyPatches(source,[{op:"addObject",pageId:"second",object:secondNote}]);
    source=selectDocumentObjects(source,"second",source.pages[1].objects.filter(o=>o.type==="molecule").map(o=>o.id));
    source=arrangeSelectedDocumentObjects(source,"circle",{gap:100}).document;
    const container=document.createElement("div");document.body.append(container);const root=createRoot(container),save=vi.fn();
    try {
      await act(async()=>root.render(createElement(ArrangementSpacingDialog,{document:source,onSave:save,onCancel:vi.fn()})));
      const svg=decodeURIComponent(container.querySelector<HTMLImageElement>("img")!.src.split(",").slice(1).join(","));
      expect(svg).toContain("PAGE TWO ONLY");expect(svg).not.toContain("PAGE ONE ONLY");
      const slider=container.querySelector<HTMLInputElement>('input[type="range"]')!;
      const value=Math.ceil((Number(slider.min)+100)/2);
      await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")!.set!.call(slider,String(value));slider.dispatchEvent(new Event("input",{bubbles:true}));});
      await act(async()=>container.querySelector("form")!.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true})));
      expect(save).toHaveBeenCalledWith(value/100);
      const result=adjustArrangementSpacing(source,save.mock.calls[0][0]);expect(result.ok).toBe(true);
      expect(result.document.pages[0]).toEqual(first);expect(result.document.pages[1]).not.toEqual(source.pages[1]);
      expect(result.document.selection).toEqual(source.selection);
    } finally {await act(async()=>root.unmount());container.remove();}
  });
});
