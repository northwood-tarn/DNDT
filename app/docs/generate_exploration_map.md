# Generate Exploration Map Prompt

Create a DNDT exploration-stage package from image-first map plates and deterministic route/interaction annotation layers.

This workflow mirrors the combat-map workflow but has a lighter gameplay burden. Exploration needs clear walking paths for a single character, transitions, triggers, interactables, and runtime Lanterna reveal. It does not need tactical cover, range, enemy spawns, or combat passability unless the area also becomes a combat stage.

## Core Rule

The generated image is the place. The annotation layers are the exploration truth.

The image does not define traversal, triggers, transitions, interactions, starts, or elevation by itself. The exported metadata does. A cell exists for exploration only when it is painted/annotated as walkable or otherwise meaningful. Unmarked space is not walkable.

## Shared Layer Stack

Use the same conceptual layer stack for exploration and combat tools:

| Layer | Exploration use | Combat use |
|---:|---|---|
| 0 | Dark/default exploration plate, `area_id.dark.png` | Dark/default combat plate, `stage_id.dark.png` |
| 1 | Lanterna-revealed/lit plate, `area_id.lit.png` | Lanterna danger-lit combat plate, `stage_id.lit.png` |
| 2 | Walkable route grid annotation | Playable combat grid annotation |
| 3 | Simple altitude/ramps/ledges if needed | Altitude, ramps, ledges |
| 4 | Interactables, triggers, transitions, optional placed objects | Placed objects, cover, blockers, hazards, lights, triggers, spawns |

The in-game Tab key may temporarily reveal a grid or debug overlay when appropriate. That is a runtime/UI feature, not a requirement for generated map art.

## Exploration Modes

Choose exactly one mode.

### Local Exploration

Use for playable local areas.

Output plates:

- layer 0: `area_id.dark.png`
- layer 1: `area_id.lit.png`

Both plates must use the same camera, crop, projection, route shape, geometry, interactables, fixed lights, and composition.

`area_id.dark.png` is the default negative-ink darkness state: broad silhouettes, readable route shape, strong negative space, minimal material detail, and very limited color.

`area_id.lit.png` is the reveal/detail state: same world, same routes, richer material detail, local color, route edges, interactables, thresholds, hazard edges, and fixed-light response visible when runtime Lanterna or fixed lights reveal it.

Runtime Lanterna and fixed-light masks reveal or blend from layer 0 toward layer 1. The light should reveal color and detail, not simply erase a black overlay from one fully lit painting.

### Large Traversal

Use for cross-world screens, long-distance travel, and scale-setting passages.

Output:

- `area_id.abstract.png`

Large traversal plates are not fine local gameplay maps. They may show route indication, landmark silhouettes, and implied travel direction, but they should not promise precise walkable cells unless explicitly promoted to local exploration.

## Required Inputs

- Area id: `[area_id]`
- Exploration mode: `local_exploration` or `large_traversal`
- Act/location style target: `[act / place / style refs]`
- Exploration premise: `[short description]`
- Notes about location, route shape, entrances, exits, transitions, conversations, discoveries, inspections, blockers, landmarks, elevation, hazards, and story triggers

If missing, make a conservative proposal and label it as a proposal.

## Style Reference Contract

Use project style references for visual language, not exact layout.

Important references:

- `app/docs/visual_style.md`
- `app/docs/style_refs/style_reference_index.json`
- `app/docs/style_refs/full_size_drafts/full_size_draft_index.json`

Style priorities:

- negative-ink / sumi-e inspired underground fantasy
- severe dark-fantasy mood
- massive black negative space
- readable walking paths
- clear landmarks and thresholds
- sparse decoration
- restrained detail density
- local idiosyncrasy allowed when it supports place
- no generic cheerful fantasy lighting
- no player-centered Lanterna glow baked into the art

## Image Generation Contract

Generate the exploration plate or paired plates before route metadata.

The prompt must ask for a usable exploration candidate, not a fully solved grid map.

Required local exploration image properties:

- 1920 x 1080 runtime plates
- isometric or isometric-friendly camera
- clear walking path for a single character
- clear route edges and thresholds
- enough open space around starts, exits, triggers, and interactables
- sparse decoration
- no visible grid
- no UI, labels, tokens, markers, or text
- no enemies
- no player-centered circular Lanterna glow
- no dense clutter that makes walkability ambiguous
- no complicated stacked altitude unless explicitly requested

Default prompt shape:

