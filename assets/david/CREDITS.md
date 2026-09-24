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
opens the horizontal sections, then releases the pieces. The hero pairs the
sculpture with oversized typography; its material has no timed flashes.
The hero places the solid first name behind the sculpture and the outlined
surname in front, with directional halftone lighting and a soft cast shadow.
At rest, the head slowly floats and turns.
Mouse or hovering pen input smoothly directs the head's gaze relative to its
screen position, replacing the idle turn while preserving the float. Leaving
the window restores the idle pose; touch scrolling does not steer the head.
This motion blends out as scrolling takes over, pauses offscreen and in
background tabs, and is disabled by the reduced-motion preference.

The model is self-hosted in `model.js` as gzip-compressed mesh data. The runtime
uses the browser's DecompressionStream API and retains the original SVG artwork
as a fallback if WebGL or decompression is unavailable. Rebuild with:

    node tools/build_david.cjs path/to/source.glb

Three.js r160.1: Copyright 2010–2023 Three.js Authors, MIT license.
https://github.com/mrdoob/three.js/blob/r160/LICENSE
