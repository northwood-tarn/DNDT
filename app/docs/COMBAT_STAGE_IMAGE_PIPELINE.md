# Combat Stage Image Pipeline

Combat stages are tactical assets first and illustrations second. The visual plate must serve the combat grid, not the other way around.

## Fixed Stage Size

All combat stage plates are authored for a final runtime size of **1920 x 1080**.

Working files may be larger if needed, but every shipped combat stage must have a 1920 x 1080 runtime plate. Do not let individual stages drift into custom dimensions unless the renderer and grid metadata explicitly support that as a new feature.

## Grid First

The combat grid comes before the illustration.

The grid is absolute:

- fixed shape
- fixed orientation
- fixed tile proportions
- fixed origin per stage
- no perspective convergence
- no local warping to suit the painting

Once a stage grid is chosen, it is the tactical truth. The image must be made to fit the grid. The grid must not be bent, stretched, rotated, or reinterpreted to rescue an attractive illustration.

The project must maintain one canonical grid specification for combat stages. This includes tile width, tile height, axis orientation, and coordinate conventions. Individual stages may choose their own origin and playable bounds, but not their own projection language.

Current target: **128 x 64 pixel isometric diamonds** on a 1920 x 1080 stage, unless this is deliberately revised across the whole combat-stage pipeline.

## Illustration On The Grid

Combat art is painted on top of the tactical grid.

The playable floor, docks, stairs, platforms, thresholds, cover edges, and elevation changes must be composed against the grid from the start. A stage can be painterly, atmospheric, and visually rich, but its walkable surfaces must still read as authored to the same isometric lattice.

Concept art that uses cinematic perspective may be used as mood reference only. It is not a valid combat plate until the tactical surface has been rebuilt on the grid.

Generated or painted mood images are references, not gameplay sources. They can establish atmosphere, palette, subject matter, lighting, and composition. They cannot become combat stages until the tactical surface has been rebuilt on the canonical grid.

## Exact Tactical Mask Discipline

Control plates and masks are tactical source geometry, not loose inspiration.

When a stage package contains terrain masks, altitude masks, blocked regions, slope regions, or reserved placed-item footprints, those masks are the gameplay contract. The art process must not move, scale, rotate, widen, shrink, or reinterpret the authored tactical facts to improve the picture.

The visible art is not required to expose those masks as hard silhouettes. It may soften, texture across, shadow, overhang, fog, chip, or dress mask boundaries when the result still communicates the same tactical truth: floor is floor, void is void, cover is cover, ramps are ramps, blockers are blockers.

Organic-looking terrain is achieved through larger landform design, material treatment, edge dressing that does not change gameplay ownership, lighting, grime, cracks, and prop layering. It is not achieved by letting a generated image invent a new battlefield shape, and it is also not achieved by repainting every isometric square as its own visible tile.

If a mask-derived control image is used for generation or painting, it must be treated as an edit/source geometry image unless the user explicitly approves a new tactical layout. Calling a control image a "planning reference" is not acceptable for production combat maps because it invites approximate placement.

## Grid Appearance

The grid is mathematically absolute, but its appearance should belong to the image.

The rendered grid may be visually affected by surface detail:

- softened by grime, fog, wet stone, and uneven light
- partially obscured by small plants, gravel, cracks, fallen leaves, stains, or scattered debris
- interrupted by non-walkable props and blockers
- tinted by local candlelight, water reflection, shadow, or surface material

These visual effects must never change the actual grid coordinates, tile size, tile orientation, or gameplay interpretation. A small plant or rock may make a grid line look broken or dirty without making the cell blocked. Collision is defined by metadata, not by decorative noise.

The visible grid should usually be rendered as a toggleable overlay, not baked permanently into the runtime art. Baked grid images are useful for art direction, QA, and alignment review. Runtime grid rendering should be able to vary opacity, highlighting, targeting, movement range, and inspection overlays while preserving the same underlying geometry.

## Collision Pass

After the grid-aligned illustration exists, make a collision and gameplay mapping pass.

This pass defines:

- walkable cells
- blocked cells
- cover cells
- elevation or stair transitions
- interactable objects
- spawn locations and spawn zones
- water, pits, walls, rails, posts, candles, shrine bases, boats, rubble, and other non-walkable props

Do not rely on the illustration alone to imply collision. Every combat stage needs explicit gameplay metadata that the renderer and combat engine can consume.

