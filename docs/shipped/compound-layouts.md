# Compound layouts

Focused layout-only slice developed from current main. **Compound layout tools** is an off-by-default
user preference in Settings/Preferences, stored using the existing localStorage policy and synced
through DOM/Tauri events (plus browser storage events). It is not document metadata.

When disabled, layout toolbar buttons, flyout/context items and customization entries are hidden.
Registered layout commands refuse with a message explaining which setting enables them. When
enabled, Circle, Oval, Grid left/center/right, Row and Column translate the selection using visible
bounds and ring-system anchors. Circle/oval preserve clockwise spatial order; grid reads by row,
and incomplete rows use the selected justification. Default edge clearance is 48 document pixels.
No generated arrows, reaction annotations or wavy-line settings are included.

Groups and anchored marks move together; selecting a group with its descendants cannot move them
twice. Unselected objects/pages stay unchanged. Molecule dimensions, styles, SMILES, stereochemistry,
atom/bond counts and all internal coordinates relative to one another remain unchanged.
Layouts refuse page overflow rather than shrinking molecules; each action is one named Undo step
and keeps the compounds selected. Native save/reopen persists the resulting positions.

**Adjust spacing…** in the toolbar flyout or selection context menu’s **Arrange ›** submenu opens a local preview at the selected
page index, including page two. Smaller percentages bring item anchors closer about their centroid
while retaining original object dimensions; larger percentages spread them. The slider stops at
selected-item clearance and page bounds. Cancel/Escape leaves the drawing untouched; Save commits
one Undo step. Disabling the preference closes the dialog and native popovers.

Limitations: this is a spatial layout, not a chemistry/reaction-order inference. Unselected objects
are not obstacles. Layouts are translation-only; existing object rotation is preserved. Users should
group captions with compounds before arranging. Very dense or large drawings may require a different
layout or a larger page. macOS/Windows native verification is recorded separately in the PR.
