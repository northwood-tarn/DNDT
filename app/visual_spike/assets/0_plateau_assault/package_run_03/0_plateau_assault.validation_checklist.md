# 0 Plateau Assault Validation Checklist

Use this after every generated art attempt. The art is rejected unless every item below passes.

## Exact Placement

- [ ] The final art was produced by editing/repainting `0_plateau_assault.placement_control.png`, not by free-composing a new map.
- [ ] Every placement-control region silhouette is still recognizably identical in position, size, and shape.
- [ ] Black blocked/cliff regions retain their exact silhouettes and do not become floor.
- [ ] Green slope regions retain their exact silhouettes and remain the only routes onto changed altitude.
- [ ] Yellow cover regions retain their exact silhouettes and contain the only cover-like objects.
- [ ] Orange feature regions retain their exact silhouettes and contain the only feature/light object footprint.
- [ ] Every feature footprint matches `0_plateau_assault.grid.json`.
- [ ] Every cover object matches `0_plateau_assault.grid.json`.
- [ ] Every slope/ramp follows R cells only.
- [ ] The central blocked/cliff cells are not walkable-looking.
- [ ] No unlisted cover-like or blocker-like props were added.
- [ ] No unlisted stairs, ladders, ramps, bridges, or paths were added.
- [ ] Light sources exist only where the grid allows them.
- [ ] Spawns are visually open enough for medium actors but no spawn markers or actors are drawn.

## Altitude

- [ ] Low ground, slopes, cliff face, and upper plateau are visually distinct.
- [ ] The +4 plateau reads as higher than the left-side low ground.
- [ ] The +4 plateau has real vertical treatment: cliff faces, occlusion, cast shadow, and coherent ledges.
- [ ] Slopes read as continuous inclined terrain, not flat color regions.
- [ ] The plateau is reachable only through the marked slope routes.
- [ ] Height is readable without labels.

## Style

- [ ] Dark fantasy underground tone.
- [ ] DNDT negative-ink/painterly direction is present.
- [ ] The image does not look like a textured control grid.
- [ ] Repeated diamond-cell tiling is not visible as the primary landscape structure.
- [ ] Same-terrain neighboring cells merge into coherent terrain masses unless the grid explicitly marks a boundary.
- [ ] Detail is restrained enough not to create false tactical affordances.
- [ ] No text, UI, grid labels, tokens, actors, bases, or permanent grid lines.

## Outcome

- [ ] Accepted for art validation overlay.
- [ ] Rejected for grid drift.
- [ ] Rejected for flat/no altitude read.
- [ ] Rejected for visible textured-grid artifact.
- [ ] Rejected for misleading extra content.
- [ ] Rejected for style mismatch.