```text
Create a 1920x1080 isometric DNDT local exploration map plate.
Dark underground negative-ink style. Sparse decoration. Clear walkable route for one character.
No visible grid, no UI, no labels, no characters, no enemies, no tokens.
Leave broad black negative space and readable thresholds.
Avoid dense clutter, ambiguous floor edges, complicated stairs, and busy rubble.
The composition should support a regular isometric route grid being annotated afterward.
Use the supplied act/style references for mood, material, light color, and brush language, but do not copy their layouts.
```

For local exploration, create a matched dark/lit pair. The lit plate may reveal material detail and local color, but it must not add new routes, props, doors, platforms, highlights, or affordances that do not exist in the dark plate.

Reject generated candidates quickly when:

- walking path is unclear
- exits are ambiguous
- surface/void boundaries are unclear
- clutter makes route annotation tedious
- the camera is not isometric-friendly
- altitude/stairs are too complicated
- dark/lit plates disagree about geometry

## Runtime Geometry

- Runtime plate size: exactly 1920 x 1080 pixels.
- Annotation projection: fixed isometric square.
- Tile size: 128 x 64 pixel isometric diamonds unless deliberately revised.
- Coordinate rule: x increases down-right; y increases down-left.
- Grid origin must be explicit in pixel space.
- Local exploration target grid remains approximately 17 x 12 cells, but only painted layer-2 cells are walkable.

Large traversal screens may be abstract and non-local. If they include local route metadata, they must obey the same projection and annotation rules.

## Authoring Modes

The annotation tool should support:

- `walkable`: paint route cells on layer 2
- `erase`: remove route cells
- `altitude`: set simple height bands on layer 3
- `ramp`: connect adjacent height bands on layer 3
- `transition`: mark exits and destination ids on layer 4
- `trigger`: mark conversation, discovery, inspection, story, or cutscene triggers on layer 4
- `interactable`: mark usable/readable/searchable/talkable objects on layer 4
- `start`: mark player, companion, NPC, or neutral starts
- `light`: mark fixed light source metadata
- optional `placed object`: add explicit props/interactables when generated art is too vague

Unmarked cells are not walkable.

## Passability Rules

- Painted layer-2 cells are walkable by default.
- Unpainted cells are not walkable.
- Layer-4 placed objects may remove passability from their footprint when `blocksMovement: true`.
- Transition and trigger cells should normally be walkable unless triggered from an adjacent threshold.
- Starts must be on final walkable cells after placed-object blocking is applied.

Exploration does not need a full blocked-cell inventory by default. The absence of a walkable cell is enough unless a specific object, interaction, transition, or story rule needs metadata.

## Altitude Rules

Keep altitude simple.

Default:

- all walkable cells are altitude `0`

Allowed early scope:

- flat routes
- one simple raised landing
- one obvious ramp or short stair connector
- simple ledge/drop edge

Avoid:

- multi-level path mazes
- stacked bridges over paths
- visual stairs with unclear traversal
- decorative elevation that looks climbable but is not annotated

Warn if adjacent walkable cells have different altitude without a connector or ledge rule.

## Pipeline

### 1. Select Style And Generate Candidate Plate

Use style references and the image generation contract to produce candidates.

For local exploration:

- generate or select layer 0 dark plate
- generate or derive matching layer 1 lit plate

For large traversal:

- generate `area_id.abstract.png`

Accepted local candidates become:

- `area_id.dark.png`
- `area_id.lit.png`

### 2. Import Images As Layers 0 And 1

The tool must import 1920 x 1080 plates without rescaling unless explicitly requested.

For local exploration:

- layer 0: dark/default plate
- layer 1: lit/revealed plate

For large traversal:

- import abstract plate as the relevant image asset; layer annotation is optional unless local gameplay metadata exists.

Save:

- source paths
- runtime copied paths
- width and height
- image checksums if available

### 3. Align Annotation Grid

In the annotation tool:

- set projection to isometric square
- set tile size to 128 x 64
- adjust origin to fit the image
- set grid width/height bounds
- save origin and dimensions

Do not warp the image to fit the grid. If the image cannot take a regular isometric route overlay, reject it.

### 4. Paint Walkable Route Cells On Layer 2

Paint only cells where the player can stand or walk.

Rules:

- painted cells are walkable unless blocked by layer 4
- unpainted cells are not walkable
- leave dense decoration, voids, walls, water, cliffs, locked barriers, and ambiguous areas unpainted
- ensure the player figure can stand on intended cells
- keep routes readable without a visible grid
- keep space around interactables, conversations, discoveries, and transitions

