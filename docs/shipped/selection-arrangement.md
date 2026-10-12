# Selection auto-arrangement

Implemented on `codex/auto-arrange-selection`, based on v0.3.9. This branch has not been released.

## Existing-feature audit

The v0.3.9 tag (`2a6d4c8c21af78ccbfdf5b5611b32b41dea0c001`) and the inspected main revision
(`ca9628618b2e174e51568446a5f3309f617864a7`) have Align Left/Center/Right/Top/Middle/Bottom and
Distribute Horizontally/Vertically, with Centers and Equal Gaps modes. These place objects along
one axis within existing outer anchors. They do not generate a circular or oval selection layout.
The headless CLI's `grid` builds a new document from inputs; it does not arrange an existing canvas
selection. The new row/column presets additionally align both axes and provide positive clearance.

## Using the feature

Select whole compounds. In the Main, Art, or Layout toolbar, click the four-dot **Arrange Selection**
control for Circle. Long-press or press Arrow Down to choose **Circle, Oval, Grid — Left,
Grid — Centered, Grid — Right, Row, or Column**. Each choice has its own layout glyph;
the three grid glyphs show the position of the incomplete final row.
Each toolbar arrangement also adds editable connecting arrows. Circle and Oval close the cycle
clockwise with curved arrows following the same circle/ellipse. Row and Column connect consecutive
items with straight arrows; Grid follows alternating rows in a snake with straight arrows. These
connections follow spatial order, not an inferred chemical mechanism.
The control is also available under Arrange & Align in Customize Main Toolbar. Group a compound
with its caption first to treat both as one layout item.

Browser automation previews leave the art transform diagnostic boxes and object IDs off by default.
These overlays require an explicit `artQa=1`, `chemdraftArtQa=1`, or stored art QA preference;
enabling the agent bridge alone does not enable them. Normal selection handles clear on a blank-page click.

- Circle: equally spaced angles, starting at twelve o'clock, with enough radius for every item pair.
- Oval: equally spaced angular steps on a 3:2 ellipse (not equal arc-length distances).
- Grid: automatic roughly square column count, centered items, tracks sized to their largest item.
  An incomplete final row uses equal edge gaps and aligns its visible frame to the full rows' left
  edge, center, or right edge. Centered is the default: five compounds form three over two centered.
- Row/column: equal empty space between edges, aligned on a common center line.

Circle and oval retain the current clockwise spatial order, rather than guessing reaction order
from chemistry or object creation order. Rows and columns retain their spatial order. Grid uses
center-based reading order. Minimum empty space is 48 document pixels. The pure planning/workflow
API accepts other gaps and grid column counts; this first toolbar surface uses the defaults.

Only translation patches are applied to compounds. Molecule sizes, atom/bond identity, charge, stereochemical
payloads, style, and internal coordinates relative to one another stay unchanged. Long atom labels
participate in bounds through layout-engine's shared label math. Selected groups remain intact;
selected descendants and carried marks do not get moved twice. The resulting document keeps its
selection and commits one named undo entry for positions and arrows together. Save/reopen and export
use the existing document paths. Arrow shafts and heads clear padded compound silhouettes.
The silhouette is a conservative convex outline from atom coordinates, shared bond-width geometry,
and full label bounds, with 12-pixel clearance. This allows curved arrows to extend into empty corners
of rectangular molecule frames while continuing to clear visible bonds and labels. Groups include
captions and anchored marks.

Compound alignment uses the centroid of the visible ring-system atoms when rings are present;
acyclic structures keep their atom-frame center. This prevents a tall substituent or long atom label
from shifting the ring off the cycle. Groups use the mean of their member molecule anchors. Circle/
Oval put these anchors on the ellipse, Row/Column share the anchor's cross-axis, and Grid aligns
row anchors while sizing tracks for the full asymmetric extents. Incomplete grid rows keep their
chosen visible-edge alignment. Rotated molecule frames and labels remain part of clearance.
Generated arrows carry endpoint IDs in native compatibility metadata. Reapplication updates the
arrows between those selected items rather than duplicating them; switching layouts replaces
obsolete connections. Generated arrows selected with Select All do not become layout items.
Hand-drawn arrows are left alone. Generated arrows are ordinary art objects and can be edited;
rearranging regenerates their geometry but retains their stroke style. The pure workflow's
`addArrows` option defaults to false for callers wanting only compound placement; the toolbar enables it.

