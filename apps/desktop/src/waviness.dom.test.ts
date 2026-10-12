// @vitest-environment jsdom
import { act,createElement } from "react";
import { createRoot,type Root } from "react-dom/client";
import { afterEach,beforeEach,describe,expect,it } from "vitest";
import { MainWindow } from "./MainWindow";
import { applyNativeArtLineToolAtPoint,createPhase4Document,selectDocumentObjects } from "./documentWorkflow";
import { DOM_COMMAND_EVENT } from "./window-manager";
(globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
class TestResizeObserver {observe(){} unobserve(){} disconnect(){}}
describe("wavy-line context menu and slider",()=>{
  let container:HTMLDivElement,root:Root,observer:typeof ResizeObserver;
  beforeEach(()=>{
    observer=globalThis.ResizeObserver;globalThis.ResizeObserver=TestResizeObserver;
    window.history.replaceState(null,"","/?agentBridge=1");
    container=document.createElement("div");document.body.append(container);root=createRoot(container);
  });
  afterEach(()=>{
    act(()=>root.unmount());container.remove();globalThis.ResizeObserver=observer;
    window.history.replaceState(null,"","/");delete window.__CHEMDRAFT_AGENT__;
  });
  const snapshot=()=>window.__CHEMDRAFT_AGENT__!.snapshot().document;
  async function route(commandId:string) {await act(async()=>window.dispatchEvent(new CustomEvent(DOM_COMMAND_EVENT,{detail:{commandId}})));}
  async function slide(value:number,kind="shape") {
    const input=container.querySelector<HTMLInputElement>(`.waviness-dialog input[id$="-${kind}"]`)!;
    await act(async()=>{
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")!.set!.call(input,String(value));
      input.dispatchEvent(new Event("input",{bubbles:true}));
    });
  }
  it("previews the clicked wave, cancels without mutation and saves one undo step under a larger selection",async()=>{
    let doc=applyNativeArtLineToolAtPoint(createPhase4Document("Waves"),{x:120,y:220},{x:320,y:220},"tool.art.lineWavy");
    const wave=doc.pages[0].objects[0];
    doc=applyNativeArtLineToolAtPoint(doc,{x:120,y:320},{x:320,y:320},"tool.art.line");
    const straight=doc.pages[0].objects[1];
    doc=selectDocumentObjects(doc,doc.pages[0].id,[wave.id,straight.id]);
    await act(async()=>root.render(createElement(MainWindow,{initialDocument:doc,initialActiveToolCommandId:"tool.select",
      initialRulersVisible:false,initialPaletteMode:"floating",nativePalette:false})));
    const before=snapshot();
    async function open(id=wave.id) {
      await act(async()=>container.querySelector<HTMLElement>(`[data-object-id="${id}"]`)!.dispatchEvent(
        new MouseEvent("contextmenu",{bubbles:true,cancelable:true,clientX:300,clientY:200})));
      const button=container.querySelector<HTMLButtonElement>('[role="menu"] [data-command-id="art.adjustWaviness"]');
      if(button) await act(async()=>button.click());
      return button;
    }
    expect(await open(straight.id)).toBeNull();
    expect(await open()).not.toBeNull();
    const input=container.querySelector<HTMLInputElement>('.waviness-dialog input[type="range"]')!;
    expect(document.activeElement).toBe(input);
    const original=container.querySelector('.waviness-preview path')!.getAttribute("d");
    await slide(100);
    await slide(18,"amplitude");
    await slide(8,"frequency");
    expect(container.querySelector('.waviness-preview path')!.getAttribute("d")).not.toBe(original);
    expect(input.getAttribute("aria-valuetext")).toBe("Smooth");expect(snapshot()).toEqual(before);
    await act(async()=>input.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true,cancelable:true})));
    expect(container.querySelector('.waviness-dialog')).toBeNull();expect(snapshot()).toEqual(before);
    await open();await slide(75);await slide(12,"amplitude");await slide(25);await slide(6,"frequency");
    await act(async()=>container.querySelector('.waviness-dialog')!.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true})));
    const after=snapshot(),changed=after.pages[0].objects.find(o=>o.id===wave.id)!;
    if(changed.type!=="graphic") throw new Error("Expected a wave");
    expect(changed.data.waveSmoothness).toBe(0.25);expect(changed.data.waveAmplitudePx).toBe(12);
    expect(changed.data.waveCycles).toBe(6);
    expect(after.selection).toEqual(before.selection);
    expect(after.pages[0].objects.find(o=>o.id===straight.id)).toEqual(before.pages[0].objects.find(o=>o.id===straight.id));
    await route("edit.undo");expect(snapshot()).toEqual(before);
    await route("edit.redo");expect(snapshot()).toEqual(after);
    await open();
    expect(container.querySelector<HTMLInputElement>('.waviness-dialog input[type="range"]')!.value).toBe("25");
    expect(container.querySelector<HTMLInputElement>('.waviness-dialog input[id$="-amplitude"]')!.value).toBe("12");
    expect(container.querySelector<HTMLInputElement>('.waviness-dialog input[id$="-frequency"]')!.value).toBe("6");
    await act(async()=>container.querySelector('.waviness-dialog')!.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true})));
    expect(snapshot()).toEqual(after);
    await route("edit.undo");expect(snapshot()).toEqual(before);
  });
});