### 5. Add Simple Altitude On Layer 3 If Needed

For each nonzero altitude region:

- assign height band
- mark connector ramp/slope/stair cells
- validate adjacency
- verify both dark and lit plates make the height change readable

### 6. Add Interactions And Triggers On Layer 4

Mark:

- area transitions
- conversation triggers
- discovery triggers
- inspection triggers
- story/cutscene triggers
- interactable objects
- fixed light sources
- optional placed props

Layer-4 objects may block movement if they occupy cells.

### 7. Export Engine Package

Export:

- `area_id.area.json`
- `area_id.dark.png`
- `area_id.lit.png` for local exploration
- `area_id.abstract.png` for large traversal
- optional `area_id.lighting.json`
- optional `area_id.dialogue.json`
- optional `area_id.notes.md`

The exported package must be loadable by the game engine. Test with a tiny route map when implementing the tool.

### 8. Generate Validation Overlay

Produce:

- `area_id.art_validation_overlay.png`

For local exploration, validate primarily over `area_id.lit.png`, then spot-check `area_id.dark.png` for matching route silhouettes and no false affordances.

Overlay should show:

- layer 2 walkable cells
- layer 3 altitude and connectors
- layer 4 triggers/interactables/transitions/placed objects
- final passability after blocking layer-4 objects
- player/NPC starts
- fixed lights

## Validation Rules

The package fails if:

- a final walkable cell lands on visual void, wall, water, cliff, dense prop, locked obstacle, or non-standable art
- an unpainted area strongly reads as required/obvious walking path without UI clarification
- layer 0 and layer 1 disagree about route geometry, thresholds, blockers, exits, interactables, fixed-light placement, or grid alignment
- layer 1 adds new platforms, doors, routes, props, or affordances that do not exist in layer 0
- a blocking placed object fails to remove passability from its footprint
- starts, transitions, or triggers land on non-walkable cells unless explicitly adjacent-triggered
- altitude differs between adjacent walkable cells without a connector or ledge rule
- the player figure would not fit on intended cells
- player-centered Lanterna light, fog-of-war, temporary grid reveal, or visibility falloff is baked into either plate
- the game engine cannot load the exported package

Do not fix validation failures by inventing metadata over bad art. Revise annotation, clarify with a placed object, or reject the generated plate.

## Exploration Design Checklist

Before approval, confirm:

- walking route is clear
- player start is clear
- exits/transitions are readable
- interactables are reachable and not hidden in clutter
- trigger cells are reachable
- dark and lit plates agree spatially
- runtime Lanterna reveal will reveal detail rather than merely remove blackness
- unmarked areas clearly read as outside route once runtime UI behavior is considered
- altitude is flat or simple
- the area reads as a DNDT place, not only a corridor

## Relationship To Combat Maps

Exploration and combat share:

`generate place -> annotate gameplay truth -> validate overlay -> export engine package`

Differences:

- Exploration uses layer 0 dark/default art and layer 1 Lanterna-revealed art, revealed locally and partially at runtime.
- Combat uses layer 0 dark/default art and layer 1 Lanterna danger-lit art, with layer 1 broadly exposed during combat because danger triggers the Lanterna's magical awareness.
- Exploration only needs clear walking paths for a single character, transitions, triggers, interactables, and optional simple altitude.
- Combat additionally needs actor-base space, spawns, cover, blockers, hazards, simple altitude, placed tactical assets, and targeting semantics.

## Required Question Gate

Before finalizing metadata, answer these. If missing, make conservative proposals.

- Which exploration mode is this: local exploration or large traversal?
- Which act/location style target is this?
- Which style reference sheet or full-size draft is closest?
- What is the exploration premise?
- Where does the player start?
- What are the exits/transitions?
- What destination area id and destination cell or entry zone does each transition use?
- Which objects can be inspected?
- Which objects can be used, opened, taken, moved, broken, lit, extinguished, read, searched, or talked to?
- Which interactions are optional, and which are required for progression?
- Where are conversation triggers?
- Where are discovery triggers?
- Where are inspection triggers?
- Are transitions one-way, two-way, locked, hidden, conditional, or story-gated?
- Are there companion, NPC, or neutral start positions?
- Are there cutscene, narration, or story-beat trigger zones?
- Is altitude flat, or is one simple raised/low area needed?

## Ground Audio

Assign one primary `groundMaterial` and placeholder `footstepSound` to every final walkable cell.

