# Mini Base Raster Assets

This folder is for authored PNG base assets only. Do not add SVG, generated
DOM shapes, canvas-drawn stand-ins, or procedural texture layers here.

`material_base_sample_sheet.png` and `material_base_matrix_v1.png` are material
target references. They show the level of worn metal, depth, bevel, and
miniature-plinth realism the production bases should aim for.

The PC selector expects one PNG per valid pairing:

```text
base_disc-{disc-metal}_rim-{rim-metal}.png
```

The current metal IDs are defined in `../../base_asset_manifest.js`.
Disc and rim are the only player-facing base choices.

`betrayers_coin_reference.png` records the approved odd-one-out unique base
direction. Its final production asset is `betrayers_coin.png`.

Character creation defaults to `betrayers_coin.png`. The player should be able
to untick that unique-base choice and then build a normal base from the authored
disc/rim PNG combinations.

The current production export contains:

- 81 normal transparent PNG assets, one for every disc/rim metal pairing.
- 1 unique transparent PNG asset, `betrayers_coin.png`.
- `base_asset_metadata.json`, which records the shared `192x128` canvas and
  `96,106` base-center anchor.
- `exported_base_grid_preview.png`, a preview contact sheet assembled from the
  actual exported transparent PNGs.
- `source_rows/`, the row-by-row chroma-key sources used to cut the assets.

These are raster assets only. Do not replace them with SVG or browser-drawn
base geometry.
