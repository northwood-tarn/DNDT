# 0 Plateau Assault Validation Checklist

Use this after every generated art attempt. The art is rejected unless every item below passes.

## Exact Placement

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
- [ ] The plateau is reachable only through the marked slope routes.
- [ ] Height is readable without labels.

## Style

- [ ] Dark fantasy underground tone.
- [ ] DNDT negative-ink/painterly direction is present.
- [ ] Detail is restrained enough not to create false tactical affordances.
- [ ] No text, UI, grid labels, tokens, actors, bases, or permanent grid lines.

## Outcome

- [ ] Accepted for art validation overlay.
- [ ] Rejected for grid drift.
- [ ] Rejected for misleading extra content.
- [ ] Rejected for style mismatch.