- `stone` -> `footstep_stone`
- `wood` -> `footstep_wood`
- `dirt` -> `footstep_dirt`
- `grass` -> `footstep_grass`
- `gravel` -> `footstep_gravel`
- `shallow_water` -> `footstep_shallow_water`

Use the visually dominant surface under the player figure. Decorative debris does not change material unless it covers most of the cell.

## Lighting And Runtime Visibility

- Local exploration art is a matched two-layer visibility asset.
- Layer 0 is the dark/default plate.
- Layer 1 is the Lanterna-revealed/lit plate.
- Do not bake the PC Lanterna pool, player-centered darkness mask, fog-of-war, temporary grid reveal, or visibility falloff into either layer.
- The engine applies Lanterna reveal, fixed-light reveal, darkness masks, and fog at runtime by revealing or blending toward layer 1.
- Underground areas must not use sunlight, moonlight, sky light, or generic camera ambience.
- Fixed diegetic light sources may exist when part of the place, but they need explicit metadata.
- Every reachable cell, route, platform, stair, threshold, and hazard edge must have recoverable material, color, and edge information in layer 1.
- Layer 0 must keep mood and darkness: broad negative ink, sparse silhouette, low detail, and only the minimum visibility needed to avoid false layout.

Light colors:

- Regular Lanterna oil: pale bone-white with slight blue/aluminium cast.
- Act 1 Greyharbour candles: yellow, honey, warm amber.
- Wood fires: yellow-orange with ember red and soot-dark edges.
- Act 2 Necropolis light: deep desaturated teal-green / blue-green.

## JSON Shape

Use this target shape for `area_id.area.json`:

```json
{
  "areaId": "area_id",
  "status": "draft_annotation_validation",
  "mode": "local_exploration",
  "layers": {
    "0": { "kind": "dark_art", "path": "area_id.dark.png" },
    "1": { "kind": "lit_art", "path": "area_id.lit.png" },
    "2": { "kind": "walkable_grid" },
    "3": { "kind": "altitude" },
    "4": { "kind": "interactions_triggers_objects" }
  },
  "image": {
    "darkPlate": "area_id.dark.png",
    "litPlate": "area_id.lit.png",
    "abstractPlate": null,
    "width": 1920,
    "height": 1080,
    "validationOverlay": "area_id.art_validation_overlay.png"
  },
  "grid": {
    "projection": "isometric_square",
    "tileWidth": 128,
    "tileHeight": 64,
    "origin": { "x": 0, "y": 0 },
    "width": 17,
    "height": 12,
    "coordinateRule": "x increases down-right; y increases down-left"
  },
  "walkable": {
    "layer": 2,
    "cells": []
  },
  "altitude": {
    "layer": 3,
    "default": 0,
    "cells": [],
    "connectors": []
  },
  "layer4": {
    "interactables": [],
    "triggers": [],
    "transitions": [],
    "placedObjects": []
  },
  "finalPassability": {
    "rule": "walkable cells minus blocking layer 4 object footprints",
    "cells": []
  },
  "groundAudio": {
    "materials": {
      "stone": "footstep_stone",
      "wood": "footstep_wood",
      "dirt": "footstep_dirt",
      "grass": "footstep_grass",
      "gravel": "footstep_gravel",
      "shallow_water": "footstep_shallow_water"
    },
    "overrides": []
  },
  "lighting": {
    "runtimeDarkness": true,
    "lanternaAppliedAtRuntime": true,
    "visibilityModel": "reveal_layer_1_over_layer_0",
    "fixedSources": [],
    "notes": []
  },
  "playerStart": null,
  "starts": {
    "companions": [],
    "npcs": [],
    "neutral": []
  },
  "namedZones": {},
  "validation": {
    "artValidationOverlay": "area_id.art_validation_overlay.png",
    "passed": false,
    "failures": []
  },
  "validationNotes": []
}
```

## Output Package

Produce:

- `area_id.dark.png` and `area_id.lit.png` for local exploration
- `area_id.abstract.png` for large traversal
- `area_id.area.json`
- `area_id.art_validation_overlay.png`
- optional `area_id.lighting.json`
- optional `area_id.dialogue.json`
- optional `area_id.notes.md`

## Required Response

Return:

- concise scenario summary
- exploration mode
- style reference target
- generated-image prompt or candidate prompt
- annotation assumptions
- proposed file list
- draft `area_id.area.json`
- validation overlay requirements
- pass/fail result when an artifact exists
- optional dialogue or interaction stubs
- QA notes listing image or metadata problems that must be fixed before production
