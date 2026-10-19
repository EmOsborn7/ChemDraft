import { depictSmiles2D } from "@chemdraft/ocl-adapter";
import { createSmilesMolecule } from "@chemdraft/document-workflow-core";
import { describe, expect, it } from "vitest";
import { applyPatches, serializeDocument, deserializeDocument, type ChemDraftDocument, type MoleculeObject, type TextObject } from "@chemdraft/chem-core";
import { ArrangementLayouts, moleculeVisualBoundsForArrangement } from "@chemdraft/layout-engine";
import { nativeSingleBondGraphSmiles } from "@chemdraft/document-workflow-core";
import { arrangeSelectedDocumentObjects, createNativeSingleBondMolecule, createPhase4Document,
  groupSelectedDocumentObjects, selectedArrangementObjectIds, selectDocumentObjects } from "./documentWorkflow";
import { arrangementCommandId, arrangementLayoutForCommand, arrangementGridAlignmentForCommand, arrangementIconName, createLayerActions } from "./commands";

function selectedCompounds(count = 6): ChemDraftDocument {
  let document = createPhase4Document("Catalytic cycle");
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const molecule = createNativeSingleBondMolecule(document, { x: 200 + i % 3 * 120, y: 250 + Math.floor(i / 3) * 150 },
      i === 4 ? { bondStyle: "wedge" } : {});
    // A long visible label tests the stored atom box's insufficient width.
    if (i === 2) molecule.atoms[0].element = "PhosphineLigand";
    if (i === 3) { molecule.atoms[1].formalCharge = 1; }
    ids.push(molecule.id);
    document = applyPatches(document, [{ op: "addObject", pageId: document.pages[0].id, object: molecule }]);
  }
  return selectDocumentObjects(document, document.pages[0].id, ids);
}

