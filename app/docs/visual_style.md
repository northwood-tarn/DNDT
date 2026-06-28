# Visual Style

## Map Mode Model

- Combat maps use one detailed tactical plate with global readability. They should still feel underground, severe, and dark-fantasy, but all playable cells, cover, blockers, hazards, spawn regions, and elevation changes must be visible enough for fighting.
- Local exploration maps use paired visibility plates:
  - `area_id.dark.png`: the default negative-ink darkness state. It preserves route silhouette, landmark silhouette, and broad spatial truth, but suppresses most material detail and incidental color.
  - `area_id.lit.png`: the same camera, geometry, grid alignment, route plan, and composition, with richer material detail, local color, and edge clarity. This is revealed by runtime Lanterna and fixed-light masks.
- Large traversal or cross-world maps use abstract-only plates. They are for travel, scale, mood, and distance, not local gameplay detail. Do not force them to carry the same material readability as exploration or combat.
- Do not treat these as three brightness settings for the same asset. They are three different asset contracts serving different gameplay jobs.

## Runtime Visibility

- Do not bake the PC Lanterna object, player-centered light pool, fog-of-war mask, or runtime visibility falloff into map art.
- The engine applies Lanterna reveal, fixed-light reveal, darkness masks, fog, visibility falloff, and line-of-sight masking at runtime.
- Fixed environmental light sources may be present as world objects and local baked light cues, but the PC Lanterna is not a world fixture unless the hero sprite is visible and carrying it.
- In local exploration, runtime light reveals or blends from `area_id.dark.png` toward `area_id.lit.png`; it should reveal color and detail, not simply erase darkness from a fully lit painting.
- In combat, the fiction is that the Lanterna reacts to danger: "As danger approaches, your Lanterna flares to full light." Runtime lighting may still affect targeting and mood, but the tactical plate itself must remain readable enough to play on.
- Runtime darkness may hide playable terrain; authored art must still contain truthful route, material, and edge information in the correct layer. Do not permanently black out reachable ends or paint them as if the Lanterna can never reach them.

## Lanterna Placement

- The Lanterna is always carried on the hero's belt.
- Do not draw the Lanterna as a wall lamp, ceiling lamp, floor lantern, shrine lamp, or loose environmental prop unless the hero is actually present and carrying it.
- Map plates usually should not show the hero. In those plates, do not represent the Lanterna at all; it will be rendered as a runtime player-centered light.
- In runtime visibility, the Lanterna light should graze across the ground and nearby vertical edges from a low belt-height source, not shine like overhead ambient light.
- If a map needs visible non-player light, use separate fixed world sources: hanging lamps, furnace slits, shrine candles, fungal seams, ritual pools, work lights, or similar diegetic fixtures.

## Light Rules

- The world is underground and has no natural light.
- The standard Lanterna reveal is 15 ft / 3 squares of bright light, another 15 ft / 3 squares of dim light, and a thin pale visual hem beyond that.
- Darkness is spatial and literal at runtime. It should be produced by the visibility system, not painted as a player-centered mask into map art.
- Fixed environmental lights may be baked into the relevant plate when they are part of the world, especially in built-up areas.
- In local exploration, runtime light reveals the detail plate over the dark plate; it is not a generic transparency filter over one fully lit map.
- In combat, the Lanterna enters its danger-flare state and the plate itself carries tactical readability; runtime darkness and visibility overlays should not be required to understand the battlefield.

## Light Color

- Light color must identify its source. Do not use generic yellow fantasy lighting everywhere.
- Regular Lanterna oil burns closer to white than yellow: pale bone-white with a slight blue/aluminium cast. It may be analogically warm because it is firelight, but it should not read as candle-yellow, honey, amber, or orange.
- Act 1 Greyharbour lights are mostly beeswax candles: yellow, honey, and warm amber. Use this for candle clusters, domestic interiors, shrines, taverns, work tables, and inhabited settlement fixtures.
- Wood fires burn yellowish orange: warmer and rougher than Lanterna light, with stronger flicker, ember reds, and soot-dark edges. Use for hearths, campfires, braziers, forge spill, and burning debris.
- Act 2 Necropolis light uses the project fog palette: deep desaturated teal-green, blue-green, or mineral green. It should feel cold, dead, and subterranean, closer to `app/assets/fog/fog_*.png` than bright neon magic.
- Fungal, mineral, ritual, or supernatural lights may vary, but each must have a clear source and should stay restrained. Avoid arbitrary accent colors.
- When multiple light sources appear together, preserve source identity: Lanterna white, beeswax yellow, wood-fire yellow/orange, Necropolis teal-green.
- The brightest color in the image should still be local and justified by a light source. Do not tint the whole map toward the source color.
- Reflections from fixed non-Lanterna light sources may be baked into the art when the reflective surface justifies them, such as black water, polished stone, wet floors, glass, metal, or oil.
- When light touches a surface, that surface should reveal some of its own material color as well as the color of the light. Do not collapse all lit detail into monochrome.
- Greyharbour lit materials should show worn, weather-beaten color: salt-stained timber, tar-black rope, old paint, rust, damp stone, faded cloth, and dirty book cloth.
- Necropolis lit materials should show cold metallic and mineral notes: silver, dull gold, exposed copper green, oxidized bronze, pale stone, and deep teal reflected light.
- Backlands lit materials may include pale white trunks, sparse blue leaves, dead grey grasses, and rare pink/purple glints from broken ancient machinery. Use these accents sparingly.

