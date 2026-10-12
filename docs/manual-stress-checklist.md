# Manual stress checklist

The standing hands-on checklist for interactive surfaces. It moved here from `AGENTS.md` §20 when that
file was consolidated (2026-10-04); `AGENTS.md` §14 still requires it. Run every item on **macOS and
Windows** unless the item names one platform. `docs/windows-port-stress-test.md` records the Windows
port's own hands-on pass.

Manual stress must cover tab initialization, user tab persistence, mixed states, multi-molecule
scaling, sparse override precedence, terminal carbon labels, hidden implicit hydrogens, explicit
hydrogens, fonts, save/reopen, undo/redo, Spin 3D, atom-label editor placement, SVG export, and ring
selection after tab switching/closing.

Drawing-tool surfaces added since: each reaction-arrow kind by click and by drag (heads render per
kind, resize handles work, rotate and flip move the arrow itself and not just its frame), both
bracket kinds placed and resized, dagger and submenu symbol stamps, atom labels through `tool.atom`,
chains dragged off an existing atom and off empty canvas including against a page edge, formula text
applied to a typed formula, one undo entry per gesture, and SVG export parity with the canvas for
arrows, brackets, and orbitals.

Toolbar and arrow surfaces added since: the curated arrow flyout (bold, dashed, curved 90/180, both
fishhooks, no-reaction) opened cold, warm, and after a long idle — the first press of a session must
place the popout under its button, not offset from the screen origin; the selection-aware Main style
widget in all four variants (text, molecule, arrow, shape) including its no-reaction ✗-size select,
with a gesture cancelled mid-press (the layout must not freeze on the previous selection); Shift-hover
transform boxes on arrows — the box latches to the first arrow for the whole hold, its rotate, 3D
rotate, and resize handles all work under the arrow tools, and dismissal leaves no ghost pixels;
arrowhead resizing on a scaled equilibrium (the head must land at the pointer, and an untouched shaft
handle must not move the shaft); "Set as Default Arrow Style" captured from a dashed arrow made solid;
tooltips on a palette dragged to a second monitor; and toolbars restored after being left off-screen
or on a since-detached display.

Keybinding and molecule-editing surfaces added since: the Chain tools flyout (Chain / Flexible
Chain) opened cold and warm, with a flexible-chain drag that turns corners both free and
atom-anchored while a straight drag still reproduces the straight planner exactly; the numeric
hover hotkeys in both keybinding schemes (rings 3–0 attach/fuse over atoms and bonds, wedge/hash
sprouts 4/5, carbonyl 2, gem-dimethyl 9, the 0-key cyclic bond closing a ring), with tool keys
following the selected scheme — `e` over an atom applies the Et nickname in the ChemDraw scheme,
while ChemDraft's `e` arms the eraser; charge stacking
by hotkey and by the charge tool up to ±9 and back down to mark removal; the Clear/Restore
Warnings context menu under whole-molecule and partial selections; element-symbol text converting
to a naked atom on every edit-ending gesture (Escape, click-away, tool switch), and Delete
stripping a labeled atom back to skeleton carbon before the second press deletes it; a bond
dragged onto another molecule object's atom merging the two objects into one; magnetic
canonical-geometry snap during atom drags, partial-selection drags, and fragment rotations — a
release outside the capture window must land exactly at the pointer; junction-pivot rotation
holding the junction and attachment bond fixed; and switching the keybinding scheme live with the
main window, detached palettes, and the native menu accelerators all following.

Windows surfaces added since (the port on `windows-port`; `pnpm smoke:windows-menu-churn` automates
the crash part): a second launch and a double-clicked `.chemdraft` file handed to the running app by
single-instance, which then opens and can save that file; closing the document window (title-bar ✕,
File > Exit, Alt+F4) quits the app after flushing the session, so a drawing made seconds earlier
survives relaunch; F5 and Ctrl+R never reload the webview (a reload discards the document) while a
Ctrl+R the app binds still runs; Ctrl+Y redo; the color picker's HEX field — six digits apply live,
shorthand applies on Enter or blur, Escape abandons a half-typed value — and RGB/CMYK fields that
settle a typed value once, on blur or Enter; palette, popover, and tooltip windows staying off the
taskbar and never stealing focus from the document; palette toggles that bring a palette hidden
behind the document to the front instead of hiding it; popovers and tooltips landing under their
button across two monitors at different scale factors; a maximized window restored maximized; and
the clipboard round trips (text, ChemDraft selection, SVG, PNG, and CDX/MDL paste from ChemDraw); and the app
updater — an older signed build offered the newer one by the launch check and by File ▸ Check for
Updates…, the document saved before the passive installer runs and restored after it relaunches, and
a branch build or `pnpm dev` session never checking (`docs/releasing/windows-updates.md`); an update
accepted while autosave is off (the last session unreadable) refusing to install over unsaved work; and
opening from Explorer a `.cdx` (the app says it is a ChemDraw binary, including at a cold start that
then restores the last session), a UTF-16 `.cdxml`, and a CDXML file whose molecules sit inside `<group>`
elements (they open grouped).

