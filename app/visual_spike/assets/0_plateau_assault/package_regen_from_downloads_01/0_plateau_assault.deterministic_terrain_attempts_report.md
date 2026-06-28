# 0 Plateau Assault - Deterministic Terrain Attempts

Source package:

- `0_plateau_assault.grid.json`
- `0_plateau_assault.grid-sketch.source.json`
- `0_plateau_assault.sketch.source.txt`

Renderer:

- `tools/render-grid-terrain.py`

## Attempt 01

Output:

- `0_plateau_assault.deterministic_terrain_attempt_01.png`
- `0_plateau_assault.deterministic_terrain_attempt_01_validation_overlay.svg`

Result:

- Geometry conforms because every terrain surface is derived from `grid.json`.
- The visible cell borders are too strong.
- The image reads as a board with individual cells, not an organic battlefield.

## Attempt 02

Output:

- `0_plateau_assault.deterministic_terrain_attempt_02.png`
- `0_plateau_assault.deterministic_terrain_attempt_02_validation_overlay.png`

Changes:

- Removed ordinary cell outlines from the clean render.
- Kept only slope and height/void boundary cues.
- Added mass-level procedural washes clipped to terrain masks.

Result:

- Geometry conformity: pass.
- Blocked/void regions: pass.
- Ramp regions: pass.
- Reserved cover/tree footprints: pass as metadata-aligned empty terrain.
- Organic dark-fantasy believability: not yet passing.

## Current Diagnosis

This branch resolves the primary failure from whole-image generation: the base terrain no longer invents a different battlefield.

The remaining problem is visual quality. The renderer currently produces a compliant tactical terrain plate, but it still reads too much like procedural board geometry. The next alternative should keep deterministic grid masks but replace per-cell visual construction with larger region-level surfaces:

- build connected walkable regions from grid cells
- draw each connected region as one mask
- apply texture and lighting across the whole region, not per cell
- add chipped/irregular edge dressing only inside or immediately along the authored mask boundary
- keep height/void edges exact
- optionally use AI only for mask-clipped material patches, never for terrain layout

## Next Best Experiment

Prototype a region-level terrain renderer:

`grid.json -> connected region masks -> region texture/wash -> exact cliff/ramp edges -> validation overlay`

This should preserve the grid while reducing the visible tiled-board effect.

## Attempt 03

Output:

- `0_plateau_assault.deterministic_terrain_attempt_03.png`
- `0_plateau_assault.deterministic_terrain_attempt_03_validation_overlay.svg`

Changes:

- Replaced per-cell base fills with connected region masks.
- Filled each connected region as a continuous material pass.
- Kept authored grid diamonds as clipping geometry rather than as visible construction units.

Result:

- Geometry conformity: pass.
- Visual quality: fail.
- Reason: the cell-by-cell surface texture improved, but the authored diamond-union silhouette and straight cliff faces still dominate. It reads as a floating tactical board rather than a dark-fantasy place.

## Attempt 04

Output:

- `0_plateau_assault.deterministic_terrain_attempt_04.png`
- `0_plateau_assault.deterministic_terrain_attempt_04_validation_overlay.svg`

Changes:

- Added organic rim debris, cross-region scars, and void fog over exact terrain masks.
- Reduced visible height-edge line strength.
- Kept the same metadata-driven terrain authority.

Result:

- Geometry conformity: pass.
- Visual quality: fail.
- Reason: dressing over exact diamond-union landforms is not enough. The map still reads as a constructed board because the high-level landform is a visible union of isometric cells.

## Current Finding

The deterministic renderer proves that grid conformity is solvable, but it does not yet solve the visual problem. The current branch is useful as a validation/control renderer, not as final art.

The source of the dead end is too much emphasis on preserving exact visible silhouettes. Exactness belongs to metadata, collision, anchors, validation overlays, and tactical masks. The clean art needs permission to hide the construction: continuous landforms, overhangs, fog, shadow, chipped borders, and material strokes can cross mask boundaries when they do not create false floor, cover, blockers, ramps, or interactables.

The next serious branch should be one of:

- mask-locked compositing with authored organic terrain stamps
- AI-generated material/landform patches clipped and validated by deterministic masks
- hybrid paint-over where the clean art hides the diamond-union silhouette while the validation overlay remains exact

Do not spend more time merely improving procedural noise on the exact diamond union. That has now failed twice.

## Stamped Material Branch

Renderer:

- `tools/render-grid-terrain-stamped.py`

Intent:

- Use the grid only as exact tactical masks.
- Use existing DNDT negative-ink style plates as material sources.
- Clip the resulting terrain to exact walkable, high-ground, slope, and cliff masks.
- Keep validation deterministic.

### Attempt 05

Output:

- `0_plateau_assault.stamped_terrain_attempt_05.png`
- `0_plateau_assault.stamped_terrain_attempt_05_validation_overlay.svg`

Style source:

- `app/docs/style_refs/full_size_drafts/05_act3_backlands_mountain_root_path.png`

Result:

- Geometry conformity: pass.
- Visual quality: fail.
- Reason: the reference image's composed path/landmarks survive inside the tactical mask. It reads as unrelated concept art pasted into grid-shaped holes.

### Attempt 06

Output:

- `0_plateau_assault.stamped_terrain_attempt_06.png`
- `0_plateau_assault.stamped_terrain_attempt_06_validation_overlay.svg`

Style source:

- `app/visual_spike/assets/escarpment_cliff_negative_ink_v2_1920x1080.png`

Result:

