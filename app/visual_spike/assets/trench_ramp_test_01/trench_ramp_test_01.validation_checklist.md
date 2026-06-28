# Trench Ramp Test 01 Validation Checklist

Use this after every layered map attempt. The composite is rejected unless every relevant item below passes.

## Base Terrain

- [ ] The base terrain was generated from `trench_ramp_test_01.base_terrain_prompt.txt`.
- [ ] The base terrain contains no placed items from `trench_ramp_test_01.placed_items.json`.
- [ ] Reserved placed-item footprints remain visually open for later compositing.
- [ ] Black blocked/cliff regions retain their exact silhouettes and do not become floor.
- [ ] Green slope regions retain their exact silhouettes and remain the only routes onto changed altitude.
- [ ] Every slope/ramp follows R cells only.
- [ ] The central blocked/cliff cells are not walkable-looking.
- [ ] No unlisted cover-like, blocker-like, light-like, or interactable props were added to the base terrain.
- [ ] No unlisted stairs, ladders, ramps, bridges, or paths were added.

## Placed Assets

- [ ] Every placed item in `trench_ramp_test_01.placed_items.json` has a generated asset or an explicit reuse decision.
- [ ] Every placed asset has explicit source-image `localAnchorPixel` and `localFootprintBounds` registration.
- [ ] Every placed asset base/contact footprint fits its listed cells after registration-based scaling.
- [ ] No placed asset includes extra tactical objects or surrounding terrain.
- [ ] Cover objects exist only where `trench_ramp_test_01.placed_items.json` says cover exists.
- [ ] Feature objects exist only where `trench_ramp_test_01.placed_items.json` says features exist.
- [ ] Light sources exist only where `trench_ramp_test_01.placed_items.json` or `trench_ramp_test_01.grid.json` allows them.
- [ ] NPC/neutral actor assets exist only where authored.

## Composite

- [ ] The composite was assembled from `trench_ramp_test_01.composition.json`.
- [ ] Placed assets use the listed final-map anchor pixels, source-image local anchors, registered footprint bounds, and z order.
- [ ] Every visible tactical object matches `trench_ramp_test_01.grid.json` and `trench_ramp_test_01.placed_items.json`.
- [ ] No visible object creates false cover, blockers, climb routes, light sources, or interactions.
- [ ] Spawns are visually open enough for medium actors but no spawn markers or actors are drawn.

## Altitude

- [ ] Low ground, slopes, cliff face, and upper plateau are visually distinct.
- [ ] The +4 plateau reads as higher than the left-side low ground.
- [ ] The plateau is reachable only through the marked slope routes.
- [ ] Height is readable without labels.

## Style

- [ ] Dark fantasy underground tone.
- [ ] DNDT negative-ink/painterly direction is present.
- [ ] Detail is restrained enough not to create false tactical affordances.
- [ ] No text, UI, grid labels, tokens, actors, bases, or permanent grid lines.

## Outcome

- [ ] Accepted as layered composite candidate.
- [ ] Rejected for base terrain/grid drift.
- [ ] Rejected for placed asset drift.
- [ ] Rejected for misleading extra content in base terrain or assets.
- [ ] Rejected for style mismatch.
