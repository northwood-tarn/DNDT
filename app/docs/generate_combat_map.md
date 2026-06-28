ok # Generate Combat Map Prompt

Create a D&D tactical combat stage package for a fixed isometric 1920 x 1080 runtime plate.

This prompt covers the whole combat map workflow: grid planning, tactical traversal, detailed tactical art generation, stage metadata, encounter metadata, and final validation. Do not split the work into an art-first pass and a later metadata rescue pass.

## Core Rule

The grid is the tactical truth. The combat art plate is acceptable only if it is visibly authored over the approved grid and collision plan.

Do not generate final art first. Do not invent metadata over an already-generated image. Do not move, scale, warp, rotate, reinterpret, or "fit" the grid to rescue attractive art.

If the art and metadata disagree, the art is wrong until revised. Metadata may change only when the user explicitly approves a new tactical plan.

## Required Inputs

- Stage id: `[stage_id]`
- Encounter premise: `[short description]`
- Visual style parameters: `[style parameters]`
- User notes about terrain, tactical features, elevation, hazards, cover, blockers, landmarks, hero spawn region, enemy spawn region, exits, and transitions

If the user has not supplied one of these categories, make a conservative proposal and label it as a proposal.

## Combat Visibility Contract

Combat maps use one detailed tactical plate: `stage_id.art.png`.

- Do not generate paired dark/lit exploration plates for combat unless the user explicitly requests an experimental variant.
- Combat visibility is justified in-world by the Lanterna danger flare: "As danger approaches, your Lanterna flares to full light."
- Treat this as a magical combat-state illumination, not the ordinary 15 ft exploration Lanterna radius.
- The plate should feel underground, severe, and dark-fantasy, but it must be globally readable enough for tactical play.
- Use authored global readability rather than exploration-style darkness reveal: all playable cells, cover, blockers, hazards, spawn regions, route edges, elevation changes, and major props must be visible in the combat plate.
- Fixed lights, fires, ritual pools, lamps, and local glow sources may shape mood and tactical focus, but they must not be the only reason the battlefield is legible.
- Runtime Lanterna danger flare, line of sight, targeting visibility, and darkness rules may still apply as gameplay overlays, but they must not be required to understand the basic battlefield.
- Do not solve combat readability with cheerful ambience or full-scene fantasy glow. Keep value structure stark, detail restrained, and silhouettes clean.

## Fixed Geometry

- Runtime plate size: exactly 1920 x 1080 pixels.
- Projection: fixed isometric square.
- Tile size: 128 x 64 pixel isometric diamonds.
- Coordinate rule: x increases down-right; y increases down-left.
- Grid origin must be explicit in pixel space.
- Grid size must be exactly one of the invariant combat room sizes:

| Size | Grid target | Use when |
|---|---:|---|
| Cramped | 11 x 8 cells | Tight ambushes, small rooms, chokepoints, confined platforms. |
| Small | 12 x 9 cells | Close fights with limited flanking and few large props. |
| Standard | 14 x 10 cells | Default combat size for ordinary encounters. |
| Large | 16 x 11 cells | Big enemies, set pieces, multi-zone fights, or encounters needing more approach space. |

If the user has not specified a size, ask once. If you must proceed, default conservatively to Standard.

No perspective convergence, camera tilt distortion, curved grid lines, local warping, intermediate room sizes, or custom projection language.

## Required Pipeline

### 0. Draft A Primitive Tactical Sketch

Before final metadata or combat art exists, present a low-stakes tactical layout sketch directly in the response for user review.

This sketch is not concept art. It is an ASCII coordinate grid using the selected combat room size. Leave blocked, dark, wall, void, water, pit, dense prop, or otherwise unavailable cells blank so the meaningful symbols carry more information.

Use this style, sized to the selected room:

```text
Legend:
. terrain: walkable
h terrain: half cover
C terrain: cover
H terrain: hazard
S terrain: stairs
R terrain: slope / ramp
L marker: fixed light
P marker: hero spawn, max 3, ordered PC / NPC 1 / NPC 2
M marker: enemy spawn
T marker: transition
V marker: conversation trigger
N marker: NPC / neutral
1-9 marker: numbered custom feature, defined per map, not walkable
blank = blocked / dark / wall / void

y\x  00 01 02 03 04 05 06 07 08 09 10 11 12 13
00            M  .  .  C
01         C  .  .  .  .
02      P  .  .  L  .  M

Feature definitions:
1 = fallen pillar

Image note:
Optional art direction for the image generator.

Altitude layer:
Height values are 5 ft bands. Adjacent height changes are treated as slope/ramp unless layout terrain marks S stairs or a blocking/non-walkable cell.

y\x  00 01 02 03 04 05 06 07 08 09 10 11 12 13
00    0  0  0  0  0  0  0  0  0  0  0  0  0  0
01    0  0  0  0  0  0  0  1  1  1  0  0  0  0
02    0  0  0  0  0  0  0  1  2  2  1  0  0  0
```

