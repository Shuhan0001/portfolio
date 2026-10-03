# David sculpture

Source: **Statue of David**, by **meriam.hedhili** (2017).
https://zenodo.org/records/10383577
Original model: `42e50725f9284798a6924a975cee1ef8.glb`, from Objaverse / Sketchfab.
License: Creative Commons Attribution 4.0 International.
https://creativecommons.org/licenses/by/4.0/

Changes: cropped to the head and short neck, removed a crown scan artifact,
shoulders, chest, plinth and original coloring; normalized and quantized the
geometry; cut seven horizontal pieces; added closed black cross sections with
original code artwork; added an opaque four-tone monochrome halftone shader
with coarse dots, sparse pixel dropouts and fixed scan interruptions. Scroll rotates the head,
opens the horizontal sections, then brings the sculpture toward the lens as
the camera passes forward through the gap below the central slice. During the
passage, a scroll-driven lens widens and adds gentle barrel distortion, then
returns to its original projection before the next chapter. The hero pairs the
sculpture with oversized typography; its material has no timed flashes.
The hero places the solid first name behind the sculpture and the outlined
surname in front, with directional halftone lighting and a soft cast shadow.
At rest, the head slowly floats and turns.
Mouse or hovering pen input smoothly directs the head's gaze relative to its
screen position, replacing the idle turn while preserving the float. Leaving
the window restores the idle pose; touch scrolling does not steer the head.
This motion blends out as scrolling takes over, pauses offscreen and in
background tabs, and is disabled by the reduced-motion preference.

The model is self-hosted in `model.js` as gzip-compressed mesh data.
The Logic & Form study reuses the full model as one large, connected sculpture.
Its middle sections (4, 3, 2, ordered from top to bottom) align with the
Core Engines, Interactive and Praxis labels at right, with fine leader lines
tracking the corresponding sections of the sculpture at left. Selecting a layer
slides it gently outward with a small forward tilt while the head keeps its
scale and position. The associated tool list unfolds beneath the right-hand
label, or below the sculpture on narrow screens; closing returns the layer. The
renderer captures the existing model data before the hero releases it, so both
also work from a local HTML file. No changes were made to the source scan or
hero pose.

The runtime
uses the browser's DecompressionStream API. The canvas appears after its first
render; no 2D placeholder is shown while loading or if 3D is unavailable. Rebuild with:

    node tools/build_david.cjs path/to/source.glb

Three.js r160.1: Copyright 2010–2023 Three.js Authors, MIT license.
https://github.com/mrdoob/three.js/blob/r160/LICENSE
