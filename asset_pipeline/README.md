# Metric-consistent asset pipeline

This directory treats environment art as a reproducible build product. Scene JSON is the authority for geometry; generated images are outputs and must never feed structural changes back into a scene.

## Coordinate and camera contract

- One scene unit is one metre.
- `x` runs west to east, `y` south to north, and `z` floor to ceiling.
- Room origin is the south-west floor corner.
- Prop positions are the centre of their floor footprint.
- Door `position` is the opening centre measured from the wall's west or south endpoint.
- Structural dimensions come from `catalog/metrics.json`; a scene may choose a catalog type but may not resize it.
- Cameras use the canonical height, FOV, roll, and pitch in `catalog/metrics.json`. A room supplies only a wall-facing direction; distance is calculated by the planner.

## Commands

```sh
npm run assets:validate
npm run assets:plan
npm run assets:test
```

`assets:plan` validates source data and writes deterministic build plans and provenance metadata under `asset_pipeline/build/`. These generated files are intentionally ignored.

To render with Blender 4.x:

```sh
blender --background --python asset_pipeline/blender/scene_builder.py -- \
  --plan asset_pipeline/build/guard_room/plan.json \
  --output asset_pipeline/build/guard_room/passes
```

The Blender stage emits beauty, depth, normal, ambient-occlusion, and object-index segmentation PNGs. It constructs only primitive proxy geometry; production prop meshes can later replace proxies if their catalog dimensions and origins remain exact.

The AI styling stage is deliberately downstream. `comfy/metric_room_workflow.contract.json` records the required inputs and immutable geometry controls. A concrete ComfyUI workflow must pin model hashes, ControlNet versions, sampler settings, and seed before it is accepted as reproducible.

## Build boundary

Structure fields (`dimensions`, openings, structural props, collision, navigation, camera) are deterministic. Style fields may affect materials, surface wear, palette, decals, atmospheric lighting colour, and non-colliding decoration only. A style processor must not transform silhouettes, depth, camera, openings, or structural prop segmentation.