The sketch should show:

- walkable lanes and tactical chokepoints
- blocked walls, pits, voids, dense props, water, or other collision masses as blank space
- cover, hazards, elevation, stairs, and interactables
- stairs and slopes separately: stairs are stepped elevation connectors; slopes/ramps are continuous inclines. Both may be traversable connectors, but they guide different art and animation.
- numbered custom features, with each used number defined ad hoc for the map
- hero and enemy spawn regions
- at most 3 hero spawn cells, always ordered as player character first, chosen NPC 1 second, chosen NPC 2 third
- fixed light sources and their rough color family
- transitions and exits
- conversation triggers that can start combat setup; do not use a separate combat-trigger marker
- any places that are intentionally unreachable

Altitude convention:

- Altitude is exported as its own metadata layer, but it must be authored and reviewed together with layout terrain and markers. Do not treat height as a detached second map.
- Altitude values are 5 ft bands: `0` is ground level, `+1` is +5 ft, `+2` is +10 ft, `-1` is -5 ft, and so on.
- Adjacent cells with different altitude are automatically treated as traversable slope/ramp if both cells are otherwise walkable.
- If adjacent cells have different altitude and one cell is marked `S`, treat that connector as stairs.
- If adjacent cells have different altitude and one side is blank/blocked/non-walkable, treat that edge as a cliff, wall, ledge, or drop.
- `S` stairs are stepped connectors: carved stairs, broken stair bands, rocky footholds, or discrete ledges.
- `R` slopes/ramps are continuous connectors: ramps, scree paths, dirt inclines, or smooth natural rises. Height variation that is not explicitly marked as `S` stairs should be interpreted as `R` slope/ramp.
- Stairs and slopes may resolve similarly for broad movement, but they guide different art, animation, and validation.

Fixed-light sketch convention:

- A single `L` cell indicates one hanging lamp or small fixed light marker.
- Four or more adjacent `L` cells indicate one large blocking light feature.
- Large `L` clusters are not walkable.
- The image note should define large light features when their identity matters, such as "the four Ls in a row show a firebed."
- Lamps are the special case: lamp markers do not automatically make a cell non-walkable; blocked/walkable state must still be represented by the underlying terrain symbol.

Numbered feature convention:

- Numbers `1-9` are custom object/feature footprint cells defined per map, such as `1 = fallen pillar`, `2 = ritual engine`, or `3 = long couch`.
- Numbered feature cells are not walkable.
- Multi-cell numbered features are represented by repeating the same number across every cell in the footprint.

The user should be able to reject or revise this sketch before detailed art generation. Do not use generative art to solve tactical layout uncertainty.

### 1. Plan The Tactical Grid

Before combat art exists, produce:

- `stage_id.grid.json` draft with explicit grid, walkable cells, blocked cells, cover, elevation, stairs, hazards, interactables, transitions, default hero spawns, default enemy spawns, named zones, lighting notes, and validation notes.
- in-response ASCII coordinate tactical sketch
- `stage_id.grid_preview.png` over a blank/neutral 1920 x 1080 plate.
- `stage_id.collision_preview.png` over a blank/neutral 1920 x 1080 plate.

These previews must be generated from the exact same metadata that will drive runtime.

### 2. Generate Or Paint The Combat Art

Only after the planning artifacts exist, create:

- `stage_id.art.png`

The art prompt must use the approved grid and collision guide as source composition. The combat art must not include text, labels, numbers, UI, heroes, enemies, miniatures, tokens, bases, icons, glow rings, map markers, baked player-centered Lanterna circles, baked fog-of-war, or a permanent grid.

### 3. Create The Concrete Validation Artifact

After combat art exists, produce:

- `stage_id.art_validation_overlay.png`

This is mandatory. It must be a composited 1920 x 1080 image using `stage_id.art.png` as the base plate with the exact runtime grid, walkable cells, blocked cells, cover, elevation, stairs, hazards, transitions, default hero spawns, default enemy spawns, and interactables overlaid from `stage_id.grid.json`.

Use clearly distinguishable colors:

- grid lines: thin green or cyan
- walkable: transparent green
- blocked/out-of-bounds: transparent red
- cover: transparent yellow with cover type marker
- difficult/hazard: transparent amber or orange
- elevation/stairs: distinct outlines or color blocks
- spawns: centered team-colored markers
- interactables/transitions: centered markers or outlined cells

Do not create this overlay from a separate hand-drawn guide. It must be generated from the same metadata file that the runtime uses.

### 4. Reject Or Revise

The package fails validation if any of these are true:

