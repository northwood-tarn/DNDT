# Trench Ramp Test 01 Layered Map Package

This package supports a layered generation process.

## Files

- `trench_ramp_test_01.base_terrain_control.png`: control image for the base terrain only. Purple cells are reserved placed-item footprints.
- `trench_ramp_test_01.altitude_control.png`: altitude and height-edge control image.
- `trench_ramp_test_01.base_terrain_prompt.txt`: prompt for the base terrain image. It must not draw placed items.
- `trench_ramp_test_01.placed_items.json`: authoritative placed-item contracts.
- `placed_asset_prompts/`: one prompt per placed asset.
- `trench_ramp_test_01.composition.json`: deterministic compositing metadata.
- `trench_ramp_test_01.grid.json`: runtime grid, collision, cover, altitude, marker, and spawn metadata.

## Production Sequence

1. Generate or paint `trench_ramp_test_01.base_terrain.png` from `trench_ramp_test_01.base_terrain_prompt.txt`.
2. Generate each placed asset from its prompt in `placed_asset_prompts/`.
3. Save placed assets to `placed_assets/` using the filenames in `trench_ramp_test_01.composition.json`.
4. For each placed asset, record source-image `localAnchorPixel` and `localFootprintBounds` in the asset source map. Do not use cropped-image bottom-center as a placement guess.
5. Composite the base terrain and placed assets using `trench_ramp_test_01.composition.json`.
6. Validate the composite against `trench_ramp_test_01.grid.json`.

## Key Rule

Exact tactical objects are not drawn by the base terrain generator. Trees, cover, lamps, NPCs, and similar items are separate placed assets with authored footprints.
