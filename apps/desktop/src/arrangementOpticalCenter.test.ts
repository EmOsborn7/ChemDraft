import { describe, expect, it } from "vitest";
import { applyPatches, type MoleculeObject, type GraphicObject } from "@chemdraft/chem-core";
import { depictSmiles2D } from "@chemdraft/ocl-adapter";
import { createSmilesMolecule } from "@chemdraft/document-workflow-core";
import { moleculeAnchorForArrangement, moleculeVisualBoundsForArrangement, smallestRingAtomIdsByBondId } from "@chemdraft/layout-engine";
import { graphicPathVisualEditPoints } from "@chemdraft/art-engine";
import { arrangeSelectedDocumentObjects, attachReactionOffshoot, createPhase4Document, moveDocumentObject,
  reactionOffshootAttachment, selectDocumentObjects } from "./documentWorkflow";

describe("ring-centred compound placement",()=>{
  it("uses the ring centroid for a large substituent, keeps full bounds for clearance, and preserves chemistry",()=>{
    let document=createPhase4Document("Optical alignment");
    for (const [i,smiles] of ["CC(C)(C)c1ccccc1","c1ccccc1","Cc1ccc2ccccc2c1","C1CCC2CCCCC2C1","c1ccc2c(c1)CCC2"].entries()) {
      const object=createSmilesMolecule(document,{x:180+(i%3)*150,y:200+Math.floor(i/3)*180},depictSmiles2D(smiles),smiles);
      document=applyPatches(document,[{op:"addObject",pageId:document.pages[0].id,object}]);
    }
    const originals=document.pages[0].objects.filter((o):o is MoleculeObject=>o.type==="molecule");
    const asymmetric=originals[0],ringIds=new Set([...smallestRingAtomIdsByBondId(asymmetric).values()].flatMap(ids=>[...ids]));
    const ringAtoms=asymmetric.atoms.filter(atom=>ringIds.has(atom.id)),anchor=moleculeAnchorForArrangement(asymmetric);
    expect(ringAtoms).toHaveLength(6);
    expect(anchor.x).toBeCloseTo(ringAtoms.reduce((sum,atom)=>sum+atom.x,0)/6);
    expect(anchor.y).toBeCloseTo(ringAtoms.reduce((sum,atom)=>sum+atom.y,0)/6);
    const bounds=moleculeVisualBoundsForArrangement(asymmetric);
    expect(Math.hypot(anchor.x-bounds.x-bounds.width/2,anchor.y-bounds.y-bounds.height/2)).toBeGreaterThan(5);
    document=selectDocumentObjects(document,document.pages[0].id,originals.map(o=>o.id));
    const arranged=arrangeSelectedDocumentObjects(document,"circle",{addArrows:true});
    expect(arranged.status).toContain("with 5 arrows");
    const arrows=arranged.document.pages[0].objects.filter((o):o is GraphicObject=>o.type==="graphic"),cycle=arrows[0].data;
    for (const before of originals) {
      const after=arranged.document.pages[0].objects.find(o=>o.id===before.id) as MoleculeObject;
      const point=moleculeAnchorForArrangement(after);
      expect(((point.x-cycle.arcCenter!.x)/cycle.arcRadiusX!)**2+((point.y-cycle.arcCenter!.y)/cycle.arcRadiusY!)**2).toBeCloseTo(1);
      expect(after.structure).toBe(before.structure);expect(after.chemistry).toEqual(before.chemistry);expect(after.bonds).toEqual(before.bonds);
      expect(after.atoms.map(a=>({...a,x:0,y:0}))).toEqual(before.atoms.map(a=>({...a,x:0,y:0})));
    }
    const withBranch=attachReactionOffshoot(arranged.document,arrows[0].id,1).document;
    const endpoint=(arrows[0].compatibility!.unknown.arrangementConnector as {fromId:string}).fromId;
    const target=withBranch.pages[0].objects.find(o=>o.id===endpoint)!;
    const moved=moveDocumentObject(withBranch,target.id,{x:target.x+20,y:target.y+14});
    const branch=moved.pages[0].objects.find(o=>reactionOffshootAttachment(o)) as GraphicObject;
    const parent=moved.pages[0].objects.find(o=>o.id===arrows[0].id) as GraphicObject;
    expect(graphicPathVisualEditPoints(branch)!.start).toEqual(graphicPathVisualEditPoints(parent)!.middle);
  });
});
