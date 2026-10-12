import { describe, expect, it } from "vitest";
import { applyPatches, deserializeDocument, serializeDocument, type ChemDraftDocument, type GraphicObject } from "@chemdraft/chem-core";
import { graphicPathEditPoints } from "@chemdraft/art-engine";
import { nativeSingleBondGraphSmiles } from "@chemdraft/document-workflow-core";
import { exportDocumentToSvg } from "@chemdraft/export-engine";
import { arrangeSelectedDocumentObjects, createNativeSingleBondMolecule, createNativeReactionArrow, createPhase4Document,
  moveDocumentObject, moveDocumentObjects, reactionConditionLabel, reactionConditionAttachment, reconcileReactionConnections,
  selectDocumentObjects, selectedArrangementObjectIds, setReactionConditions, updateNativeTextObjectText,
  groupSelectedDocumentObjects, applyNativeArtLineToolAtPoint, convertNativeTextObjectToAtom,isReactionConditionLabel } from "./documentWorkflow";

function fixture(layout: "circle" | "oval" | "row" | "grid" | "column" = "circle", count = 6) {
  let doc = createPhase4Document("Following arrows");
  for (let i=0;i<count;i++) doc=applyPatches(doc,[{op:"addObject",pageId:doc.pages[0].id,
    object:createNativeSingleBondMolecule(doc,{x:180+(i%3)*130,y:180+Math.floor(i/3)*140}, i===2 ? {bondStyle:"wedge"} : {})}]);
  doc=selectDocumentObjects(doc,doc.pages[0].id,doc.pages[0].objects.map(o=>o.id));
  return arrangeSelectedDocumentObjects(doc,layout,{addArrows:true,gap:100}).document;
}
const arrows = (doc:ChemDraftDocument) => doc.pages[0].objects.filter((o):o is GraphicObject=>o.type==="graphic");
const molecules = (doc:ChemDraftDocument) => doc.pages[0].objects.filter(o=>o.type==="molecule");
const get = (doc:ChemDraftDocument,id:string) => doc.pages[0].objects.find(o=>o.id===id)!;