- Any visible walkable-looking surface in `stage_id.art.png` is outside walkable, elevation, stair, or transition metadata.
- Any walkable, elevation, stair, spawn, or transition metadata cell visually lands on water, void, wall, rail, pit, cliff, dense prop, locked obstacle, or otherwise non-standable art.
- The grid would need to be moved, scaled, warped, rotated, or reinterpreted to match the art.
- Any normal staircase, stair band, ramp-like stair, or stepped threshold is deeper than one 5 ft grid cell without explicit multi-cell stair metadata.
- A medium actor base would not fit comfortably on an intended walkable cell, stair cell, spawn cell, cover-adjacent cell, or tactical lane.
- Player-centered Lanterna circles, fog-of-war, or targeting visibility are baked into the art instead of represented as runtime metadata.
- The battlefield can only be understood inside small light pools. Combat needs global tactical readability even when the mood remains dark.

If any failure appears in `stage_id.art_validation_overlay.png`, reject the art and revise the art. Do not quietly edit metadata to chase the image.

Only after the validation overlay passes may the status be changed from `draft_grid_validation` to `approved_runtime`.

## Combat Contract

- Build the scene as a tactical battle space first, illustration second.
- Include clear regions for default hero spawns and enemy spawns.
- Hero spawn planning must assume at most 3 hero spawn cells total.
- Hero spawn cells must be walkable, unblocked, separated from enemy defaults, and large enough for medium actor bases.
- Hero spawns are ordered: player character first, chosen NPC 1 second, chosen NPC 2 third.
- Enemy spawn areas must be walkable, unblocked, separated from hero spawns, and large enough for the expected encounter.
- Enemy spawn regions should support at least one melee threat and one ranged or caster position when the layout allows it.
- Include readable blockers, cover, movement lanes, hazards, and tactical landmarks.
- Cover objects must be readable without hiding grid logic.
- Hazards, water, pits, rails, posts, candles, shrine bases, boats, rubble, walls, and other fixed props must be visually unambiguous.
- Avoid clutter that creates false collision or makes a normal walkable cell look blocked.
- Medium humanoid miniatures display around 160 x 267 pixels on this stage; leave enough room for actor bases to fit comfortably on intended walkable cells.

## Stairs And Elevation

- Normal stairs, ramp-like stairs, and stepped thresholds are exactly one 5 ft cell deep from lower landing to upper landing.
- One stair cell is exactly one 128 x 64 diamond.
- Multi-cell stairs are allowed only when explicitly requested and declared in metadata, with every stair cell listed.
- Decorative stair bands that imply multi-cell traversal are forbidden unless declared as multi-cell stairs.
- A medium actor base must fit centered on each stair cell without straddling landings or hanging over an edge.

## Required Question Gate

Before finalizing metadata, answer these. If the user did not answer, make a conservative proposal and mark it as a proposal.

- Which combat room size is this: Cramped, Small, Standard, or Large?
- Which enemies are in this combat scene?
- How many of each enemy type are present?
- Where does each enemy start?
- Are any enemies hidden, patrolling, elevated, guarding, or waiting in ambush?
- Where does the player character start?
- Where do companion characters start?
- Are there neutral NPCs or noncombatants, and where do they start?
- What are the default hero spawn cells? There can be at most 3 hero spawn cells total, ordered PC, chosen NPC 1, chosen NPC 2.
- What are the default enemy spawn cells?
- Are there named spawn zones?
- What starts the combat: entering a zone, speaking, inspecting an object, crossing a threshold, or explicit scenario start?
- What ends combat besides defeating all enemies, if anything?

## Collision Grid

Every in-bounds cell must resolve to one primary traversal state:

- `walkable`
- `blocked`
- `difficult`
- `hazard`
- `cover`
- `elevation`
- `stairs`
- `transition`
- `out-of-bounds`

Rules:

- Walkable cells must be safe for a medium actor base.
- Blocked cells must list a reason: wall, water, pit, post, rail, shrine base, rubble, furniture, cliff edge, dense prop, void, or equivalent.
- Out-of-bounds cells must be excluded from movement and targeting.
- Difficult terrain must be explicit.
- Hazards must state whether they block movement, trigger on entry, trigger on turn start/end, or only affect actions.
- Cover cells must state cover type and whether they also block movement.
- Stairs must connect explicit source and destination elevations.
- The collision grid must be internally consistent with spawns, actor starts, line-of-sight blockers, cover, hazards, and interactables.

## Combat Rules

For each mapped gameplay feature, define:

