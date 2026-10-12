import { describe, expect, it } from "vitest";
import { applyPatches, serializeDocument, deserializeDocument, type ChemDraftDocument, type MoleculeObject, type TextObject, type GraphicObject } from "@chemdraft/chem-core";
import { ArrangementLayouts, moleculeVisualBoundsForArrangement } from "@chemdraft/layout-engine";
import { nativeSingleBondGraphSmiles } from "@chemdraft/document-workflow-core";
import { arrangeSelectedDocumentObjects, createNativeSingleBondMolecule, createPhase4Document,
  groupSelectedDocumentObjects, selectedArrangementObjectIds, selectDocumentObjects } from "./documentWorkflow";
import { createNativeSavePayload, openNativeDocument, createNativeReactionArrow } from "./documentWorkflow";
import { exportDocumentToSvg } from "@chemdraft/export-engine";
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
  const arrows = (document: ChemDraftDocument) => document.pages[0].objects.filter((object): object is GraphicObject => object.type === "graphic");
  it.each(ArrangementLayouts)("%s adds editable arrows and persists their geometry and ownership through a native file", (layout) => {
    const before = selectedCompounds();
    const result = arrangeSelectedDocumentObjects(before, layout, { addArrows: true });
    expect(result.document).not.toBe(before);
    expect(arrows(result.document)).toHaveLength(layout === "circle" || layout === "oval" ? 6 : 5);
    for (const arrow of arrows(result.document)) {
      expect(arrow.data.artPathKind).toBe(layout === "circle" || layout === "oval" ? "arc" : "line");
      expect(arrow.data.markerEnd?.kind).toBe("filled-arrow");
    }
    const payload = createNativeSavePayload(result.document);
    const reopened = openNativeDocument(payload.contents).document;
    if (!reopened) throw new Error("The arranged native file did not reopen");
    expect(arrows(reopened)).toEqual(arrows(result.document));
    const svg = exportDocumentToSvg(result.document, { includeWarnings: false }).contents;
    expect(svg).toContain("<svg");
    expect(svg).toContain("path");
    const arrangedAgain = arrangeSelectedDocumentObjects(reopened, layout, { addArrows: true }).document;
    expect(arrows(arrangedAgain)).toHaveLength(arrows(result.document).length);
  });
  it("repeated clicks are no-ops, including select-all, and layout changes replace arrows while keeping manual arrows", () => {
    let document = selectedCompounds();
    const manual = createNativeReactionArrow(document, { x: 30, y: 30 }, { x: 120, y: 30 }, "forward");
    document = applyPatches(document, [{ op: "addObject", pageId: document.pages[0].id, object: manual }]);
    const cycle = arrangeSelectedDocumentObjects(document, "circle", { addArrows: true }).document;
    expect(arrangeSelectedDocumentObjects(cycle, "circle", { addArrows: true }).document).toBe(cycle);
    const all = selectDocumentObjects(cycle, cycle.pages[0].id, cycle.pages[0].objects.filter((o) => o.id !== manual.id).map((o) => o.id));
    expect(selectedArrangementObjectIds(all)).toHaveLength(6);
    expect(arrangeSelectedDocumentObjects(all, "circle", { addArrows: true }).document).toBe(all);
    const grid = arrangeSelectedDocumentObjects(cycle, "grid", { addArrows: true }).document;
    expect(arrows(grid)).toHaveLength(5);
    expect(arrows(grid).every((arrow) => arrow.data.artPathKind === "line")).toBe(true);
    expect(grid.pages[0].objects.find((o) => o.id === manual.id)).toEqual(manual);
  });
  it.each([2, 3, 7, 12])("supports %i differently sized compounds in cycles and ragged grids", (count) => {
    const document = selectedCompounds(count);
    for (const layout of ["circle", "oval", "grid"] as const) {
      const result = arrangeSelectedDocumentObjects(document, layout, { addArrows: true });
      expect(result.status).toContain("with");
      expect(arrows(result.document)).toHaveLength(layout === "grid" ? count - 1 : count);
      for (const arrow of arrows(result.document)) {
        expect(arrow.x).toBeGreaterThanOrEqual(0);
        expect(arrow.y).toBeGreaterThanOrEqual(0);
        expect(arrow.x + arrow.width).toBeLessThanOrEqual(document.pages[0].width);
        expect(arrow.y + arrow.height).toBeLessThanOrEqual(document.pages[0].height);
      }
    }
  });
  it("refuses insufficient arrow clearance atomically", () => {
    const before = selectedCompounds(2);
    const result = arrangeSelectedDocumentObjects(before, "row", { gap: 10, addArrows: true });
    expect(result.document).toBe(before);
    expect(result.status).toContain("connecting arrows");
  });
  it.each(ArrangementLayouts)("%s preserves every molecular property and rigid internal geometry, and saves/reopens", (layout) => {
    const before = selectedCompounds();
    const result = arrangeSelectedDocumentObjects(before, layout, { addArrows: true });
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
    const arranged = arrangeSelectedDocumentObjects(document, "circle", { addArrows: true }).document;
    expect(arrows(arranged)).toHaveLength(2);
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
      expect(createLayerActions(document).find((c) => c.id === id)?.enabled).toBe(true);
      expect(createLayerActions(createPhase4Document()).find((c) => c.id === id)?.enabled).toBe(false);
    }
    expect(arrangementLayoutForCommand("layout.arrange.circle.other")).toBeUndefined();
    for (const alignment of ["left", "center", "right"] as const) {
      const id = arrangementCommandId("grid", alignment);
      expect(arrangementLayoutForCommand(id)).toBe("grid");
      expect(arrangementGridAlignmentForCommand(id)).toBe(alignment);
      expect(createLayerActions(document).find((command) => command.id === id)).toMatchObject({ enabled: true, icon: arrangementIconName("grid", alignment) });
      expect(createLayerActions(createPhase4Document()).find((command) => command.id === id)?.enabled).toBe(false);
    }
    expect(arrangementLayoutForCommand("layout.arrange.grid.left.extra")).toBeUndefined();
    expect(arrangementGridAlignmentForCommand("layout.arrange.grid.extra")).toBeUndefined();
  });
});