Undo/redo surfaces added since: Edit ▸ Undo/Redo from the menu and ⌘Z/⇧⌘Z — one press is one undo
on the canvas, and the same shortcut inside a focused text-entry field (the atom-label box, a
palette search box, a text object) undoes that field's own text instead; and typing half an atom
label, clicking a palette, clicking back into the label box, and finishing the label leaves it
intact rather than reverting or duplicating characters.

Aromatic surfaces added since: paste benzene, pyrrole, indole and porphine as type-4 MOL and as
CDXML `Order="1.5"` — formulas right, pyrrole-type N drawn NH, the tautomer badge shown only where an
N–H was inferred, and its reason in the status bar on hover; ring picking and atom clicks still work
over a badge; a CDXML pyrrole with `NumHydrogens` N-methylated leaves no stale badge; Copy As MOL and
CDXML of a pasted aromatic reopen with the same tautomer; and Spin 3D on a pasted aromatic.

This list is repo-wide and cumulative. Add to it when a slice ships a new interactive surface; do not
replace it with a slice-scoped list, or the standing checklist is lost when that slice ends.

Auto-arrangement surfaces: select six differently sized compounds, click Arrange Selection for a
circle, then open its flyout by long press and Arrow Down and choose Oval, Grid, Row and Column.
Repeat with 2, 3, 7 and 12 compounds; verify equal circle angles, clearance around long atom labels,
upright structures, and unchanged clockwise order. Group each compound with its caption and repeat;
captions and anchored electron marks must travel with their compound, once. Check one Undo/Redo
per arrangement, selection retained, an unselected arrow/conditions text unchanged, save/reopen,
and matching SVG export. Near a page edge the whole layout shifts onto the page; an oversized
layout reports that it cannot fit and changes nothing. Verify the flyout in native palettes on
both platforms, and add/remove the control in Customize Main Toolbar without losing its routing.

Auto-arrangement arrows: Circle/Oval adds one clockwise curved arrow per compound, including the
last-to-first connection; Row/Column adds straight arrows between neighbors and Grid snakes through
alternate rows. Check a two-compound cycle has two distinct arcs and remains on the page. Long labels
and grouped captions must clear the arrow shaft and head. Repeat a click and Select All then arrange:
no duplicate arrows, no generated arrow used as a compound. Switch from Circle to Grid and back:
the previous generated arrows are replaced while hand-drawn arrows remain unchanged. Save/reopen
retains editable geometry and duplicate prevention; SVG matches the canvas. One Undo/Redo restores
both compound positions and generated arrows. A too-small gap refuses the whole operation.

Arrangement refinements: with five fused-ring compounds, verify curves extend into empty corners
of their molecule frames while keeping visible bonds and long labels clear. Check Grid — Centered
puts the bottom two compounds symmetrically below the top three; Grid — Left and Grid — Right
align that row's visible edge to the full rows. Repeat with different sizes, seven compounds, groups
and captions. The flyout has seven distinct icons, depicting a circle, an oval, each grid alignment,
a horizontal row, and a vertical column. Reapplying any grid alignment is stable and switching
alignment updates its arrows once. Check native flyouts and one Undo/Redo on both platforms.

### Following arrangement arrows and reaction conditions (unreleased)