describe("arranging document selections", () => {
  it.each(ArrangementLayouts)("%s rigidly translates chiral, isotopic and charged molecules", layout => {
    let doc=createPhase4Document("Stereo preservation");
    for (const [i,smiles] of ["N[C@@H](C)C(=O)O", "[13CH3][C@H](F)Cl", "C[N+](C)(C)C"].entries()) {
      const molecule=createSmilesMolecule(doc,{x:180+i*150,y:250},depictSmiles2D(smiles),smiles);
      doc=applyPatches(doc,[{op:"addObject",pageId:doc.pages[0].id,object:molecule}]);
    }
    doc=selectDocumentObjects(doc,doc.pages[0].id,doc.pages[0].objects.map(o=>o.id));
    const after=arrangeSelectedDocumentObjects(doc,layout).document;
    for(const before of doc.pages[0].objects) if(before.type==="molecule") {
      const next=after.pages[0].objects.find(o=>o.id===before.id) as MoleculeObject;
      expect(next.structure).toBe(before.structure);expect(next.chemistry).toEqual(before.chemistry);
      expect(next.bonds).toEqual(before.bonds);expect(next.atoms).toHaveLength(before.atoms.length);
      const dx=next.atoms[0].x-before.atoms[0].x,dy=next.atoms[0].y-before.atoms[0].y;
      for(let i=0;i<before.atoms.length;i++) {
        expect({...next.atoms[i],x:before.atoms[i].x,y:before.atoms[i].y}).toEqual(before.atoms[i]);
        expect(next.atoms[i].x-before.atoms[i].x).toBeCloseTo(dx);expect(next.atoms[i].y-before.atoms[i].y).toBeCloseTo(dy);
      }
      expect({...next,x:before.x,y:before.y,atoms:before.atoms}).toEqual(before);
    }
    expect(after.selection).toEqual(doc.selection);
    expect(after.pages[0].objects).toHaveLength(3);
  });
  it.each(ArrangementLayouts)("%s preserves every molecular property and rigid internal geometry, and saves/reopens", (layout) => {
    const before = selectedCompounds();
    const result = arrangeSelectedDocumentObjects(before, layout);
    expect(result.document).not.toBe(before);
    expect(result.document.selection).toEqual(before.selection);
    const reopened = deserializeDocument(serializeDocument(result.document));
    expect(reopened).toEqual(result.document);
    for (const object of reopened.pages[0].objects.filter((object) => object.type === "molecule")) {
      const old = before.pages[0].objects.find((candidate) => candidate.id === object.id)! as MoleculeObject;
      const next = object as MoleculeObject;
      expect({ ...next, x: old.x, y: old.y, atoms: old.atoms }).toEqual(old);
      const dx = next.x - old.x, dy = next.y - old.y;
      next.atoms.forEach((atom, i) => {
        expect(atom.x - old.atoms[i].x).toBeCloseTo(dx, 7);
        expect(atom.y - old.atoms[i].y).toBeCloseTo(dy, 7);
        expect({ ...atom, x: old.atoms[i].x, y: old.atoms[i].y }).toEqual(old.atoms[i]);
      });
      expect(next.atoms).toHaveLength(old.atoms.length);
      expect(next.bonds).toHaveLength(old.bonds.length);
      expect(nativeSingleBondGraphSmiles(next.atoms, next.bonds)).toBe(nativeSingleBondGraphSmiles(old.atoms, old.bonds));
    }
  });
  it("includes long atom labels in the visible clearance", () => {
    const before = selectedCompounds();
    const after = arrangeSelectedDocumentObjects(before, "row", { gap: 24 }).document;
    const bounds = after.pages[0].objects.map((object) => moleculeVisualBoundsForArrangement(object as MoleculeObject)).sort((a, b) => a.x - b.x);
    for (let i = 1; i < bounds.length; i++) expect(bounds[i].x - bounds[i - 1].x - bounds[i - 1].width).toBeCloseTo(24, 6);
  });
  it("moves grouped compounds and labels together and excludes selected descendants and carried marks", () => {
    let document = selectedCompounds(2);
    const [first, second] = document.pages[0].objects as MoleculeObject[];
    const label: TextObject = { id: "caption", type: "text", x: first.x, y: first.y + 50, width: 160, height: 24,
      rotation: 0, style: {}, text: "Intermediate A", spans: [] };
    document = applyPatches(document, [
      { op: "addObject", pageId: document.pages[0].id, object: label },
      { op: "addObject", pageId: document.pages[0].id, object: {
        id: "mark", type: "electron-mark", markKind: "lone-pair", x: first.x, y: first.y - 12, width: 8, height: 8,
        rotation: 0, style: {}, anchor: { kind: "atom", objectId: first.id, atomId: first.atoms[0].id }
      } }
    ]);
    document = groupSelectedDocumentObjects(selectDocumentObjects(document, document.pages[0].id, [first.id, label.id]));
    const groupId = document.selection.objectIds[0];
    document = applyPatches(document, [{ op: "setSelection", pageId: document.pages[0].id, objectIds: [groupId, first.id, "mark", second.id] }]);
    expect(selectedArrangementObjectIds(document)).toEqual([second.id, groupId]);
    const arranged = arrangeSelectedDocumentObjects(document, "circle").document;
    const movedFirst = arranged.pages[0].objects.find((o) => o.id === first.id)!;
    const dx = movedFirst.x - first.x, dy = movedFirst.y - first.y;
    for (const id of [label.id, "mark"]) {
      const old = document.pages[0].objects.find((o) => o.id === id)!;
      const next = arranged.pages[0].objects.find((o) => o.id === id)!;
      expect(next.x - old.x).toBeCloseTo(dx, 7);
      expect(next.y - old.y).toBeCloseTo(dy, 7);
    }
    expect(arranged.pages[0].objects.find((o) => o.id === "mark" && o.type === "electron-mark"))
      .toMatchObject({ anchor: { kind: "atom", objectId: first.id, atomId: first.atoms[0].id } });
    expect(arranged.pages[0].objects.find((o) => o.id === groupId)).toEqual(document.pages[0].objects.find((o) => o.id === groupId));
  });
  it("changes only selected objects on the selected page, and does nothing on insufficient selections", () => {
    const document = selectedCompounds(3);
    const selected = selectDocumentObjects(document, document.pages[0].id, document.selection.objectIds.slice(0, 2));
    const result = arrangeSelectedDocumentObjects(selected, "circle");
    expect(result.document.pages[0].objects[2]).toEqual(document.pages[0].objects[2]);
    const single = selectDocumentObjects(document, document.pages[0].id, [document.selection.objectIds[0]]);
    expect(arrangeSelectedDocumentObjects(single, "circle").document).toBe(single);
    const otherPage = { ...document.pages[0], id: "page_other", objects: document.pages[0].objects.map((o) => ({ ...o, id: `${o.id}_other` })) };
    const twoPages = { ...selected, pages: [otherPage, selected.pages[0]] };
    const arranged = arrangeSelectedDocumentObjects(twoPages, "circle").document;
    expect(arranged.pages[0]).toEqual(otherPage);
    expect(arranged.pages[1].objects[0]).not.toEqual(selected.pages[0].objects[0]);
  });
  it("refuses page overflow without moving, resizing or recording a document change", () => {
    const document = selectedCompounds();
    const result = arrangeSelectedDocumentObjects(document, "circle", { gap: 1000 });
    expect(result.document).toBe(document);
    expect(result.status).toContain("does not fit");
  });
  it("does not arrange a nested selected group twice", () => {
    let document = selectedCompounds(3);
    const [first, second, third] = document.selection.objectIds;
    document = groupSelectedDocumentObjects(selectDocumentObjects(document, document.pages[0].id, [first, second]));
    const inner = document.selection.objectIds[0];
    document = applyPatches(document, [{ op: "addObject", pageId: document.pages[0].id, object: {
      id: "outer", type: "group", childObjectIds: [inner], x: 0, y: 0, width: 1, height: 1, rotation: 0, style: {}
    } }, { op: "setSelection", pageId: document.pages[0].id, objectIds: ["outer", inner, first, third] }]);
    expect(selectedArrangementObjectIds(document)).toEqual([third, "outer"]);
    const arranged = arrangeSelectedDocumentObjects(document, "circle").document;
    const old = document.pages[0].objects.filter((o) => o.id === first || o.id === second);
    const next = arranged.pages[0].objects.filter((o) => o.id === first || o.id === second);
    expect(next[0].x - old[0].x).toBeCloseTo(next[1].x - old[1].x, 7);
    expect(next[0].y - old[0].y).toBeCloseTo(next[1].y - old[1].y, 7);
  });
  it("registers every layout with truthful availability and strict command parsing", () => {
    const document = selectedCompounds();
    for (const layout of ArrangementLayouts) {
      const id = arrangementCommandId(layout);
      expect(arrangementLayoutForCommand(id)).toBe(layout);
      expect(createLayerActions(document, true).find((c) => c.id === id)?.enabled).toBe(true);
      expect(createLayerActions(createPhase4Document(), true).find((c) => c.id === id)?.enabled).toBe(false);
    }
    expect(arrangementLayoutForCommand("layout.arrange.circle.other")).toBeUndefined();
    for (const alignment of ["left", "center", "right"] as const) {
      const id = arrangementCommandId("grid", alignment);
      expect(arrangementLayoutForCommand(id)).toBe("grid");
      expect(arrangementGridAlignmentForCommand(id)).toBe(alignment);
      expect(createLayerActions(document, true).find((command) => command.id === id)).toMatchObject({ enabled: true, icon: arrangementIconName("grid", alignment) });
      expect(createLayerActions(createPhase4Document(), true).find((command) => command.id === id)?.enabled).toBe(false);
    }
    expect(arrangementLayoutForCommand("layout.arrange.grid.left.extra")).toBeUndefined();
    expect(arrangementGridAlignmentForCommand("layout.arrange.grid.extra")).toBeUndefined();
  });
});