- Geometry conformity: pass.
- Visual quality: fail.
- Reason: the source composition still survives as a ghost image. Whole finished concept plates cannot be directly stamped into tactical masks.

### Attempt 07

Output:

- `0_plateau_assault.stamped_terrain_attempt_07.png`
- `0_plateau_assault.stamped_terrain_attempt_07_validation_overlay.svg`

Changes:

- Extracted small randomized material patches from the escarpment reference instead of placing the full image.
- Built a style-texture mosaic, then clipped it to the same deterministic tactical masks.

Result:

- Geometry conformity: pass.
- Visual quality: fail.
- Reason: the ghost composition is gone, but the output becomes a pasted-material collage. It still exposes the tactical silhouette and does not form a believable place.

## Updated Finding

The stamp branch shows that style transfer by clipping existing finished concept art is not enough. Finished scene plates contain composition, landmarks, lighting hierarchy, and perspective cues that conflict with the authored combat layout. Random patch extraction removes the landmarks but also destroys authored place design.

The next viable version of this branch would need purpose-made terrain stamps, not harvested scene images:

- seamless negative-ink floor material patches
- cliff-face strips designed for isometric ledges
- slope/ramp strips designed for 128 x 64 isometric grid connectors
- rim debris/overhang strips that can cross tactical mask edges without reading as floor

If those stamps are generated, painted, or curated as reusable assets, deterministic composition can place them against the grid. Without them, the renderer can preserve rules but cannot invent a compelling dark-fantasy place.

## Purpose-Made AI Stamp Branch

Renderer:

- `tools/render-grid-terrain-from-stamps.py`

Intent:

- Keep `grid.json` as the source of terrain truth.
- Use generated source stamps rather than finished concept plates.
- Compose terrain deterministically against exact low, mid, high, slope, cliff, rim, and void masks.
- Judge whether better source material is enough to stop the result reading as a tactical slab.

### Attempt 08

Output:

- `0_plateau_assault.stamp_composed_terrain_attempt_08.png`
- `0_plateau_assault.stamp_composed_terrain_attempt_08_validation_overlay.svg`

Result:

- Geometry conformity: pass.
- Visual quality: fail.
- Reason: the compositor preserves the authored masks, but the material still reads as tiled board geometry rather than an organic site.

### Attempt 09

Output:

- `0_plateau_assault.stamp_composed_terrain_attempt_09.png`
- `0_plateau_assault.stamp_composed_terrain_attempt_09_validation_overlay.svg`

Result:

- Geometry conformity: pass.
- Visual quality: fail.
- Reason: the small purpose-made stamps reduce the unrelated-scene problem from attempts 05-07, but the repeated patch structure is visible and the final image remains a floating constructed slab.

### Attempt 10

Output:

- `0_plateau_assault.stamp_composed_terrain_attempt_10.png`
- `0_plateau_assault.stamp_composed_terrain_attempt_10_validation_overlay.svg`

Source:

- `terrain_stamp_sheet_ai_01.png`
- `terrain_stamp_library_ai_01/`

Result:

- Geometry conformity: pass.
- False affordances: mostly pass.
- Visual quality: fail.
- Repeatability: pass for the same grid and stamp library.
- Reason: the AI stamp atlas gives substantially better cracked stone, cliff, rim, and void material than attempts 08-09. It still exposes the diamond-union top surfaces and straight slab cliffs. The image is darker and richer, but it is still a textured tactical board, not an organic DNDT place.

### Attempt 11

Output:

- `0_plateau_assault.landform_module_terrain_attempt_11.png`
- `0_plateau_assault.landform_module_terrain_attempt_11_validation_overlay.svg`

Source:

- `terrain_landform_module_sheet_ai_01.png`
- `terrain_landform_module_library_ai_01/`

Changes:

- Generated a new 3 x 2 atlas of larger dark-fantasy landform modules.
- Extracted it with `tools/extract-terrain-stamp-sheet.py`.
- Reused the deterministic stamp compositor against the authored grid masks.

Result:

- Geometry conformity: pass.
- Organic place read: improved but not passing.
- False affordances: fail.
- Repeatability: partial. The deterministic composition is repeatable, but the source module quality is not yet controllable enough.
- Reason: this is the strongest-looking artifact so far, but the larger generated modules import their own local terrain logic. Internal ledges, raised blocks, rubble clusters, cliff breaks, and slope-like cracks appear inside authored floor masks. Those marks look like cover, blockers, ramps, or altitude changes that do not exist in `grid.json`. The map is more atmospheric than attempt 10, but it violates tactical readability.

## Current Decision

The viable technical skeleton is now clear:

- authored grid and placement metadata remain exact
- deterministic masks preserve movement, range, cover, blockers, slopes, and altitude
- validation overlays can prove alignment
- purpose-made terrain source art is better than finished scene plates

The blocker is also clear:

- generic AI terrain images are not reliable terrain stamps
- small stamps are tactically safe but read as board texture
- larger landform modules read better but introduce false affordances

This branch should not continue as prompt-only iteration. The next credible production path is human-authored or tightly art-directed stamp/module authoring over deterministic masks:

- floor materials must be mostly non-affordance texture
- cliff/rim/overhang modules must be authored for mask boundaries only
- ramps must be the only modules allowed to look like traversable slopes
- any large organic overpaint must be reviewed against the validation overlay for false floor, fake cover, fake blocker, or fake ramp cues

Conclusion: grid-locked deterministic composition is viable as a pipeline scaffold, but not sufficient as an automatic final-map generator with generic AI stamps. Usable final maps likely require authored paintover/stamp authoring on top of the deterministic grid masks.
