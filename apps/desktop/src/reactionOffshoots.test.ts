import { describe, expect, it } from "vitest";
import { applyPatches, deserializeDocument, serializeDocument, type ChemDraftDocument, type GraphicObject } from "@chemdraft/chem-core";
import { graphicPathVisualEditPoints, reactionArrowFrame } from "@chemdraft/art-engine";
import { exportDocumentToSvg } from "@chemdraft/export-engine";
import { applyNativeArtLineToolAtPoint, attachReactionOffshoot, createPhase4Document, moveDocumentObject,
  moveDocumentObjects, reactionOffshootAttachment, reactionConditionAttachment, reactionConditionLabel,
  reconcileReactionConnections, selectedArrangementObjectIds, selectDocumentObjects, setReactionConditions, updateNativeGraphicPathHandle } from "./documentWorkflow";

function fixture(y=300) {
  return applyNativeArtLineToolAtPoint(createPhase4Document("Offshoots"),{x:260,y},{x:440,y},"tool.art.reactionArrow");
}
const arrows=(doc:ChemDraftDocument)=>doc.pages[0].objects.filter((o):o is GraphicObject=>o.type==="graphic");
const branch=(doc:ChemDraftDocument,side:1|-1=1)=>arrows(doc).find(o=>reactionOffshootAttachment(o)?.side===side)!;
const get=(doc:ChemDraftDocument,id:string)=>arrows(doc).find(o=>o.id===id)!;
function attached(doc:ChemDraftDocument,side:1|-1=1) {
  return reconcileReactionConnections(doc,attachReactionOffshoot(doc,arrows(doc)[0].id,side).document);
}
describe("editable parent-linked offshoot arrows",()=>{
  it.each([1,-1] as const)("attaches side %i at the shaft midpoint with a native curve and one arrow per side",side=>{
    const before=fixture(),parent=arrows(before)[0],after=attached(before,side),child=branch(after,side);
    const parentPath=graphicPathVisualEditPoints(parent)!,childPath=graphicPathVisualEditPoints(child)!;
    expect(childPath.start).toEqual(parentPath.middle);
    expect(childPath.pathKind).toBe("quadratic");
    expect(Math.sign(childPath.end.y-childPath.start.y)).toBe(-side);
    expect(child.style).toEqual(parent.style);
    expect(attachReactionOffshoot(after,parent.id,side).document).toBe(after);
    expect(arrows(attachReactionOffshoot(after,parent.id,-side as 1|-1).document)).toHaveLength(3);
  });
  it("follows parent translation and rotation, including branch conditions and native reopening",()=>{
    let before=attached(fixture()),parent=arrows(before)[0],child=branch(before);
    before=setReactionConditions(before,child.id,"Catalyst\n25 °C");
    const label=reactionConditionLabel(before,child.id)!;
    const after=moveDocumentObject(before,parent.id,{x:parent.x+20,y:parent.y+30});
    const path=graphicPathVisualEditPoints(get(after,child.id))!;
    expect(path.start.x).toBeCloseTo(graphicPathVisualEditPoints(child)!.start.x+20);
    expect(path.start.y).toBeCloseTo(graphicPathVisualEditPoints(child)!.start.y+30);
    expect(reactionConditionLabel(after,child.id)?.x).toBeCloseTo(label.x+20);
    expect(reactionConditionLabel(after,child.id)?.y).toBeCloseTo(label.y+30);
    const rotated=reconcileReactionConnections(after,applyPatches(after,[{op:"updateObject",objectId:parent.id,changes:{rotation:90}}]));
    expect(graphicPathVisualEditPoints(get(rotated,child.id))!.start).toEqual(graphicPathVisualEditPoints(get(rotated,parent.id))!.middle);
    const frame=reactionArrowFrame(graphicPathVisualEditPoints(get(rotated,parent.id))!);
    const end=graphicPathVisualEditPoints(get(rotated,child.id))!.end;
    expect((end.x-frame.origin.x)*frame.normal.x+(end.y-frame.origin.y)*frame.normal.y).toBeCloseTo(26);
    const reopened=deserializeDocument(serializeDocument(rotated));
    expect(reopened).toEqual(rotated);
    expect(exportDocumentToSvg(reopened).contents).toContain("Catalyst");
    expect(reconcileReactionConnections(before,after)).toEqual(after);
  });
  it("keeps the tail attached while allowing the branch head/curve to move and retains edited styles",()=>{
    const before=attached(fixture()),parent=arrows(before)[0],child=branch(before),path=graphicPathVisualEditPoints(child)!;
    const edited=moveDocumentObject(before,child.id,{x:child.x+20,y:child.y+10});
    const next=graphicPathVisualEditPoints(get(edited,child.id))!;
    expect(next.start).toEqual(graphicPathVisualEditPoints(parent)!.middle);
    expect(next.end.x).toBeCloseTo(path.end.x+20);expect(next.end.y).toBeCloseTo(path.end.y+10);
    const styled=reconcileReactionConnections(edited,applyPatches(edited,[{op:"updateObject",objectId:child.id,changes:{
      style:{...child.style,strokeColor:"#1d7f68",strokeWidth:3},data:{...get(edited,child.id).data,markerEnd:{kind:"open-arrow",sizePx:18}}}}]));
    const moved=moveDocumentObject(styled,parent.id,{x:parent.x+10,y:parent.y+20});
    expect(get(moved,child.id).data.markerEnd).toEqual({kind:"open-arrow",sizePx:18});
    expect(get(moved,child.id).style.strokeColor).toBe("#1d7f68");
  });
  it("slides the contact on a curved shaft, retains its fraction after parent edits, and survives native reopening",()=>{
    const initial=fixture(),parent=arrows(initial)[0];
    const curved=updateNativeGraphicPathHandle(initial,parent.id,"middle",{x:350,y:250});
    let before=attached(curved),child=branch(before);
    before=setReactionConditions(before,child.id,"Catalyst");
    const parentPath=graphicPathVisualEditPoints(get(before,parent.id))!;
    const target=reactionArrowFrame(parentPath,0.75).origin;
    const moved=reconcileReactionConnections(before,updateNativeGraphicPathHandle(before,child.id,"start",target));
    expect(reactionOffshootAttachment(get(moved,child.id))!.geometry.contactT).toBeCloseTo(0.75,7);
    const path=graphicPathVisualEditPoints(get(moved,child.id))!;
    expect(path.start.x).toBeCloseTo(target.x,7);expect(path.start.y).toBeCloseTo(target.y,7);
    expect(reactionConditionLabel(moved,child.id)).not.toEqual(reactionConditionLabel(before,child.id));
    const rebent=reconcileReactionConnections(moved,updateNativeGraphicPathHandle(moved,parent.id,"middle",{x:350,y:220}));
    const expected=reactionArrowFrame(graphicPathVisualEditPoints(get(rebent,parent.id))!,0.75).origin;
    expect(graphicPathVisualEditPoints(get(rebent,child.id))!.start.x).toBeCloseTo(expected.x,7);
    expect(graphicPathVisualEditPoints(get(rebent,child.id))!.start.y).toBeCloseTo(expected.y,7);
    const reopened=deserializeDocument(serializeDocument(rebent));
    expect(reopened).toEqual(rebent);
    expect(reconcileReactionConnections(moved,rebent)).toEqual(rebent);
    const edited=reconcileReactionConnections(rebent,updateNativeGraphicPathHandle(rebent,child.id,"end",{x:500,y:200}));
    expect(reactionOffshootAttachment(get(edited,child.id))!.geometry.contactT).toBeCloseTo(0.75,7);
    expect(graphicPathVisualEditPoints(get(edited,child.id))!.end).toEqual({x:500,y:200});
  });
  it("supports legacy midpoint attachments, clamps contact dragging to the shaft, and rejects invalid fractions",()=>{
    const initial=attached(fixture()),child=branch(initial),parent=arrows(initial)[0];
    const a=reactionOffshootAttachment(child)!;
    const {contactT:_,...geometry}=a.geometry;
    const oldChild={...child,compatibility:{...child.compatibility!,unknown:{...child.compatibility!.unknown,reactionOffshoot:{...a,geometry}}}};
    const legacy=applyPatches(initial,[{op:"updateObject",objectId:child.id,changes:oldChild}]);
    expect(reactionOffshootAttachment(oldChild)!.geometry.contactT).toBeUndefined();
    expect(graphicPathVisualEditPoints(get(reconcileReactionConnections(initial,legacy),child.id))!.start).toEqual(graphicPathVisualEditPoints(parent)!.middle);
    const moved=reconcileReactionConnections(legacy,updateNativeGraphicPathHandle(legacy,child.id,"start",{x:900,y:270}));
    expect(reactionOffshootAttachment(get(moved,child.id))!.geometry.contactT).toBe(1);
    expect(graphicPathVisualEditPoints(get(moved,child.id))!.start).toEqual(graphicPathVisualEditPoints(parent)!.end);
    for (const contactT of [NaN,Infinity,-0.1,1.1]) {
      expect(reactionOffshootAttachment({...oldChild,compatibility:{...oldChild.compatibility,unknown:{reactionOffshoot:{...a,geometry:{...geometry,contactT}}}}})).toBeUndefined();
    }
  });
  it("resolves nested offshoots independently of stacking order and excludes branches from arrangement items",()=>{
    let before=attached(fixture()),parent=arrows(before)[0],child=branch(before);
    before=attachReactionOffshoot(before,child.id,-1).document;
    before={...before,pages:[{...before.pages[0],objects:[...before.pages[0].objects].reverse()}]};
    const after=moveDocumentObject(before,parent.id,{x:parent.x+25,y:parent.y+15});
    for (const object of arrows(after).filter(o=>reactionOffshootAttachment(o))) {
      const attachment=reactionOffshootAttachment(object)!;
      expect(graphicPathVisualEditPoints(object)!.start).toEqual(graphicPathVisualEditPoints(get(after,attachment.parentArrowId))!.middle);
    }
    const all=selectDocumentObjects(after,after.pages[0].id,after.pages[0].objects.map(o=>o.id));
    expect(selectedArrangementObjectIds(all)).toEqual([parent.id]);
    const movedTogether=moveDocumentObjects(after,[parent.id,child.id],12,18);
    expect(graphicPathVisualEditPoints(get(movedTogether,child.id))!.start).toEqual(graphicPathVisualEditPoints(get(movedTogether,parent.id))!.middle);
  });
  it("deletes orphaned branches recursively and preserves authored branch labels as free text",()=>{
    let before=attached(fixture()),parent=arrows(before)[0],child=branch(before);
    before=attachReactionOffshoot(before,child.id,-1).document;
    before=setReactionConditions(before,child.id,"Catalyst");const label=reactionConditionLabel(before,child.id)!;
    const after=reconcileReactionConnections(before,applyPatches(before,[{op:"removeObject",objectId:parent.id}]));
    expect(arrows(after)).toHaveLength(0);
    const free=after.pages[0].objects.find(o=>o.id===label.id)!;
    expect(free).toMatchObject({type:"text",text:"Catalyst"});expect(reactionConditionAttachment(free)).toBeUndefined();
  });
  it("hides and restores offshoots when their parent has no visible shaft",()=>{
    const before=attached(fixture()),parent=arrows(before)[0],child=branch(before),point={x:300,y:300};
    const hidden=reconcileReactionConnections(before,applyPatches(before,[{op:"updateObject",objectId:parent.id,changes:{data:{artPathKind:"line",lineStart:point,lineEnd:point}}}]));
    expect(get(hidden,child.id).data.markerEnd).toBeUndefined();
    const restored=reconcileReactionConnections(hidden,applyPatches(hidden,[{op:"updateObject",objectId:parent.id,changes:{data:parent.data}}]));
    expect(get(restored,child.id).data.markerEnd).toEqual(child.data.markerEnd);
    expect(graphicPathVisualEditPoints(get(restored,child.id))).toEqual(graphicPathVisualEditPoints(child));
  });
  it("refuses an off-page branch and safely ignores malformed attachment metadata",()=>{
    const before=fixture(8),parent=arrows(before)[0];
    expect(attachReactionOffshoot(before,parent.id,1).document).toBe(before);
    expect(attachReactionOffshoot(before,parent.id,-1).document).not.toBe(before);
    expect(reactionOffshootAttachment({...parent,compatibility:{sourceFormat:"chemdraft-native",warnings:[],unknown:{reactionOffshoot:{version:1,parentArrowId:parent.id,side:1,geometry:{end:{along:NaN,normal:2}}}}}})).toBeUndefined();
  });
  it("moves existing parent conditions beside a new branch without crossing its shaft and restores centering after deletion",()=>{
    const start=fixture(),parent=arrows(start)[0];
    const before=setReactionConditions(start,parent.id,"THF\n80 °C"),label=reactionConditionLabel(before,parent.id)!;
    const after=attached(before),child=branch(after),moved=reactionConditionLabel(after,parent.id)!;
    expect(moved).not.toEqual(label);
    const path=graphicPathVisualEditPoints(child)!,control={x:2*path.middle.x-(path.start.x+path.end.x)/2,
      y:2*path.middle.y-(path.start.y+path.end.y)/2};
    for (let i=0;i<=200;i++) {
      const t=i/200,x=(1-t)**2*path.start.x+2*t*(1-t)*control.x+t*t*path.end.x,
        y=(1-t)**2*path.start.y+2*t*(1-t)*control.y+t*t*path.end.y;
      expect(x<moved.x-6 || x>moved.x+moved.width+6 || y<moved.y-6 || y>moved.y+moved.height+6).toBe(true);
    }
    const removed=reconcileReactionConnections(after,applyPatches(after,[{op:"removeObject",objectId:child.id}]));
    expect(reactionConditionLabel(removed,parent.id)?.x).toBeCloseTo(label.x);
    expect(reactionConditionLabel(removed,parent.id)?.y).toBeCloseTo(label.y);
  });
  it("attaches in projected page coordinates without copying the parent tilt onto the branch",()=>{
    const initial=fixture(),parent=arrows(initial)[0];
    const tilted=applyPatches(initial,[{op:"updateObject",objectId:parent.id,changes:{style:{...parent.style,tiltXDegrees:30,tiltYDegrees:25}}}]);
    const before=attached(tilted),child=branch(before);
    expect(child.style.tiltXDegrees).toBeUndefined();expect(child.style.tiltYDegrees).toBeUndefined();
    expect(graphicPathVisualEditPoints(child)!.start).toEqual(graphicPathVisualEditPoints(get(before,parent.id))!.middle);
    const changed=reconcileReactionConnections(before,applyPatches(before,[{op:"updateObject",objectId:parent.id,
      changes:{style:{...get(before,parent.id).style,tiltXDegrees:50,tiltYDegrees:40}}}]));
    expect(graphicPathVisualEditPoints(get(changed,child.id))!.start).toEqual(graphicPathVisualEditPoints(get(changed,parent.id))!.middle);
    const projected=applyPatches(changed,[{op:"updateObject",objectId:child.id,changes:{style:{...child.style,tiltYDegrees:35}}}]);
    const expectedHead=graphicPathVisualEditPoints(get(projected,child.id))!.end;
    const flat=reconcileReactionConnections(changed,projected);
    expect(get(flat,child.id).style.tiltYDegrees).toBeUndefined();
    expect(graphicPathVisualEditPoints(get(flat,child.id))!.end.x).toBeCloseTo(expectedHead.x);
    expect(graphicPathVisualEditPoints(get(flat,child.id))!.end.y).toBeCloseTo(expectedHead.y);
  });
});
