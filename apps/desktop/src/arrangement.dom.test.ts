// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { applyPatches, type TextObject } from "@chemdraft/chem-core";
import { graphicPathVisualEditPoints, reactionArrowFrame } from "@chemdraft/art-engine";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MainWindow } from "./MainWindow";
import { reactionOffshootAttachment, reactionConditionAttachment, reactionConditionLabel, createNativeSingleBondMolecule, createPhase4Document, selectDocumentObjects,arrangeSelectedDocumentObjects,isReactionConditionLabel } from "./documentWorkflow";
import { DOM_COMMAND_EVENT } from "./window-manager";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
class TestResizeObserver { observe() {} unobserve() {} disconnect() {} }

describe("auto-arrangement toolbar and history", () => {
  let container: HTMLDivElement, root: Root;
  let resizeObserver: typeof ResizeObserver;
  beforeEach(() => {
    resizeObserver = globalThis.ResizeObserver;
    globalThis.ResizeObserver = TestResizeObserver;
    window.history.replaceState(null, "", "/?agentBridge=1");
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    window.history.replaceState(null, "", "/");
    delete window.__CHEMDRAFT_AGENT__;
    globalThis.ResizeObserver = resizeObserver;
  });
  function snapshot() { return window.__CHEMDRAFT_AGENT__!.snapshot().document; }
  async function route(commandId: string) {
    await act(async () => window.dispatchEvent(new CustomEvent(DOM_COMMAND_EVENT, { detail: { commandId } })));
  }
  async function render(selected = true, count = 6,includeNote=true) {
    let document = createPhase4Document("Six compounds");
    for (let i = 0; i < count; i++) {
      document = applyPatches(document, [{ op: "addObject", pageId: document.pages[0].id,
        object: createNativeSingleBondMolecule(document, { x: 200 + 100 * (i % 3), y: 220 + 150 * Math.floor(i / 3) }) }]);
    }
    const note: TextObject = { id: "note", type: "text", text: "Unselected conditions", spans: [],
      x: 20, y: 20, width: 160, height: 24, rotation: 0, style: {} };
    const ids = document.pages[0].objects.map((o) => o.id);
    if(includeNote) document = applyPatches(document, [{ op: "addObject", pageId: document.pages[0].id, object: note }]);
    if (selected) document = selectDocumentObjects(document, document.pages[0].id, ids);
    await act(async () => root.render(createElement(MainWindow, {
      initialDocument: document, initialActiveToolCommandId: "tool.select", initialRulersVisible: false,
      initialCrosshairsVisible: false, initialPaletteMode: "floating", nativePalette: false
    })));
  }
  it("invokes the real circle handler from the toolbar once, with one named undo and redo", async () => {
    await render();
    const before = snapshot();
    const button = container.querySelector<HTMLButtonElement>('button[data-command-id="layout.arrange.circle"]')!;
    expect(button.disabled).toBe(false);
    await act(async () => button.click());
    const after = snapshot();
    expect(after.pages[0].objects[0]).not.toEqual(before.pages[0].objects[0]);
    expect(after.pages[0].objects.find((object) => object.id === "note")).toEqual(before.pages[0].objects.at(-1));
    expect(after.selection).toEqual(before.selection);
    expect(after.pages[0].objects.filter((object) => object.type === "graphic")).toHaveLength(6);
    expect(container.textContent).toContain("Arranged 6 objects in a circle with 6 arrows");
    await act(async () => button.click());
    expect(snapshot()).toEqual(after);
    await route("edit.undo");
    expect(snapshot()).toEqual(before);
    await route("edit.redo");
    expect(snapshot()).toEqual(after);
    await route("edit.undo");
    await route("edit.undo");
    expect(snapshot()).toEqual(before);
  });
  it("opens the layout choices by keyboard and arranges a grid from the submenu", async () => {
    await render();
    const button = container.querySelector<HTMLButtonElement>('button[data-command-id="layout.arrange.circle"]')!;
    await act(async () => button.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })));
    const menu = container.querySelector<HTMLElement>('[data-command-flyout-menu="layout.arrange.circle.submenu"]')!;
    expect(menu.hidden).toBe(false);
    const choices = menu.querySelectorAll('button[data-command-id^="layout.arrange."]');
    expect(choices).toHaveLength(7);
    expect(new Set([...choices].map((choice) => choice.querySelector("svg")!.outerHTML)).size).toBe(7);
    const before = snapshot();
    await act(async () => menu.querySelector<HTMLButtonElement>('[data-command-id="layout.arrange.grid"]')!.click());
    expect(snapshot()).not.toEqual(before);
    expect(menu.hidden).toBe(true);
    expect(container.textContent).toContain("in a grid");
    expect(snapshot().pages[0].objects.filter((object) => object.type === "graphic")).toHaveLength(5);
  });
  it("disables every layout with no selection, including routed native-palette commands", async () => {
    await render(false);
    const before = snapshot();
    const button = container.querySelector<HTMLButtonElement>('button[data-command-id="layout.arrange.circle"]')!;
    expect(button.disabled).toBe(true);
    for (const layout of ["circle", "oval", "grid", "row", "column"]) await route(`layout.arrange.${layout}`);
    expect(snapshot()).toEqual(before);
  });
  it.each(["left", "center", "right"] as const)("the %s grid flyout aligns a five-compound final row and keeps straight arrows", async (alignment) => {
    await render(true, 5);
    const button = container.querySelector<HTMLButtonElement>('button[data-command-id="layout.arrange.circle"]')!;
    await act(async () => button.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })));
    const id = `layout.arrange.grid${alignment === "center" ? "" : `.${alignment}`}`;
    const choice = container.querySelector<HTMLButtonElement>(`[data-command-flyout-menu] button[data-command-id="${id}"]`)!;
    await act(async () => choice.click());
    const document = snapshot();
    expect(container.textContent).toContain(`grid (${alignment}) with 4 arrows`);
    const molecules = document.pages[0].objects.filter((o) => o.type === "molecule");
    const span = (entries: typeof molecules) => ({ left: Math.min(...entries.map((o) => o.x)), right: Math.max(...entries.map((o) => o.x + o.width)) });
    const top = span(molecules.slice(0, 3)), bottom = span(molecules.slice(3));
    if (alignment === "left") expect(bottom.left).toBeCloseTo(top.left);
    else if (alignment === "right") expect(bottom.right).toBeCloseTo(top.right);
    else expect(bottom.left + bottom.right).toBeCloseTo(top.left + top.right);
    expect(document.pages[0].objects.filter((o) => o.type === "graphic").every((o) => o.data.artPathKind === "line")).toBe(true);
    await route("edit.undo");
    expect(snapshot().pages[0].objects.filter((o) => o.type === "graphic")).toHaveLength(0);
  });
  function pointer(target: EventTarget, type: string, x: number, y: number) {
    const event = new MouseEvent(type, {bubbles:true,cancelable:true,button:0,buttons:type === "pointerup" ? 0 : 1,clientX:x,clientY:y});
    Object.defineProperties(event,{pointerId:{value:31},pointerType:{value:"mouse"},isPrimary:{value:true}});
    target.dispatchEvent(event);
  }
  function changeText(input: HTMLTextAreaElement, value: string) {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,"value")!.set!.call(input,value);
    input.dispatchEvent(new Event("input",{bubbles:true}));
  }
  it("the automation preview leaves arrow debug boxes off and blank-page clicks clear selection", async () => {
    await render();
    await route("layout.arrange.circle");
    await route("edit.selectAll");
    await route("tool.select");
    const page = container.querySelector<HTMLElement>(".page")!;
    page.setPointerCapture = () => {};
    page.releasePointerCapture = () => {};
    page.hasPointerCapture = () => false;
    page.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: 816, bottom: 1056,
      width: 816, height: 1056, toJSON: () => ({}) } as DOMRect);
    await act(async () => pointer(page, "pointerdown", 10, 100));
    await act(async () => pointer(page, "pointerup", 10, 100));
    expect(snapshot().selection.objectIds).toEqual([]);
    expect(container.querySelector("[data-art-transform-qa-layer]")).toBeNull();
    expect(container.querySelector(".object-transform-frame")).toBeNull();
    expect(snapshot().pages[0].objects.filter((object) => object.type === "graphic")).toHaveLength(6);
  });
  it("arrow transform diagnostics still require an explicit QA opt-in", async () => {
    window.history.replaceState(null, "", "/?agentBridge=1&artQa=1");
    await render();
    await route("layout.arrange.circle");
    expect(container.querySelector("[data-art-transform-qa-layer]")).not.toBeNull();
    expect(container.querySelectorAll("[data-art-transform-qa-object-id]")).toHaveLength(6);
  });
  it("right-click conditions are command-backed, cancel changes nothing, and saved text undoes/redoes once", async () => {
    await render();await route("layout.arrange.circle");
    const arrow=snapshot().pages[0].objects.find(o=>o.type === "graphic")!;
    const target=container.querySelector<HTMLElement>(`[data-object-id="${arrow.id}"]`)!;
    await act(async()=> target.dispatchEvent(new MouseEvent("contextmenu",{bubbles:true,cancelable:true,clientX:300,clientY:220})));
    const menu=container.querySelector<HTMLElement>('[role="menu"][data-context-object-id]')!;
    expect(menu.querySelector('[data-command-id="reaction.conditions"]')).not.toBeNull();
    await act(async()=>menu.querySelector<HTMLButtonElement>('[data-command-id="reaction.conditions"]')!.click());
    const before=snapshot();
    let dialog=container.querySelector<HTMLFormElement>('.reaction-conditions-dialog')!;
    expect(dialog).not.toBeNull();
    await act(async()=>changeText(dialog.querySelector('textarea')!,"THF, 80 °C\n2 h, 85% yield"));
    await act(async()=>dialog.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true,cancelable:true})));
    expect(container.querySelector('.reaction-conditions-dialog')).toBeNull();
    expect(snapshot()).toEqual(before);
    await route("reaction.conditions");
    dialog=container.querySelector<HTMLFormElement>('.reaction-conditions-dialog')!;
    await act(async()=>changeText(dialog.querySelector('textarea')!,"THF, 80 °C\n2 h, 85% yield"));
    await act(async()=>dialog.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true})));
    const after=snapshot();
    expect(reactionConditionLabel(after,arrow.id)?.text).toBe("THF, 80 °C\n2 h, 85% yield");
    await route("edit.undo");expect(snapshot()).toEqual(before);
    await route("edit.redo");expect(snapshot()).toEqual(after);
  });
  it("pointer previews update compound arrows and condition labels, and one undo restores the whole drag", async () => {
    await render();await route("layout.arrange.circle");
    const initial=snapshot(), arrow=initial.pages[0].objects.find(o=>o.type === "graphic")!;
    const arrowElement=container.querySelector<HTMLElement>(`[data-object-id="${arrow.id}"]`)!;
    await act(async()=>arrowElement.dispatchEvent(new MouseEvent("contextmenu",{bubbles:true,cancelable:true,clientX:300,clientY:220})));
    await act(async()=>container.querySelector<HTMLButtonElement>('[role="menu"] [data-command-id="reaction.conditions"]')!.click());
    const dialog=container.querySelector<HTMLFormElement>('.reaction-conditions-dialog')!;
    await act(async()=>changeText(dialog.querySelector('textarea')!,"THF, 80 °C"));
    await act(async()=>dialog.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true})));
    const before=snapshot();
    const endpoint=(arrow.compatibility!.unknown.arrangementConnector as {fromId:string}).fromId;
    const molecule=before.pages[0].objects.find(o=>o.id===endpoint)!;
    const page=container.querySelector<HTMLElement>('.page')!;
    page.setPointerCapture=()=>{};
    page.releasePointerCapture=()=>{};
    page.hasPointerCapture=()=>false;
    page.getBoundingClientRect=()=>({x:0,y:0,left:0,top:0,right:816,bottom:1056,width:816,height:1056,toJSON:()=>({})} as DOMRect);
    const target=container.querySelector<HTMLElement>(`[data-object-id="${endpoint}"]`)!;
    const x=molecule.x+ molecule.width/2,y=molecule.y+molecule.height/2;
    await act(async()=>pointer(target,"pointerdown",x,y));
    await act(async()=>pointer(page,"pointermove",x+20,y+20));
    const preview=snapshot();
    expect(preview.pages[0].objects.find(o=>o.id===arrow.id)).not.toEqual(arrow);
    expect(reactionConditionLabel(preview,arrow.id)).not.toEqual(reactionConditionLabel(before,arrow.id));
    await act(async()=>pointer(page,"pointerup",x+20,y+20));
    const after=snapshot();expect(after).not.toEqual(before);
    await route("edit.undo");
    // Selection on pointer-down belongs to the start of the drag; geometry is restored together.
    expect(snapshot().pages[0].objects).toEqual(before.pages[0].objects);
    await route("edit.redo");expect(snapshot()).toEqual(after);
    expect(reactionConditionAttachment(reactionConditionLabel(after,arrow.id)!)).toMatchObject({offsetX:0,offsetY:0});
  });

  it("conditions target the right-clicked arrow while preserving a larger selection",async()=>{
    await render();await route("layout.arrange.circle");await route("edit.selectAll");
    const before=snapshot(), arrows=before.pages[0].objects.filter(o=>o.type === "graphic"), arrow=arrows[2];
    expect(before.selection.objectIds.length).toBeGreaterThan(1);
    const target=container.querySelector<HTMLElement>(`[data-object-id="${arrow.id}"]`)!;
    await act(async()=>target.dispatchEvent(new MouseEvent("contextmenu",{bubbles:true,cancelable:true,clientX:300,clientY:220})));
    expect(snapshot().selection).toEqual(before.selection);
    await act(async()=>container.querySelector<HTMLButtonElement>('[role="menu"] [data-command-id="reaction.conditions"]')!.click());
    const dialog=container.querySelector<HTMLFormElement>('.reaction-conditions-dialog')!;
    expect(dialog).not.toBeNull();
    await act(async()=>changeText(dialog.querySelector('textarea')!,"Conditions for this step"));
    await act(async()=>dialog.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true})));
    expect(reactionConditionLabel(snapshot(),arrow.id)?.text).toBe("Conditions for this step");
    expect(reactionConditionLabel(snapshot(),arrows[0].id)).toBeUndefined();
    expect(snapshot().selection).toEqual(before.selection);
  });

  it("formatted conditions save through the real dialog and undo/redo together", async () => {
    await render(); await route("layout.arrange.circle");
    const arrow=snapshot().pages[0].objects.find(o=>o.type==="graphic")!;
    const target=container.querySelector<HTMLElement>(`[data-object-id="${arrow.id}"]`)!;
    await act(async()=>target.dispatchEvent(new MouseEvent("contextmenu",{bubbles:true,cancelable:true,clientX:300,clientY:220})));
    await act(async()=>container.querySelector<HTMLButtonElement>('[role="menu"] [data-command-id="reaction.conditions"]')!.click());
    const before=snapshot(), dialog=container.querySelector<HTMLFormElement>(".reaction-conditions-dialog")!;
    const textarea=dialog.querySelector("textarea")!;
    await act(async()=>changeText(textarea,"CO2\n80 °C"));
    await act(async()=>textarea.setSelectionRange(2,3));
    await act(async()=>{
      dialog.querySelector<HTMLButtonElement>('button[aria-label="Subscript"]')!.click();
      await new Promise(resolve=>setTimeout(resolve,40));
    });
    await act(async()=>dialog.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true})));
    const after=snapshot(),label=reactionConditionLabel(after,arrow.id)!;
    expect(label.spans.find(s=>s.script==="subscript")?.text).toBe("2");
    await route("edit.undo"); expect(snapshot()).toEqual(before);
    await route("edit.redo"); expect(snapshot()).toEqual(after);
    await route("reaction.conditions");
    expect(container.querySelector('.reaction-conditions-preview span[style*="vertical-align: -0.16em"]')?.textContent).toBe("2");
  });
  it("right-click offshoot commands attach to the clicked arrow under Select All and undo/redo once", async () => {
    await render();await route("layout.arrange.circle");await route("edit.selectAll");
    const before=snapshot(),arrow=before.pages[0].objects.filter(o=>o.type==="graphic")[2];
    const target=container.querySelector<HTMLElement>(`[data-object-id="${arrow.id}"]`)!;
    async function add(side:"outside"|"inside") {
      await act(async()=>target.dispatchEvent(new MouseEvent("contextmenu",{bubbles:true,cancelable:true,clientX:300,clientY:220})));
      const choice=container.querySelector<HTMLButtonElement>(`[role="menu"] [data-command-id="reaction.offshoot.${side}"]`)!;
      expect(choice).not.toBeNull(); await act(async()=>choice.click());
    }
    await add("outside");const first=snapshot();
    const child=first.pages[0].objects.find(o=>reactionOffshootAttachment(o))!;
    expect(reactionOffshootAttachment(child)).toMatchObject({parentArrowId:arrow.id,side:1});
    expect(first.selection).toEqual(before.selection);
    await route("edit.undo");expect(snapshot()).toEqual(before);
    await route("edit.redo");expect(snapshot()).toEqual(first);
    await add("inside");const second=snapshot();
    expect(second.pages[0].objects.filter(o=>reactionOffshootAttachment(o))).toHaveLength(2);
    await add("outside");expect(snapshot()).toEqual(second);
    await route("edit.undo");expect(snapshot()).toEqual(first);
  });

  it("slides the offshoot join through repeated pointer previews and commits one undo/redo",async()=>{
    await render();await route("layout.arrange.circle");
    const parent=snapshot().pages[0].objects.find(o=>o.type==="graphic")!;
    const target=container.querySelector<HTMLElement>(`[data-object-id="${parent.id}"]`)!;
    await act(async()=>target.dispatchEvent(new MouseEvent("contextmenu",{bubbles:true,cancelable:true,clientX:300,clientY:220})));
    await act(async()=>container.querySelector<HTMLButtonElement>('[role="menu"] [data-command-id="reaction.offshoot.outside"]')!.click());
    const child=snapshot().pages[0].objects.find(o=>reactionOffshootAttachment(o))!;
    if (child.type!=="graphic" || parent.type!=="graphic") throw new Error("Expected arrows");
    const page=container.querySelector<HTMLElement>('.page')!;
    page.setPointerCapture=()=>{};page.releasePointerCapture=()=>{};page.hasPointerCapture=()=>false;
    page.getBoundingClientRect=()=>({x:0,y:0,left:0,top:0,right:816,bottom:1056,width:816,height:1056,toJSON:()=>({})} as DOMRect);
    const childElement=container.querySelector<HTMLElement>(`[data-object-id="${child.id}"]`)!;
    childElement.setPointerCapture=()=>{};childElement.releasePointerCapture=()=>{};childElement.hasPointerCapture=()=>false;
    const childPath=graphicPathVisualEditPoints(child)!;
    await act(async()=>pointer(childElement,"pointerdown",childPath.middle.x,childPath.middle.y));
    await act(async()=>pointer(page,"pointerup",childPath.middle.x,childPath.middle.y));
    const before=snapshot();
    const handle=childElement.querySelector<HTMLButtonElement>('[aria-label="Slide offshoot contact along parent arrow"]')!;
    expect(handle).not.toBeNull();
    await act(async()=>pointer(handle,"pointerdown",childPath.start.x,childPath.start.y));
    const parentPath=graphicPathVisualEditPoints(parent)!;
    for (const contactT of [0.75,0.25]) {
      const p=reactionArrowFrame(parentPath,contactT).origin;
      await act(async()=>pointer(page,"pointermove",p.x,p.y));
      const branch=snapshot().pages[0].objects.find(o=>o.id===child.id)!;
      expect(reactionOffshootAttachment(branch)!.geometry.contactT).toBeCloseTo(contactT,7);
    }
    const end=reactionArrowFrame(parentPath,0.25).origin;
    await act(async()=>pointer(page,"pointerup",end.x,end.y));
    const after=snapshot();expect(after).not.toEqual(before);
    await route("edit.undo");expect(snapshot()).toEqual(before);
    await route("edit.redo");expect(snapshot()).toEqual(after);
  });
  it("keeps condition text out of the grid after replacing its oval arrow, with one-step undo",async()=>{
    await render(true,5,false);await route("layout.arrange.oval");
    const oval=snapshot();
    const gridPreview=arrangeSelectedDocumentObjects(oval,"grid",{addArrows:true}).document;
    const retained=new Set(gridPreview.pages[0].objects.filter(o=>o.type==="graphic").map(o=>o.id));
    const arrow=oval.pages[0].objects.find(o=>o.type==="graphic" && !retained.has(o.id))!;
    expect(arrow).toBeDefined();
    if(arrow.type!=="graphic") throw new Error("Expected an arrow");
    const page=container.querySelector<HTMLElement>('.page')!;
    page.getBoundingClientRect=()=>({x:0,y:0,left:0,top:0,right:816,bottom:1056,width:816,height:1056,toJSON:()=>({})} as DOMRect);
    const point=graphicPathVisualEditPoints(arrow)!.middle;
    const target=container.querySelector<HTMLElement>(`[data-object-id="${arrow.id}"]`)!;
    await act(async()=>target.dispatchEvent(new MouseEvent("contextmenu",{bubbles:true,cancelable:true,clientX:point.x,clientY:point.y})));
    await act(async()=>container.querySelector<HTMLButtonElement>('[role="menu"] [data-command-id="reaction.conditions"]')!.click());
    const dialog=container.querySelector('.reaction-conditions-dialog')!;
    await act(async()=>changeText(dialog.querySelector('textarea')!,"THF\n80 °C"));
    await act(async()=>dialog.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true})));
    const label=reactionConditionLabel(snapshot(),arrow.id)!;
    await route("edit.selectAll");const before=snapshot();
    await route("layout.arrange.grid");const grid=snapshot();
    expect(grid.pages[0].objects.filter(o=>o.type==="molecule")).toHaveLength(5);
    expect(grid.pages[0].objects.filter(o=>o.type==="graphic")).toHaveLength(4);
    expect(reactionConditionAttachment(grid.pages[0].objects.find(o=>o.id===label.id)!)).toBeUndefined();
    expect(isReactionConditionLabel(grid.pages[0].objects.find(o=>o.id===label.id)!)).toBe(true);
    await route("edit.undo");expect(snapshot()).toEqual(before);
    await route("edit.redo");expect(snapshot()).toEqual(grid);
    await route("edit.selectAll");await route("layout.arrange.grid");
    expect(snapshot().pages[0].objects.filter(o=>o.type==="graphic")).toHaveLength(4);
    expect(container.textContent).toMatch(/Arranged 5 objects|already arranged/);
    expect(snapshot().pages[0].objects.find(o=>o.id===label.id)).toMatchObject({type:"text",text:label.text});
  });
  it("previews tighter spacing from the flyout, cancels unchanged and saves one undo step",async()=>{
    await render(true,5,false);await route("layout.arrange.oval");
    const before=snapshot();
    async function open() {
      const button=container.querySelector<HTMLButtonElement>('[data-command-id="layout.arrange.circle"]')!;
      await act(async()=>button.dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowDown",bubbles:true})));
      const choice=container.querySelector<HTMLButtonElement>('[data-command-flyout-menu] [data-command-id="layout.adjustArrangementSpacing"]')!;
      expect(choice).not.toBeNull();await act(async()=>choice.click());
    }
    await open();
    let slider=container.querySelector<HTMLInputElement>('.arrangement-spacing-dialog input[type="range"]')!;
    expect(document.activeElement).toBe(slider);
    const value=Math.ceil((Number(slider.min)+100)/2);
    const initial=container.querySelector<HTMLImageElement>('.arrangement-spacing-preview')!.src;
    async function change() {await act(async()=>{
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")!.set!.call(slider,String(value));
      slider.dispatchEvent(new Event("input",{bubbles:true}));
    });}
    await change();
    expect(container.querySelector<HTMLImageElement>('.arrangement-spacing-preview')!.src).not.toBe(initial);
    expect(snapshot()).toEqual(before);
    await act(async()=>slider.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true,cancelable:true})));
    expect(snapshot()).toEqual(before);expect(container.querySelector('.arrangement-spacing-dialog')).toBeNull();
    await open();slider=container.querySelector<HTMLInputElement>('.arrangement-spacing-dialog input[type="range"]')!;
    await change();await act(async()=>container.querySelector('.arrangement-spacing-dialog')!.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true})));
    const after=snapshot();expect(after).not.toEqual(before);
    for(const old of before.pages[0].objects) if(old.type==="molecule") {
      const next=after.pages[0].objects.find(o=>o.id===old.id)!;
      expect(next.width).toBe(old.width);expect(next.height).toBe(old.height);
    }
    await route("edit.undo");expect(snapshot()).toEqual(before);
    await route("edit.redo");expect(snapshot()).toEqual(after);
  });
});