Every stage needs a sidecar metadata file. The image is not sufficient.

Suggested file set:

- `stage_id.art.png` - clean art plate, no baked grid
- `stage_id.grid_preview.png` - review plate with visible grid
- `stage_id.collision_preview.png` - review plate with collision/cover/elevation overlay
- `stage_id.grid.json` - gameplay metadata

The metadata should include:

- stage id
- stage image size
- grid origin
- tile width and height
- grid width and height in cells
- walkable cells
- blocked cells
- cover cells
- elevation bands
- stairs and transitions
- interactables
- default hero spawns
- default enemy spawns
- optional neutral or NPC spawns
- optional named spawn zones
- notes for ambiguous art features

Keep layered source files whenever possible. A flattened PNG alone is not a production source. The grid, clean art, collision overlay, lighting/fog treatment, and prop/blocker notes should remain separable enough that one bad stair, post, or blocker does not require rebuilding the whole stage.

## Placed Asset Registration

Placed tactical assets need two anchors:

- `anchorPixel`: the final-map pixel where the asset is placed
- `localAnchorPixel`: the pixel inside the source asset that lands on `anchorPixel`

They also need `localFootprintBounds`: the source-asset pixel bounds of the contact/base footprint that corresponds to the authored grid cells. Do not infer placement from the cropped image bounds. Cropped-image bottom-center is not a valid registration method.

An asset may visually rise above its footprint, and branches, flames, banners, smoke, or tall silhouettes may extend upward. Its contact/base footprint must still register to the authored cells. Scaling must be computed from `localFootprintBounds`, not from the full visible bitmap bounding box.

The compositor should fail loudly when a placed asset lacks explicit registration. A generated object that looks correct but has no local anchor is not ready for production placement.

## Spawn Metadata

Every combat stage needs at least one default hero spawn set and one default enemy spawn set.

Specific encounters may override these positions, but the stage must still provide safe defaults so it can be used as an encounter container without bespoke placement work every time.

Spawn metadata should support:

- `defaultHeroSpawns`
- `defaultEnemySpawns`
- `neutralSpawns` or `npcSpawns` when needed
- named zones such as `dock_entry`, `upper_platform`, `ambush_left`, or `shoreline_exit`
- encounter-specific overrides

Spawn rules:

- every spawn cell must be walkable
- every spawn cell must be unblocked
- every spawn cell must avoid fixed props
- default spawn groups should not overlap
- spawns should leave enough room for expected party sizes
- enemy defaults should support at least one melee threat and one ranged/caster position when the stage layout allows it
- named zones should describe tactical meaning, not just location

If an encounter has explicit actor positions, those positions win. If it does not, the combat setup should fall back to the stage's default spawn metadata.

Spawn points are gameplay metadata, not visual decoration. Do not infer them from the painting at runtime.

## Actor Miniature Scale

For the current dockside combat-stage scale test, the **medium** miniature option is the correct target.

This means the prototype 192 x 320 source miniature is displayed at about **160 x 267 pixels** on the 1920 x 1080 combat stage. That scale reads correctly against the current 128 x 64 isometric grid and should be treated as the working actor-size reference until deliberately revised.

The current miniature cutout is a mockup, not a finished production asset. Do not spend production time polishing the cutout before scale, base readability, and stage fit are approved.

## Approval Checklist

Before a combat stage is accepted:

- the stage is 1920 x 1080 for runtime
- the playable surface aligns to the canonical grid
- tile size and orientation match the combat-stage standard
- stairs and elevation changes fit exact grid cells
- actor bases fit comfortably on every intended walkable cell
- default hero and enemy spawns are valid, separated, and tactically readable
- blockers are visually and mechanically unambiguous
- cover objects are readable without hiding the grid logic
- placed assets have explicit local anchors and footprint bounds, not inferred cropped-bitmap anchors
- decorative plants, rocks, grime, and debris do not create false collision
- no major prop accidentally occupies a normal walkable square
- water, boats, walls, rails, posts, candles, shrine bases, and heavy rubble are mapped explicitly
- grid preview, clean art, collision preview, and metadata all agree

## Production Rule

If the grid and the illustration disagree, the illustration is wrong.

Fix the art, not the grid.

If the illustration and collision metadata disagree, the metadata is the gameplay truth, but the art still needs to be clarified. Players should not have to guess which cells are real.
