# Adjustable art wavy lines (unreleased branch)

Right-click an art wavy line and choose **Adjust waviness…**. The registered
`art.adjustWaviness` command opens a modal with a **Spiky → Smooth** range slider and
a live SVG preview of the selected line, using the shared native art renderer. An independent
**Amplitude** slider runs from Flat to Tall (0..40 document pixels, in 0.1-pixel steps).
The preview uses a fixed frame so increasing height stays visually apparent.
An independent **Frequency** slider sets the number of complete waves along the shaft,
with Fewer → More labels and an explicit wave count. It normally spans 1..100; longer
existing lines whose automatic count exceeds 100 retain their larger range, up to 512.
An explicit count stays constant after endpoint edits; absent counts keep automatic spacing.
The slider rounds the zigzag peaks progressively without changing the endpoints,
peak amplitude or wave count. New custom waves use an integer cycle count so both
ends finish on the baseline. It is an art-line feature; molecule bond stereochemistry
is unchanged. Only the right-clicked line changes, including under Select All.

Save writes optional native `GraphicObjectData.waveSmoothness` in the range 0..1,
`waveAmplitudePx` in 0..40, and integer `waveCycles` in 1..512, as one labelled undo step
for all settings. Cancel/Escape makes no document change. Saving without
moving any slider is also a no-op. All values survive native reopening and endpoint
edits. Existing wavy lines retain their previous geometry until adjusted.

The canonical art path generator fillets triangle-wave peaks with tangent quadratic
curves, increasing the adjacent slope just enough to preserve amplitude as rounding
expands. Renderer, arrowhead sampling, hit testing and publication SVG export share
this path. Click-placed frame waves and drawn endpoint waves retain their respective
default amplitude rules until a height is stored. Taller-wave frames expand around the same
rotation/projection center to enclose peaks without moving shaft endpoints. Endpoint editing
also includes the stored height in its bounds. Amplitude can be changed independently on an
older wave without replacing its existing shape generator. Changing frequency on an older wave
uses the adjustable generator with its current default sharp/rounded shape. No dependency or platform-specific code was added.

The modal focuses the slider, supports keyboard range adjustment, traps Tab between
its controls, and prevents editing shortcuts from reaching the drawing while it is
open. Its preview remains local to the modal until Save.

Focused geometry, native save/export, command routing and real context-menu/slider/
Cancel/Undo/Redo DOM tests cover the change. Native macOS and Windows builds and
hands-on checks remain unverified; both must pass before release.