## Core Look

- The north star is negative ink / sumi-e inspired underground fantasy.
- Use massive black negative space, pale walkable surfaces, dry brush edges, sparse linework, and restrained painterly detail.
- Prefer a severe, adult, haunted mood over conventional bright fantasy dungeon art.
- The base palette should stay close to charcoal black, near-black ink, dirty grey stone, muted sepia ink, and light-touched bone white. Color enters through specific light sources, not global ambience.
- Avoid parchment-map styling, clean cartoon fantasy, photorealism, full-scene foggy moonlight, and evenly rendered battlemap lighting.

## Detail Density

- Use restrained, low-noise detail.
- Preserve broad brush-painted backgrounds, strong silhouettes, readable route shapes, and light pools.
- Reduce small repeated linework by roughly 20% from the current column-2 exploration reference direction.
- Avoid scratchy ladders, excessive plank or rung marks, over-described rubble, busy grass or roots, tiny carvings, decorative cracks, and other high-frequency marks unless they are gameplay-relevant.
- Merge minor texture into larger ink masses instead of describing every surface break.
- Detail should concentrate around interactables, thresholds, light sources, important terrain edges, and route decisions.
- The goal is not cleaner or flatter art. The goal is less fussy art that leaves room for actors, overlays, movement paths, selection states, spell effects, and grid/debug previews.

## Narrow Rules For Production Plates

Use these rules when generating production-like exploration, combat, or traversal plates. They prevent over-rendered concept art while preserving the right kind of information for each map mode.

- Author the whole reachable environment coherently, but keep detail density restrained.
- Do not bake player-centered darkness, Lanterna reveal, or fog-of-war into the plate.
- Do not use global ambient glow to make the scene pretty. Combat may use global tactical readability; exploration and traversal should rely on the dark/lit or abstract contracts instead.
- Do not light or visually emphasize unreachable surfaces, side platforms, alcoves, ledges, props, or background architecture unless they are primary landmarks or fixed light sources.
- If something is strongly highlighted, it should be reachable, block movement, define the route, be interactive, or be the primary landmark/feature.
- Use large ink masses and broad brush-painted value structure instead of high-frequency texture.
- No decorative debris.
- No incidental cracks, roots, stones, grass, shelf clutter, masonry marks, plank scratches, or rubble marks unless they directly clarify material, route, or gameplay.
- Do not fill empty space with grit. Quiet negative space is valid and desirable.
- Incidental material color should be about 30% more visible where a fixed source, authored value, or later runtime light would reveal it: books, cloth, copper, silver, wet wood, old paint, pale bark, blue leaves, or machinery glints may show local color.
- The target is not finished concept art. The target is a clean authored map plate: clear route, clear landmark, material truth, restrained detail, and no false affordances.

## Scale

- Exploration maps should feel like a small reachable fragment inside a much larger underground volume.
- Preserve scale through composition, unresolved edges, distant structures, vertical drops, huge pillars, arches, chains, bridges, cavern walls, black water/depth, and later runtime darkness.
- Do not fill every part of the plate with content. Sparse routes and large voids are valid.
- Detail should concentrate around reachable surfaces, route choices, interactables, and light sources.

## Exploration Maps

- Exploration local maps use a 17 x 12 cell target.
- They should prioritize place, route hierarchy, environmental storytelling, and scale.
- The player should feel small against architecture, darkness, and distance.
- Walkable paths and important destinations must be spatially true in both exploration layers: readable as silhouettes in `area_id.dark.png` and legible as material routes in `area_id.lit.png`.

## Act 2 Necropolis

- Act 2 should feel architectural and ritualized: cold, formal, stone, circular, recursive, symmetrical, and dead.
- Stone dominates. Avoid wood-dominant structures except for rare incidental objects.
- Use sweeping circular and square motifs: round doors, circular plinths, ring corridors, rotundas, wells, square crypt cuts, square vault thresholds, concentric steps, radial stairs, and formal retaining walls.
- Avoid oval holes, asymmetrical almost-circles, and ad hoc ruined-random geometry.
- Central round doors, circular wells, and formal rotundas must be geometrically disciplined and symmetrical.
- Use the Necropolis light color as deep desaturated teal-green / blue-green mineral fog light, not neon magic.
- Slightly foggy green diffusion from wells, seams, and recessed fixtures is desirable.
- Circular glass/stone floor implants are a strong Act 2 motif and can be reused.
- Do not light unreachable clutter. If a platform, ledge, alcove, or object is lit, it reads as important or reachable; either provide a route or let it fall back into darkness.