describe("following connections and reaction conditions", () => {
  it("native subscript/superscript conditions survive editing, following, reopening and SVG export", () => {
    const before=fixture(), arrow=arrows(before)[0], text="K2CO3\n80 °C\nFe3+";
    const spans=[{text:"K",script:"normal" as const,style:{}},{text:"2",script:"subscript" as const,style:{}},
      {text:"CO",script:"normal" as const,style:{}},{text:"3",script:"subscript" as const,style:{}},
      {text:"\n80 °C\nFe",script:"normal" as const,style:{}},{text:"3+",script:"superscript" as const,style:{}}];
    let doc=setReactionConditions(before,arrow.id,text,-1,spans);
    expect(reactionConditionLabel(doc,arrow.id)?.spans).toEqual(spans);
    doc=setReactionConditions(doc,arrow.id,"THF, "+text,-1);
    expect(reactionConditionLabel(doc,arrow.id)?.spans.filter(s=>s.script==="subscript").map(s=>s.text)).toEqual(["2","3"]);
    doc=moveDocumentObjects(doc,molecules(doc).map(o=>o.id),12,18);
    const reopened=deserializeDocument(serializeDocument(doc));
    expect(reactionConditionLabel(reopened,arrow.id)).toEqual(reactionConditionLabel(doc,arrow.id));
    const svg=exportDocumentToSvg(reopened).contents;
    expect(svg).toContain('baseline-shift="-16%"');
    expect(svg).toContain('baseline-shift="super"');
    expect(svg).toContain("80 °C");
  });
  it.each(["circle","oval","row","column","grid"] as const)("moving a compound refits its incoming/outgoing %s arrows and preserves chemistry",layout=>{
    const before=fixture(layout), target=molecules(before)[1];
    const after=moveDocumentObject(before,target.id,{x:target.x+24,y:target.y+15});
    const connected=arrows(before).filter(o=>{const e=o.compatibility!.unknown.arrangementConnector as {fromId:string;toId:string};return e.fromId===target.id || e.toId===target.id;});
    for (const arrow of connected) {
      expect(get(after,arrow.id)).not.toEqual(arrow);
      expect((get(after,arrow.id) as GraphicObject).data.artPathKind).toBe(layout==="circle" || layout==="oval" ? "quadratic":"line");
    }
    for (const old of molecules(before)) {
      const moved=molecules(after).find(o=>o.id===old.id)!;
      expect(nativeSingleBondGraphSmiles(moved.atoms,moved.bonds)).toEqual(nativeSingleBondGraphSmiles(old.atoms,old.bonds));
      expect(moved.bonds).toEqual(old.bonds);
      expect(moved.atoms.map(a=>({...a,x:0,y:0}))).toEqual(old.atoms.map(a=>({...a,x:0,y:0})));
    }
    expect(reconcileReactionConnections(before,after)).toEqual(after);
  });
  it("moving all compounds preserves the exact ellipse and manual arrows",()=>{
    let before=fixture();
    const manual=createNativeReactionArrow(before,{x:20,y:20},{x:80,y:20},"forward");
    before=applyPatches(before,[{op:"addObject",pageId:before.pages[0].id,object:manual}]);
    const after=moveDocumentObjects(before,molecules(before).map(o=>o.id),20,30);
    for (const arrow of arrows(before).filter(o=>o.id!==manual.id)) {
      const next=get(after,arrow.id) as GraphicObject;
      expect(next.data.artPathKind).toBe("arc");
      expect(next.data.arcSweepRadians).toEqual(arrow.data.arcSweepRadians);
      expect(next.data.arcCenter).toEqual({x:arrow.data.arcCenter!.x+20,y:arrow.data.arcCenter!.y+30});
    }
    expect(get(after,manual.id)).toEqual(manual);
  });
  it("conditions move with their arrow, retain custom offsets, and survive native save and SVG export",()=>{
    let before=fixture();const arrow=arrows(before)[0];
    before=setReactionConditions(before,arrow.id,"K₂CO₃, THF\n80 °C, 2 h\n85% yield");
    const label=reactionConditionLabel(before,arrow.id)!;
    expect(label.text).toContain("85% yield");
    const manualOffset=moveDocumentObject(before,label.id,{x:label.x+12,y:label.y-8});
    expect(reactionConditionAttachment(reactionConditionLabel(manualOffset,arrow.id)!)).toMatchObject({offsetX:12,offsetY:-8});
    const editedOffset=setReactionConditions(manualOffset,arrow.id,"New conditions\n40 °C, 1 h");
    expect(reactionConditionAttachment(reactionConditionLabel(editedOffset,arrow.id)!)).toMatchObject({offsetX:12,offsetY:-8});
    // The shell may reconcile a workflow result again; that must not double the offset.
    expect(reconcileReactionConnections(before,manualOffset)).toEqual(manualOffset);
    const moved=moveDocumentObjects(manualOffset,molecules(before).map(o=>o.id),15,20);
    const movedLabel=reactionConditionLabel(moved,arrow.id)!;
    expect(movedLabel.x).toBeCloseTo(label.x+27);
    expect(movedLabel.y).toBeCloseTo(label.y+12);
    expect(movedLabel.text).toBe(label.text);
    const reopened=deserializeDocument(serializeDocument(moved));
    expect(reactionConditionLabel(reopened,arrow.id)).toEqual(movedLabel);
    expect(exportDocumentToSvg(reopened).contents).toContain("85% yield");
    const endpoint=(arrow.compatibility!.unknown.arrangementConnector as {fromId:string}).fromId;
    const target=molecules(reopened).find(o=>o.id===endpoint)!;
    const follow=moveDocumentObject(reopened,target.id,{x:target.x+20,y:target.y+10});
    expect(reactionConditionLabel(follow,arrow.id)).not.toEqual(movedLabel);
    expect(follow.selection).toEqual(reopened.selection);
  });
  it("editing a label re-centers its resized text, changing sides works, and clearing removes only the label",()=>{
    const before=fixture("row",3),arrow=arrows(before)[0];
    const first=setReactionConditions(before,arrow.id,"rt");
    const label=reactionConditionLabel(first,arrow.id)!;
    expect(label.y+label.height).toBeLessThan(graphicPathEditPoints(arrow)!.middle.y);
    const edited=reconcileReactionConnections(first,updateNativeTextObjectText(first,label.id,"THF, room temperature\n24 h"));
    expect(reactionConditionLabel(edited,arrow.id)!.width).toBeGreaterThan(label.width);
    const below=setReactionConditions(edited,arrow.id,"THF, room temperature\n24 h",-1);
    expect(reactionConditionLabel(below,arrow.id)!.y).toBeGreaterThan(graphicPathEditPoints(arrow)!.middle.y);
    expect(arrows(below)).toEqual(arrows(before));
    expect(reactionConditionLabel(setReactionConditions(below,arrow.id,""),arrow.id)).toBeUndefined();
  });
  it("repeat arrangement excludes labels from Select All and doesn't duplicate or reset them",()=>{
    let before=fixture();const arrow=arrows(before)[0];
    before=setReactionConditions(before,arrow.id,"Pd catalyst\n80 °C");
    const all=selectDocumentObjects(before,before.pages[0].id,before.pages[0].objects.map(o=>o.id));
    expect(selectedArrangementObjectIds(all)).toHaveLength(6);
    const again=arrangeSelectedDocumentObjects(all,"circle",{addArrows:true,gap:100}).document;
    expect(reactionConditionLabel(again,arrow.id)).toEqual(reactionConditionLabel(before,arrow.id));
    expect(arrows(again)).toHaveLength(6);
  });
  it("keeps five compounds when oval conditions lose their arrows during repeated layout switches",()=>{
    let doc=fixture("oval",5);
    for(const [i,arrow] of arrows(doc).entries()) doc=setReactionConditions(doc,arrow.id,`Condition ${i+1}\n80 °C`);
    const labels=doc.pages[0].objects.filter(o=>o.type==="text");
    for(const layout of ["grid","grid","row","oval","grid"] as const) {
      doc=selectDocumentObjects(doc,doc.pages[0].id,doc.pages[0].objects.map(o=>o.id));
      expect(selectedArrangementObjectIds(doc)).toHaveLength(5);
      const result=arrangeSelectedDocumentObjects(doc,layout,{addArrows:true,gap:100});doc=result.document;
      expect(result.status).toMatch(/Arranged 5 objects|already arranged/);
      expect(molecules(doc)).toHaveLength(5);expect(arrows(doc)).toHaveLength(layout==="oval" ? 5 : 4);
      for(const label of labels) expect(get(doc,label.id)).toMatchObject({type:"text",text:label.text});
    }
    expect(labels.some(label=>!reactionConditionAttachment(get(doc,label.id)))).toBe(true);
  });
  it("deleting an endpoint removes its orphaned arrows and preserves authored conditions as free text",()=>{
    let before=fixture();const arrow=arrows(before)[0];
    before=setReactionConditions(before,arrow.id,"THF, 2 h");const label=reactionConditionLabel(before,arrow.id)!;
    const e=arrow.compatibility!.unknown.arrangementConnector as {fromId:string};
    const after=reconcileReactionConnections(before,applyPatches(before,[{op:"removeObject",objectId:e.fromId}]));
    expect(get(after,arrow.id)).toBeUndefined();
    expect(get(after,label.id)).toMatchObject({text:label.text});
    expect(reactionConditionAttachment(get(after,label.id))).toBeUndefined();
    expect(isReactionConditionLabel(get(after,label.id))).toBe(true);
  });
  it("repairs previously detached native labels and removes connectors incorrectly using them as endpoints",()=>{
    let doc=fixture("oval",5);const arrow=arrows(doc)[0];
    doc=setReactionConditions(doc,arrow.id,"Na");const label=reactionConditionLabel(doc,arrow.id)!;
    const legacy={...label,compatibility:{...label.compatibility!,unknown:{}}};
    const incorrect={...arrow,id:"incorrect_label_connector",compatibility:{sourceFormat:"chemdraft-native" as const,
      warnings:[],unknown:{arrangementConnector:{version:1,fromId:label.id,toId:molecules(doc)[0].id}}}};
    doc=applyPatches(doc,[{op:"updateObject",objectId:label.id,changes:legacy},{op:"addObject",pageId:doc.pages[0].id,object:incorrect}]);
    expect(isReactionConditionLabel(legacy)).toBe(true);
    expect(convertNativeTextObjectToAtom(doc,label.id)).toBe(doc);
    doc=selectDocumentObjects(doc,doc.pages[0].id,doc.pages[0].objects.map(o=>o.id));
    expect(selectedArrangementObjectIds(doc)).toHaveLength(5);
    const repaired=arrangeSelectedDocumentObjects(doc,"grid",{addArrows:true,gap:100}).document;
    expect(get(repaired,incorrect.id)).toBeUndefined();expect(arrows(repaired)).toHaveLength(4);
    expect(get(repaired,label.id)).toMatchObject({type:"text",text:"Na",compatibility:{unknown:{reactionConditionRole:1}}});
    const reopened=deserializeDocument(serializeDocument(repaired));
    const restored=selectDocumentObjects(reopened,reopened.pages[0].id,reopened.pages[0].objects.map(o=>o.id));
    expect(selectedArrangementObjectIds(restored)).toHaveLength(5);
    expect(isReactionConditionLabel({...legacy,id:"ordinary_note"})).toBe(false);
    expect(isReactionConditionLabel({...legacy,compatibility:{...legacy.compatibility,sourceFormat:"external-cdxml"}})).toBe(false);
  });
  it("temporarily overlapping compounds hide an impossible arrow and moving apart restores it",()=>{
    const before=fixture("row",2), [a,b]=molecules(before),arrow=arrows(before)[0];
    const collapsed=moveDocumentObject(before,b.id,{x:a.x,y:a.y});
    expect((get(collapsed,arrow.id) as GraphicObject).data.markerEnd).toBeUndefined();
    const restored=moveDocumentObject(collapsed,b.id,{x:b.x,y:b.y});
    expect((get(restored,arrow.id) as GraphicObject).data.markerEnd).toEqual(arrow.data.markerEnd);
    expect((get(restored,arrow.id) as GraphicObject).data.lineEnd).toEqual(arrow.data.lineEnd);
  });
  it("grouped compounds and captions move as one endpoint",()=>{
    let before=fixture("row",3), target=molecules(before)[0];
    before=selectDocumentObjects(before,before.pages[0].id,[target.id]);
    before=groupSelectedDocumentObjects(before);
    const groupId=before.selection.objectIds[0];
    before=selectDocumentObjects(before,before.pages[0].id,[groupId,...molecules(before).slice(1).map(o=>o.id)]);
    before=arrangeSelectedDocumentObjects(before,"row",{addArrows:true,gap:100}).document;
    const linked=arrows(before).find(o=>(o.compatibility!.unknown.arrangementConnector as {fromId:string}).fromId===groupId)!;
    const after=moveDocumentObjects(before,[groupId],10,20);
    expect(get(after,linked.id)).not.toEqual(linked);
  });
});