On both macOS and Windows, arrange five or six differently sized compounds in each layout. Drag one
compound, drag an entire cycle, rotate/resize a compound, and move a group with its caption. Verify
live arrow clearance, exact ellipse translation, retained stroke/head styling, and a single Undo/Redo
for each gesture. Move endpoints together then apart: an impossible shaft hides and restores.
Right-click a generated or manually drawn art arrow > Reaction conditions…, enter three lines,
choose both label sides, cancel, clear, and reopen. Drag a label, move its arrow/compound, and verify
its chosen offset follows. Double-click the label to edit and change font size; the text reflows.
Insert degree, delta, plus/minus and micro symbols at the caret and over a selected range. Select
formula digits for subscript and charges for superscript; reset to Normal and try script typing.
Verify the formatted preview, Cancel, Save, Undo/Redo, dialog reopening and exported formulas without
extra spaces. Place all five three-line labels inside a mixed-size cycle: check midpoint centering,
nearby collision adjustments and that a label that cannot fit stays inside instead of jumping across it.
Check Tab focus trapping, Escape cancellation, and that typing/clipboard shortcuts in the dialog
cannot affect the canvas. Save/reopen the native document and export SVG/PNG/PDF. Repeat arrangement
with Select All; verify no duplicate arrows or labels. Delete an endpoint/arrow or change layouts;
verify removed connections leave authored labels as free text, with Undo restoring attachments.

Arrange a tert-butyl-substituted ring with differently sized fused rings in Circle/Oval/Row/Column/
Grid. Check ring centers line up with the cycle or row while all substituents and labels stay clear.
Rotate a compound and repeat. Check the raised condition subscripts match between canvas, dialog
preview, native reopen and SVG/PNG/PDF exports.
Right-click the main arrow and attach both offshoot sides, including while Select All is active.
Check the new fork starts tangent to the main shaft. Select it and drag the join handle along
straight and curved parents, including near the ends and through several live previews. Check
the contact stays on the shaft, the branch rotates with the local tangent, and the saved fraction
survives parent edits, native reopening and one-step Undo/Redo. Older files without a contact
fraction retain their midpoint join and saved shape, and can be slid with the same handle.
Repeat one side (no duplicate), edit branch heads/bends/strokes, attach catalyst text, move/rotate the
parent and drag a compound in the cycle. Check live tail attachment and condition following. Undo/
Redo each operation, save/reopen, reorder layers and delete the parent. Authored labels survive
orphan removal; a hidden parent shaft hides/restores branches. Near page edges, check shortened or
refused creation and adjust heads manually if a later parent move sends them outside the page.

Arrange five compounds as Oval, add conditions on an arrow replaced by Grid, then Select All and
switch to Grid. Repeat Grid and switch through Row/Oval/Grid: there must still be five arrangement
items, with four grid/row connectors. Detached condition text must persist without becoming an
item or converting to an atom. Check one-step Undo/Redo. Reopen an older faulty native drawing,
reapply Grid, and verify condition-derived connectors are removed and the text remains editable.

On native macOS and Windows, draw a wavy art line and right-click > Adjust waviness….
Slide from Spiky through intermediate positions to Smooth and check the preview. Cancel/Escape
must discard both shape and Amplitude edits. Check Flat (zero height), intermediate heights and Tall,
including changing height on an older line without moving its shape slider. Peaks must stay
visible/selectable after saving and endpoint edits, with the shaft endpoints and rotation center fixed.

Select a mixed-size circle, oval, row and grid. Open Adjust spacing from the arrangement flyout
and selection context menu. Preview tighter spacing: molecule/bond/font sizes stay fixed, circle/oval
arcs remain curved, and conditions/offshoots follow. Cancel/Escape changes nothing; Save has one
Undo/Redo step. Check clearance/page limits and native save/reopen on macOS and Windows. On diagonal
curves, default conditions sit perpendicular to the visible shaft midpoint, on the requested side;
manual label offsets remain intact.
Adjust Frequency independently and together with the other controls. Count complete waves in the
preview and drawing at low/high settings, and check height/endpoints stay fixed. Verify the explicit
count survives native reopening and endpoint edits, and all three controls cancel/Undo/Redo together.
Save must be one Undo/Redo step, preserve the clicked object's endpoints/paint/selection,
and leave other selected objects untouched. Check keyboard slider
adjustment and Tab focus containment. Reopen an adjusted native file, resize/rotate the wave,
add an arrowhead, and compare canvas with SVG/PNG/PDF exports. Include click-placed, vertical,
diagonal and very short waves. Old wavy lines should keep their existing shape until adjusted.