## Act 3 Backlands

- The Backlands are open-air underground landscapes inside an immense cavern whose ceiling has never been reached. Do not treat them as tunnels, cave rooms, dungeon interiors, or formal ruins.
- The Backlands should feel vast, lethal, empty, and mostly unlit. Without the Lanterna, the player is dead within the hour.
- Use giant landscape features: riven trees, mountain sides, black fields, dead roads, ravines, sinkholes, exposed ridges, root systems, distant silhouettes, and colossal natural forms.
- Vast scale should not imply ambient glow. A mountain, cliff, or field may vastly exceed the frame, but the relevant map plate should describe it with restrained value, broad silhouette, and sparse detail so darkness and abstraction can carry most of the scale.
- Do not fill the whole frame with described landscape texture.
- Distant mountains, ridges, trees, or ruins should be authored as broad forms and silhouettes, not fully detailed surfaces.
- Runtime faint path cues may be used only when the correct route would otherwise be hard to find.
- Reduce small mark-making in grass, reeds, branches, rocks, roots, and ground texture. The Backlands should be more empty, darker, and less explained than Acts 1 and 2.
- Delete incidental ground clutter before deleting darkness. Odd growths, speckles, grass strokes, rootlets, and busy ground texture reduce the sense of spooky endless space.
- Use fewer, larger marks. Keep route shape, one major landmark or silhouette, and terrain edges needed for play; let blackness and empty ground carry scale.
- Major landscape landmarks are valuable, but should appear sparingly, roughly every 4-5 maps, so they retain force.
- Mixed campfire and Lanterna light is allowed at runtime, but map art should only bake the campfire/fixed source. The Lanterna component is applied by the player light system.

## Combat Maps

- Combat maps use one of four invariant room sizes: Cramped 11 x 8, Small 12 x 9, Standard 14 x 10, or Large 16 x 11.
- Combat should feel closer than exploration, but still embedded in immense darkness.
- Combat visibility is justified by the Lanterna flaring to full light as danger approaches. This is magical combat-state illumination, not ordinary exploration radius.
- Combat maps should never allocate more than 3 friendly spawn cells.
- Prioritize intimacy of fighting, readable cover/blockers/elevation, and enough battlefield clarity for tactical decisions.
- Enemy combatants are rendered separately from the map, but the map must give them clean readable backgrounds, spawn surfaces, silhouettes, and contrast zones.
- Use fixed lights as tactical terrain and mood anchors, but combat plates must not depend on small light pools for basic legibility.

## Combat Variant

- Combat uses the same visual language as exploration, but should sit slightly closer to concrete readability.
- Treat combat as column 1.5 relative to the exploration target: still dark, abstracted, and negative-ink led, but with cleaner playable surfaces, clearer cover silhouettes, stronger elevation reads, and less brush ambiguity around cells that matter.
- Preserve enemy/background separation. Enemy silhouettes, weapons, threat posture, and approximate size should read before fine surface texture.
- Do not solve combat readability by raising global brightness into cheerful ambience. Solve it with authored tactical illumination, clear terrain, fixed light placement, stronger silhouettes, controlled detail density, and clearer terrain edges.

## Readability / Screenshot Rule

- Runtime darkness is core, but it must not make gameplay truth illegible.
- Route edges, interactables, enemy silhouettes, spawn-relevant ground, cover, blockers, stairs, hazards, and targeting-relevant terrain must remain readable.
- Basic route affordance must read without UI. Interactive highlighting can confirm what is usable, but it should not be required to tell whether a staircase, side path, threshold, or platform is traversable.
- Each map should still read at screenshot/thumbnail scale: one clear lit shape, one strong landmark, and one obvious scale cue.
- If a runtime screenshot only reads as texture or blackness, adjust the relevant map-mode contract: exploration layer blend, runtime light, silhouette, route shape, combat tactical illumination, or landmark clarity.

## Style Exploration Sheets

- Use 2 x 2 contact sheets for serious visual judgment. A 5 x 5 sheet is useful for breadth, but panels are too small to judge brush density, light color, route readability, and noise.
- Each 2 x 2 sheet should keep one variable under review: place type, darkness level, abstraction level, light-source color, combat readability, or detail density.
- Do not use contact-sheet panels as production plates. They are for selecting and rejecting visual language before full-size exemplars.
