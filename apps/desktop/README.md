# ChemDraft Desktop

Tauri v2, Vite, React, and TypeScript desktop shell for ChemDraft.

`pnpm dev` launches the Tauri desktop app. `pnpm dev:web` remains available as a secondary browser preview for React shell work.

This shell is intentionally compact and document-centered: native app menu, dense quick-action toolbar, page workspace, native floating icon-first palette, hidden-by-default utility panels, and status bar. It now includes a narrow lazy Ketcher host for active selected-molecule editing, but it does not include native file dialogs, native clipboard handling, full RDKit, CDXML/CDX, or MolScribe OCSR inference yet.

Packaged macOS builds also start Sparkle 2. Automatic checks offer signed app updates through
Sparkle's native UI, and File > Check for Updates… forces a visible check. The updater replaces the
app bundle only; installed plugin packages stay in Application Support. See
`../../docs/releasing/macos-updates.md` for the signing, appcast, and end-to-end verification flow.

The desktop palette is a separate Tauri window behind `src/window-manager`. Palette buttons route command IDs back to the main document window, where the existing command registry invokes them. `pnpm dev:web` keeps an in-window docked palette only as a browser-preview fallback.

On the unreleased auto-arrangement branch, generated arrows follow moved compound/group endpoints.
Right-click an art arrow > Reaction conditions… to attach editable multiline text; labels follow
arrows and retain manually dragged offsets. The editor includes common symbols, native subscript/
superscript and a formatted preview. Label placement centers on the arrow and makes bounded
collision adjustments on the chosen side. See `../../docs/shipped/selection-arrangement.md` for
behavior, metadata, and native verification requirements. Compound placement aligns ring-system
centers while reserving full substituent/label clearance.
Use **Adjust spacing…** in the arrangement flyout, or right-click a multi-compound selection and
choose **Adjust arrangement spacing…**, to move compounds closer without changing molecule sizes.
The slider previews locally; Save makes one undo step. Connecting arrows, offshoots and conditions
follow. Default conditions now center perpendicular to the visible arrow midpoint, including curves.
Condition labels remain excluded from arrangement inputs after their arrow is removed or replaced.
Reapplying a layout repairs older drawings whose detached conditions became arrangement items.
Right-click > Attach offshoot — top/outside or bottom/inside creates a compact tangent fork,
with optional conditions on the branch.
Drag the small start handle at the join to slide its contact along the parent shaft; the saved
contact fraction follows parent edits. Existing offshoots keep their saved shape and gain this handle.

Right-click an art wavy line > Adjust waviness… for a Spiky → Smooth slider with a live preview.
The same dialog has independent Amplitude (Flat → Tall) and Frequency (Fewer → More) sliders;
all controls save together. Frequency shows the number of complete waves along the shaft.
Save applies one undoable change; Cancel leaves the drawing untouched. The saved shape survives
endpoint edits and native reopening. See `../../docs/shipped/wavy-line-smoothness.md`.
