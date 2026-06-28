# 0 Plateau Assault Layered Map Package

This package supports a layered generation process.

## Files

- `0_plateau_assault.base_terrain_control.png`: control image for the base terrain only. Purple cells are reserved placed-item footprints.
- `0_plateau_assault.altitude_control.png`: altitude and height-edge control image.
- `0_plateau_assault.base_terrain_prompt.txt`: prompt for the base terrain image. It must not draw placed items.
- `0_plateau_assault.placed_items.json`: authoritative placed-item contracts.
- `placed_asset_prompts/`: one prompt per placed asset.
- `0_plateau_assault.composition.json`: deterministic compositing metadata.
- `0_plateau_assault.grid.json`: runtime grid, collision, cover, altitude, marker, and spawn metadata.

## Production Sequence

1. Generate or paint `0_plateau_assault.base_terrain.png` from `0_plateau_assault.base_terrain_prompt.txt`.
2. Generate each placed asset from its prompt in `placed_asset_prompts/`.
3. Save placed assets to `placed_assets/` using the filenames in `0_plateau_assault.composition.json`.
4. For each placed asset, record source-image `localAnchorPixel` and `localFootprintBounds` in the asset source map. Do not use cropped-image bottom-center as a placement guess.
5. Composite the base terrain and placed assets using `0_plateau_assault.composition.json`.
6. Validate the composite against `0_plateau_assault.grid.json`.

## Key Rule

Exact tactical objects are not drawn by the base terrain generator. Trees, cover, lamps, NPCs, and similar items are separate placed assets with authored footprints.

Control images are source geometry, not loose planning references. The base terrain may be painterly, but authored terrain masks, slope masks, blocked regions, and reserved footprints must not drift.

Placed assets require explicit registration: final-map `anchorPixel`, source-image `localAnchorPixel`, and source-image `localFootprintBounds`. The compositor must not infer placement from a cropped bitmap's bottom-center.