- Blockers: blocks movement, line of sight, or both.
- Cover: half, three-quarters, or full.
- Elevation: height in feet and movement implications.
- Stairs: source elevation, destination elevation, exact stair cells.
- Hazards: damage, save DC, damage type, trigger timing, and movement blocking.
- Interactables: action cost, requirements, effect, destructibility, repeatability.
- Fixed lights: source id, source type, color family, radius/shape proposal, state, and interactivity.
- Runtime darkness: Lanterna visibility, fixed light reveal, and targeting visibility behavior.
- Spawn zones: which team can use them and whether encounter overrides are allowed.

## Enemy And Actor Pass

For every actor in the encounter, define:

- Actor id.
- Display name.
- Team: heroes, enemies, neutral, or NPC.
- Creature or character source.
- Starting cell.
- Size and footprint.
- Role: melee, ranged, caster, support, boss, minion, environmental.
- Initial behavior or AI profile.
- Starting condition, hidden state, elevation, facing, or scripted trigger.

Enemy starts must be walkable, unblocked, and tactically readable. Hero and companion starts must be walkable, unblocked, separated from enemy defaults, and capped at 3 hero spawn cells total.

## Lighting And Runtime Visibility

- The combat art plate is a detailed tactical plate, not a runtime visibility screenshot.
- Do not bake the PC Lanterna pool, player-centered darkness mask, fog-of-war, targeting visibility, or visibility falloff into the image.
- The engine may apply the Lanterna danger flare, line-of-sight, targeting, darkness, and fog overlays at runtime, but the base combat plate must remain tactically readable.
- The ordinary exploration Lanterna radius is not the combat readability limit.
- Underground areas must not use sunlight, moonlight, sky light, or generic camera ambience.
- Fixed diegetic light sources may exist when part of the encounter space, but they need explicit metadata.
- Every reachable cell, route, platform, stair, threshold, cover edge, hazard edge, and spawn-relevant surface must have visible material, color, and edge information in `stage_id.art.png`.

Light colors:

- Regular Lanterna oil: pale bone-white with slight blue/aluminium cast.
- Act 1 Greyharbour candles: yellow, honey, warm amber.
- Wood fires: yellow-orange with ember red and soot-dark edges.
- Act 2 Necropolis light: deep desaturated teal-green / blue-green.

## Output Package

Produce:

- `stage_id.art.png`
- `stage_id.grid.json`
- `stage_id.encounter.json`
- in-response ASCII coordinate tactical sketch before art generation
- `stage_id.grid_preview.png`
- `stage_id.collision_preview.png`
- `stage_id.art_validation_overlay.png`
- `stage_id.lighting.json` if fixed-light metadata is not embedded in `stage_id.grid.json`
- Optional `stage_id.notes.md`

## JSON Shape

Use this target shape for `stage_id.grid.json`:

```json
{
  "stageId": "stage_id",
  "status": "draft_grid_validation",
  "image": {
    "runtimePlate": "stage_id.art.png",
    "width": 1920,
    "height": 1080,
    "validationOverlay": "stage_id.art_validation_overlay.png"
  },
  "grid": {
    "projection": "isometric_square",
    "tileWidth": 128,
    "tileHeight": 64,
    "origin": { "x": 0, "y": 0 },
    "width": 0,
    "height": 0,
    "coordinateRule": "x increases down-right; y increases down-left"
  },
  "questionGate": {},
  "walkable": {
    "bounds": []
  },
  "collision": {
    "cells": [],
    "outOfBounds": [],
    "difficult": [],
    "lineOfSightBlockers": []
  },
  "blocked": [],
  "cover": [],
  "elevation": [],
  "stairs": [],
  "interactables": [],
  "hazards": [],
  "transitions": [],
  "lighting": {
    "runtimeDarkness": true,
    "lanternaAppliedAtRuntime": true,
    "fixedSources": [],
    "notes": []
  },
  "spawns": {
    "defaultHeroSpawns": [],
    "defaultEnemySpawns": [],
    "neutralSpawns": [],
    "namedZones": {}
  },
  "validation": {
    "artValidationOverlay": "stage_id.art_validation_overlay.png",
    "passed": false,
    "failures": []
  },
  "validationNotes": []
}
```

Use this target shape for `stage_id.encounter.json`:

```json
{
  "encounterId": "stage_id_encounter",
  "stageId": "stage_id",
  "startTrigger": null,
  "actors": [],
  "heroStarts": [],
  "companionStarts": [],
  "enemyStarts": [],
  "neutralStarts": [],
  "winConditions": [],
  "lossConditions": [],
  "encounterOverrides": {},
  "notes": []
}
```

## Required Response

Return:

- Concise scenario summary.
- In-response ASCII coordinate tactical sketch, using blank cells for blocked/dark/unavailable space.
- Question-gate answers or conservative proposals.
- Proposed file list.
- Draft `stage_id.grid.json`.
- Draft `stage_id.encounter.json`.
- Validation overlay requirements and pass/fail result.
- QA notes listing image or metadata problems that must be fixed before production.
