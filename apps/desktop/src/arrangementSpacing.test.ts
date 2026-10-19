import {describe,expect,it} from "vitest";
import {applyPatches} from "@chemdraft/chem-core";
import {nativeSingleBondGraphSmiles} from "@chemdraft/document-workflow-core";
import {adjustArrangementSpacing,arrangementSpacingRange,arrangementSpacingPreviewBounds,arrangeSelectedDocumentObjects,
  createPhase4Document,createNativeSingleBondMolecule,selectDocumentObjects,
  createNativeSavePayload,openNativeDocument} from "./documentWorkflow";
function fixture(layout:"circle"|"oval"|"row"|"column"|"grid") {
  let doc=createPhase4Document("Spacing");
  for(let i=0;i<5;i++) doc=applyPatches(doc,[{op:"addObject",pageId:doc.pages[0].id,
    object:createNativeSingleBondMolecule(doc,{x:230+(i%3)*80,y:260+Math.floor(i/3)*130})}]);
  doc=selectDocumentObjects(doc,doc.pages[0].id,doc.pages[0].objects.map(o=>o.id));
  return arrangeSelectedDocumentObjects(doc,layout,{gap:100}).document;
}
describe("arrangement spacing with fixed molecule sizes",()=>{
  it.each(["circle","oval","row","column","grid"] as const)("compacts %s by translation with chemistry, sizes preserved",layout=>{
    let before=fixture(layout);
    const range=arrangementSpacingRange(before);expect(range.min).toBeLessThan(1);
    const factor=(1+range.min)/2,result=adjustArrangementSpacing(before,factor);
    expect(result.ok).toBe(true);const after=result.document;
    const a=arrangementSpacingPreviewBounds(before)!,b=arrangementSpacingPreviewBounds(after)!;
    expect(b.width<=a.width && b.height<=a.height).toBe(true);
    expect(b.width<a.width || b.height<a.height).toBe(true);
    expect(after.selection).toEqual(before.selection);
    for(const old of before.pages[0].objects) if(old.type==="molecule") {
      const next=after.pages[0].objects.find(o=>o.id===old.id)!;
      if(next.type!=="molecule") throw new Error("Expected molecule");
      expect(next.width).toBe(old.width);expect(next.height).toBe(old.height);expect(next.rotation).toBe(old.rotation);
      expect(next.style).toEqual(old.style);expect(next.bonds).toEqual(old.bonds);
      expect(nativeSingleBondGraphSmiles(next.atoms,next.bonds)).toBe(nativeSingleBondGraphSmiles(old.atoms,old.bonds));
      const dx=next.atoms[0].x-old.atoms[0].x,dy=next.atoms[0].y-old.atoms[0].y;
      for(let i=0;i<old.atoms.length;i++) expect({...next.atoms[i],x:old.atoms[i].x,y:old.atoms[i].y}).toEqual(old.atoms[i]);
      for(let i=0;i<old.atoms.length;i++) {expect(next.atoms[i].x-old.atoms[i].x).toBeCloseTo(dx);expect(next.atoms[i].y-old.atoms[i].y).toBeCloseTo(dy);}
    }
    const reopened=openNativeDocument(createNativeSavePayload(after).contents).document!;
    expect(reopened).toBeDefined();expect(reopened.pages[0].objects).toEqual(after.pages[0].objects);
  });
  it("refuses overlap/page overflow atomically and leaves unchanged spacing as a no-op",()=>{
    const before=fixture("circle");
    for(const factor of [0.1,5,NaN]) {const result=adjustArrangementSpacing(before,factor);expect(result.ok).toBe(false);expect(result.document).toBe(before);}
    expect(adjustArrangementSpacing(before,1).document).toBe(before);
    const range=arrangementSpacingRange(before);
    expect(adjustArrangementSpacing(before,range.min).ok).toBe(true);
    expect(adjustArrangementSpacing(before,range.max).ok).toBe(true);
  });
});