Layouts are centered near the selection and shifted as a whole to fit the selected page. If the
layout cannot fit at its original scale, the operation returns the original document and explains
the failure. It never shrinks molecules or clips them to force a fit.

## Boundaries and verification

This is an arrangement tool, not a catalytic-cycle inference tool. It does not reroute hand-drawn
arrows, infer reaction order, avoid unselected objects, or attach
un-grouped captions. Select only the objects you want arranged. Layout presets apply directly; Undo restores the original layout. Adjust spacing has a local
preview with Save and Cancel.

Connectors are generated only when every connection fits without crossing a selected compound;
otherwise the whole operation is refused. Arrows refresh on arrangement and on subsequent compound/group edits, including connections to
items outside the current selection. See the following-arrow section below for routing limits.

The implementation uses the shared command registry and existing inline/native toolbar flyouts.
There is no new native code, platform branch, chemistry engine, or dependency. Tests cover varied
counts and sizes, non-neighbour clearance, equal circle angles, stable reapplication, page fitting
and refusal, groups/labels/marks, selection/page scope, payload and SMILES preservation, serialization,
the actual toolbar click and submenu, and a single Undo/Redo through the real MainWindow registry.
Arrow tests additionally cover full-curve clearance, clockwise closing edges, two-compound cycles,
longer endpoints around fused-ring silhouettes, ragged-grid alignment with unequal sizes, page
bounds, duplicate prevention, layout changes, distinct flyout glyphs, and native-file persistence.
`gridAlignment` accepts `left`, `center`, or `right`; the existing `layout.arrange.grid` command
selects centered, with `layout.arrange.grid.left` and `.right` for the alternatives.

Native macOS and Windows hands-on verification remains required before merging/releasing; see the
standing manual stress checklist. The development host has no Rust/Cargo toolchain.

## Following arrows and reaction conditions (unreleased branch)

Generated arrows retain their endpoint links. Moving a compound or group refits its incoming and
outgoing arrows against the current visible silhouettes, including grouped captions and atom labels.
Straight layouts keep straight arrows; cycle arrows keep their signed curvature and become editable
quadratic curves when a single endpoint moves. Translating the entire cycle keeps its exact ellipse.
The desktop reconciles connections during document previews and commits, so dragging, resizing,
rotating, aligning, and editing molecule geometry update the connections in the same undo transaction.
Hand-drawn arrows are not implicitly attached to compounds.

Right-click an arrow and choose **Reaction conditions…** (registered command `reaction.conditions`).
Enter multiline reagents, temperature, time, and yield; choose above/outside or below/inside. Saving
creates or updates one ordinary native text object, positioned beside the visible arrow and clear of
molecule/label frames where space permits. Drag the label to customize its offset, or double-click it
to edit with the normal text editor. The offset follows later arrow changes. Empty text in the
conditions dialog removes the label. The command also accepts a selected attached label and supports
manually drawn native art arrows. Cancel changes nothing.

The editor inserts °, ±, −, Δ, ν, µ, ·, and × at the caret or replaces the selected text. Select
formula digits or charges and apply Subscript/Superscript; Normal removes the script. With a collapsed
selection these controls set the typing format. A formatted preview shows the native span styles.
Formatting survives dialog reopening, ordinary text edits, Undo/Redo, following, and native exports.
SVG text spans serialize inline so formulas do not acquire spaces between their formatted runs.
Native subscript baselines use a smaller 0.16-em drop in the canvas, editor preview and SVG output.

Default labels center perpendicular to the shaft at its visible midpoint, including diagonal curves.
Collision placement first checks centered positions farther from the shaft, then allows a bounded
sideways adjustment and keeps the requested side; an inward curve cannot push its label through the
cycle centre. When no candidate fits, the label retains its preferred anchor rather than jumping
to a distant position. Manual dragging remains available for dense figures.