describe("editable connection appearance",()=>{
  it("preserves stroke styling and edited arrowheads through repeated endpoint moves",()=>{
    const start=fixture("row",3), original=arrows(start)[0];
    let doc=reconcileReactionConnections(start,applyPatches(start,[{op:"updateObject",objectId:original.id,changes:{
      style:{...original.style,strokeColor:"#1d7f68",strokeWidth:3,strokeDasharray:"6 4"},
      data:{...original.data,markerEnd:{kind:"open-arrow",sizePx:18}}}}]));
    const endpoint=(original.compatibility!.unknown.arrangementConnector as {toId:string}).toId;
    for (let i=0;i<3;i++) {const target=get(doc,endpoint);doc=moveDocumentObject(doc,endpoint,{x:target.x+5,y:target.y+10});}
    const followed=get(doc,original.id) as GraphicObject;
    expect(followed.style).toMatchObject({strokeColor:"#1d7f68",strokeWidth:3,strokeDasharray:"6 4"});
    expect(followed.data.markerEnd).toEqual({kind:"open-arrow",sizePx:18});
    const edit=reconcileReactionConnections(doc,applyPatches(doc,[{op:"updateObject",objectId:followed.id,changes:{
      data:{...followed.data,markerEnd:{kind:"filled-arrow",sizePx:24}}}}]));
    const target=get(edit,endpoint), moved=moveDocumentObject(edit,endpoint,{x:target.x+5,y:target.y+10});
    expect((get(moved,original.id) as GraphicObject).data.markerEnd).toEqual({kind:"filled-arrow",sizePx:24});
  });
  it("condition labels follow a rotated manually drawn arrow without changing its shape",()=>{
    let doc=createPhase4Document("Manual arrow");
    doc=applyNativeArtLineToolAtPoint(doc,{x:260,y:260},{x:440,y:260},"tool.art.reactionArrow");
    const arrow=arrows(doc)[0];
    doc=setReactionConditions(doc,arrow.id,"Reagent A\n2 h");
    const label=reactionConditionLabel(doc,arrow.id)!;
    const turned=reconcileReactionConnections(doc,applyPatches(doc,[{op:"updateObject",objectId:arrow.id,changes:{rotation:90}}]));
    expect(reactionConditionLabel(turned,arrow.id)).not.toEqual(label);
    expect((get(turned,arrow.id) as GraphicObject).data).toEqual(arrow.data);
    expect(get(turned,arrow.id).rotation).toBe(90);
  });
});

it("a reaction label containing an element symbol stays text when inline editing finishes",()=>{
  const before=fixture("row",2),arrow=arrows(before)[0];
  const doc=setReactionConditions(before,arrow.id,"Pd");
  const label=reactionConditionLabel(doc,arrow.id)!;
  expect(convertNativeTextObjectToAtom(doc,label.id)).toBe(doc);
  expect(molecules(doc)).toHaveLength(2);
});
