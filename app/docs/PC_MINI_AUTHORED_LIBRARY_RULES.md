# PC Mini Authored Library Rules

## Production Direction

PC combat minis are a curated library of complete, individually authored figures. They are not assembled from interchangeable body, head, hair, outfit, cloak, weapon, or class-feature layers.

Each accepted figure is authored as one coherent base-less image. Hair, face, body, posture, clothing, hands, species traits, lighting, and material treatment are resolved together in that image.

The existing custom base library remains separate. A finished base-less figure is manually registered once to an authored base, then combined deterministically with any selected base.

## Initial Library

The first PC mini library contains 20 figures:

| Species / option | Feminine | Masculine | Unisex | Total |
| --- | ---: | ---: | ---: | ---: |
| Human | 1 | 1 | 0 | 2 |
| Elf | 1 | 1 | 0 | 2 |
| Dwarf | 1 | 1 | 0 | 2 |
| Halfling | 1 | 1 | 0 | 2 |
| Gnome | 1 | 1 | 0 | 2 |
| Goliath | 1 | 1 | 0 | 2 |
| Orc | 1 | 1 | 0 | 2 |
| Tiefling | 1 | 1 | 0 | 2 |
| Aasimar | 1 | 1 | 0 | 2 |
| Dragonborn | 0 | 0 | 1 | 1 |
| Full cloak | 0 | 0 | 1 | 1 |

Total: 18 gender-presented species figures, one unisex Dragonborn, and one unisex full-cloak figure.

## Figure Rules

Every figure must:

- Be a complete whole-figure raster asset.
- Be right-facing side-on isometric.
- Use a neutral ready posture with both hands empty.
- Wear simple class-neutral travel clothing.
- Read clearly at actual combat-board scale.
- Match DNDT's dark, worn, restrained material and lighting direction.
- Be authored without a base, plinth, floor, terrain, cast shadow, UI ring, or text.
- Keep both ground-contact points close enough to fit visibly inside the selected base perimeter.
- Avoid long clothing or body shapes that make the occupied cell ambiguous.

Figures must not include:

- Weapons or shields.
- Holy symbols, spell foci, books, staves, or wands.
- Spell effects, casting effects, halos, or class-specific light effects.
- Class-specific armor, robes, equipment, or gestures.
- Selection, targeting, health, condition, or turn overlays.

The mini represents the PC's physical identity, not their class, build, current equipment, or combat action.

## Species Rules

- Human, Elf, Dwarf, Halfling, Gnome, Goliath, Orc, Tiefling, and Aasimar each receive one feminine and one masculine whole figure.
- Dragonborn receives one unisex whole figure and is treated as a distinct draconic body case.
- The full-cloak figure is unisex and deliberately obscures body and species presentation.
- Species distinctions must be readable through large silhouette and proportion decisions rather than tiny surface detail.
- Elf ears, Tiefling horns and tail, Orc mass, Dwarf proportions, smallfolk scale, Goliath scale, Aasimar pallor, and Dragonborn anatomy may be baked into their complete figures.
- Do not create a combinatorial matrix of postures, class variants, equipment variants, hairstyles, skin colors, or outfits.

## Base Rules

- Preserve the existing authored raster base library unchanged.
- Preserve the unique Betrayer's Coin base.
- Preserve all 81 disc/rim metal combinations.
- Base choice remains independent from figure choice.
- Runtime base width remains 115 px against the 128 x 64 combat-grid diamond.
- Register each accepted figure to the visible top surface and measured center of the authored base.
- Boot soles, claws, or other contact points must overlap the visible top plane and remain inside its perimeter; they must not hover at the top edge of the base image.
- Store one measured figure-to-base placement record per finished figure.
- Use the base-center anchor for combat placement.
- A base-plus-figure sprite is a disposable deterministic cache output; the accepted figure and selected base remain separate source assets.

### Stance terminology

In this pipeline, a `stance` means only a named pair of foot-contact positions on the authored base. It does not describe the character's whole-body pose.

Figures sharing a stance may have different torso angles, knee bends, gestures, hand positions, expressions, proportions, clothing, and silhouettes. They share only the required left/rear and right/forward foot-contact targets. Placement must therefore be resolved from measured foot anchors, never from the centre or bounds of the transparent figure crop.

## Source Preservation

- Once the user selects or locks a figure, preserve that exact source image.
- Do not crop, regenerate, reinterpret, repaint, replace, or improve a locked figure unless the user explicitly requests that change.
- Keep the original generated or authored source, transparent cutout, prompt/provenance, placement metadata, and validation proof.
- New attempts must use new versioned filenames and must not overwrite locked assets.

## Production Sequence

For each of the 20 figures:

1. Generate or author one complete base-less figure on a flat removable chroma background.
2. Review the whole figure for species read, body presentation, neutral posture, empty hands, clothing, lighting, and silhouette.
3. Lock the selected source before cutout or composition work.
4. Produce a transparent cutout without changing the figure.
5. Manually establish figure scale and contact placement against an existing authored base.
6. Record the figure-to-base scale, horizontal placement, vertical contact position, and base-center anchor.
7. Render a base-fit proof at the locked 115 px runtime base width.
8. Render the composed mini through the real combat-stage projection.
9. Promote the figure only after visual and technical acceptance.

Do not batch-generate the full library before the first figure passes the complete workflow.

## Acceptance Checks

A figure is accepted only when:

- The source image is explicitly selected or locked.
- The transparent cutout preserves the selected source without visible chroma fringe or lost detail.
- The figure is correctly scaled relative to the approved NPC minis.
- Both contact points visibly rest on the base's top surface.
- Both contact points remain inside the base perimeter.
- The base remains centered inside one 128 x 64 grid diamond at 115 px runtime width.
- The silhouette, species, and body presentation remain readable at actual board scale.
- No prohibited class feature, equipment, base, terrain, or combat overlay is present in the figure art.
- Placement uses recorded metadata rather than arbitrary runtime nudging.

## Superseded Direction

The previous PC factory-line direction based on interchangeable bodies, heads, hair, outfits, weapons, cloaks, Lanterna attachments, and universal sockets is not the production plan for this library.

Existing layered experiments remain reference or rejected experimental material unless explicitly promoted later. They must not be treated as production PC mini assets or used to justify automatic combinatorial generation.