## Adjust arrangement spacing

Select two or more compounds/groups, then choose **Adjust spacing…** in the arrangement flyout
or **Adjust arrangement spacing…** in the selection context menu. The slider previews distances
relative to the current selection: 100% is unchanged, and smaller values bring item centers closer.
Each item translates without scaling its atoms, bonds, captions, anchored marks, or stroke styles.
Attached arrows, branches and conditions follow. Complete semantic circle/oval cycles retain their
ellipse and get newly clipped arcs around the fixed-size compounds; other connections use ordinary
endpoint following. The slider stops at compound-clearance, minimum-arrow-length and page limits.
It does not avoid unselected objects or guarantee that every label fits a crowded figure.
Cancel/Escape leaves the drawing unchanged; Save commits one Undo/Redo step. Native save/reopen
stores the resulting positions and arrow geometry. Existing condition labels get the new centering
when their arrow changes or the conditions dialog is saved; manual label offsets remain respected.

Native `.chemdraft` save/reopen preserves attachments and offsets; SVG/PNG exports include the visible
arrows and text. Attachment metadata is under `compatibility.unknown.arrangementConnector` and
`reactionCondition`; it adds no chemical payload or dependency. Generated arrows and condition
labels are excluded as items when arranging Select All, including detached condition labels. Matching connections retain their labels
on repeated arrangement. If a connection disappears on a layout switch or its arrow/endpoint is
deleted, authored conditions stay as detached native text rather than being discarded. Their
semantic identity persists as `compatibility.unknown.reactionConditionRole: 1`, independently
of the live arrow attachment. Older detached labels are recognized by the native generated
`reaction_conditions_<number>` ID and source provenance; classification never guesses from text.
The next edit persists their role. Reconciliation removes generated connectors whose endpoint
was wrongly assigned to a condition label by an earlier arrangement. Ordinary captions remain
eligible, and detached conditions remain editable text rather than becoming chemical atoms.

When compounds overlap, a gap is too short, or another connected compound blocks the shaft, that
connection temporarily has no visible shaft/head; separating the compounds restores it. This slice
does not route around arbitrary intervening compounds or guarantee collision-free text in an
already crowded figure. Labels remain horizontal and can be moved manually. Native macOS and
Windows interaction passes remain required before release.

## Parent-linked offshoots (unreleased branch)

Right-click a native art arrow or its condition label and choose **Attach offshoot — top / outside**
or **Attach offshoot — bottom / inside**. These are registered `reaction.offshoot.outside` and
`reaction.offshoot.inside` commands. Each parent has at most one offshoot per side. They create
ordinary editable quadratic art arrows that start tangent to the parent's shaft, forming a gentle
fork toward the chosen side. Right-click the offshoot > Reaction conditions… for a catalyst/reagent label.

The branch follows parent translation, rotation and regenerated cycle geometry. Drag its start
handle at the join to slide the contact along the parent shaft. The contact snaps to the nearest
point on the shaft and retains its fraction when the parent changes. Head and bend
can be adjusted with the existing handles or a drag while the tail stays attached; its stroke and
arrowhead edits remain. Attached condition labels follow it. Parent conditions make bounded placement
adjustments around branch shafts where space permits. Initial off-page branches shorten or refuse
with a status message. Branches do not infer catalytic chemistry or route around other compounds;
crowded figures may need manual head/label adjustments.

Native save/reopen retains `compatibility.unknown.reactionOffshoot`, including its parent ID, side
and local head/midpoint geometry plus an optional `contactT` fraction. Older attachments omit
`contactT` and retain their midpoint join and saved shape. New attachments use the gentle fork;
delete and reattach an older default to adopt it. Offshoots are excluded from Select All arrangement inputs. Deleting
the parent removes dependent branches recursively and preserves their authored labels as free text;
Undo restores the whole operation. A temporarily hidden parent shaft also hides its offshoots and
restores them when the parent returns. Dependency resolution is independent of object stacking order.
