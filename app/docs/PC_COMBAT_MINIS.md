# PC Combat Minis

This note defines the first-pass approach for player and friendly NPC combat minis. The focus is the PC mini system; enemy minis are deliberately out of scope for now.

DNDT owns this pipeline. External miniature creators may be useful as references, but the in-game system should be a small, data-driven, layered 2.5D token renderer built for our isometric combat view.

## Goals

- Give the chosen PC mini enough visual choice to feel personal.
- Keep PC mini identity separate from combat state.
- Make friendly NPC combat minis readable and characterful without exposing a full editor.
- Share asset vocabulary between PC and NPC minis where that reduces authoring cost.
- Avoid a full 3D mini pipeline unless the whole rendering model changes later.

## Rendering Model

Combat minis are 2.5D side-on isometric tokens, not fully rotatable 3D figures. The camera does not need to inspect every side of the miniature, so authored directional artwork is preferred over model rigging.

The side-on isometric view is mandatory. Minis should not be front-facing product renders, portrait-like character views, or top-down tokens. They should read as figures standing on an isometric combat board, seen mostly from the side with enough top angle to show the broad base ellipse.

The canonical authored facing is **right-facing side-on isometric**. This is a hard asset rule because minis must sit correctly inside the composition and projection used by `generate_combat_map`. Every PC and NPC combat mini prompt should state right-facing side-on isometric explicitly.

The initial assumption is one authored right-facing side-on isometric view. Four directional facings can be added later if the combat presentation needs them, but the first pass should solve one consistent board-facing view.

Human-scale PC and NPC minis should use a one-cell contact footprint. Because combat maps use a 128 x 64 isometric diamond grid, the base ellipse must register inside a single diamond footprint. The figure may rise above the cell, and a weapon or cloak may visually overlap nearby air space, but the base must not claim an adjacent cell and long weapons should not read as occupying half of the next square.

The production mini should be a single registered combat sprite with the base and figure already composed together. The base may be generated or drawn deterministically during authoring, and figure layers may remain separate inside the source pipeline, but the runtime combat engine should place a completed mini sprite, not try to align loose feet onto a separate base.

This is a hard rejection rule: both feet, hooves, claws, or other ground-contact points must be visibly inside the perimeter of the base in the exported mini. If the stance is wider than the base, the pose is wrong or the mini needs a larger approved footprint. Do not rescue this with runtime offsets.

## Visual Direction

The visual target sits between two references:

- A tabletop fantasy mini gives the format target: board-game base, readable silhouette, clear equipment cues, strong class/species identity, and side-on isometric board readability.
- The early DNDT protagonist drafts give the tone target: dark, travel-worn, ember-lit, occult, layered, and asymmetric.

The target description:

> A readable isometric tabletop mini, simplified for board scale, but dressed with DNDT's dark, ember-lit, travel-worn costume language.

The format should feel like a miniature, not a flat portrait token, pixel sprite, or full character-card illustration. The tone should feel like DNDT, not a glossy heroic toy.

Useful miniature-format traits:

- strong silhouette
- grounded broad elliptical base in side-on isometric perspective
- readable weapon, shield, cloak, hair, horns, ears, and class props
- bold enough color/value separation to survive combat map backgrounds
- a pose with personality but no dependency on animation

Useful DNDT-tone traits:

- ragged cloak silhouettes
- hooded mystery option
- lantern, ember charm, icon, or hanging talisman as possible prop categories
- blackened leather, tarnished brass, dark cloth, muted metal, and worn straps
- frayed hems and torn edges as larger silhouette details
- controlled asymmetry, such as one shoulder wrap, one hanging pouch, or one visible charm
- low warm highlights instead of glossy fantasy lighting
- restrained illumination: generated minis should be materially dimmer than the overlit early Tara rapier drafts, with no face-squinting studio key light

Traits to avoid or constrain:

- too much tiny filigree, fabric texture, shield grain, hair strand detail, or armor patterning
- near-black-on-black value structures that disappear on dark combat maps
- long trailing cloak shapes that make the grid footprint ambiguous
- highly integrated full renders that cannot be separated into layers
- product-render lighting that makes every mini feel like an external asset
- making hood-up the default look for every PC

The art rule is:

> Big shape first, DNDT grime second.

If a mini reads as class, species, equipment, and pose at actual combat-board scale, it can carry DNDT texture treatment. If it only works as a large illustration, it is too detailed for combat.

Class silhouettes should start with gameplay readability:

- Fighter: shield, weapon, and armor first; worn straps, chipped shield, and tarnished trim second.
- Rogue: crouch, cloak, dagger, bow, or hidden hand first; scarf, tools, and dark leather second.
- Wizard: staff, casting hand, book, or focus first; ember charm, layered robe, and hood option second.
- Cleric: mace, shield, symbol, lantern, or ritual focus first; brass icon, bindings, and travel-worn cloak second.

## PC Mini Source Layer Stack

The source pipeline may keep character identity artwork in layers:

```text
class pose body
armor
species body trait, if any
head
species head trait, if any
hair
cloak / hood final overlay
weapon
```

These source layers should not include:

- base disc
- base ring
- plinth or scenic terrain
- base shadow
- selection overlay
- targeting overlay
- health display
- condition markers
- turn ownership markers

Those belong to the composed export or the combat renderer.

## Composed Mini Export

The exported combat mini is the unit the battlemap uses. It includes the figure and the one-cell base already aligned.

The composed mini export should include:

```text
one-cell 128 x 64 registration ellipse
base disc fill
base ring fill
dull scratched/worn metal texture
figure artwork with all ground-contact points inside the base perimeter
explicit sprite anchor at the center of the base ellipse
measured base-center anchor metadata, if the sprite crop is not centered on the base
```

The composed mini export should not include:

- scenic rocks, grass, floor, or terrain
- collector plinth height
- cast shadow outside the one-cell footprint
- selection, targeting, health, or condition overlays

The combat renderer places the exported mini by its base-center anchor, not by the visual center of the figure or the center of the transparent crop. Cropping can be skewed by weapons, cloaks, tails, horns, or spell effects. If the base center is not exactly at the crop center, record measured anchor metadata and use that. Do not adjust figure-to-base alignment at runtime. If a mini fails the base-perimeter test, reject or re-author it before it enters the combat asset library.

## Combat-Owned Presentation

The combat engine may render tactical affordances around or under the mini:

```text
tile/elevation shadow
movement and targeting glow
selection ring
health and condition markers
turn ownership indicators
line-of-sight and targeting affordances
```

This keeps the PC's identity art stable while allowing combat state to change every frame.

## PC Mini Identity Shape

The character record should store the editable identity config. The composed token image is disposable cache output.

```ts
type PcMiniIdentity = {
  classId: string;
  speciesId: string;

  heightBand: "short" | "medium" | "tall";
  build?: "slight" | "standard" | "broad";

  poseId: string;
  armorId: string;

  headId: string;
  hairId: string;
  speciesTraitIds: string[];

  cloakId: "none" | "cloak" | "hood_up";
  weaponId: "none" | string;

  baseColor: string;
  ringColor: string;
};
```

## Customization Surface

At character creation, the PC mini should support:

- base disc color
- base ring color
- 3 authored poses per class
- 2 armor variants per class
- cloak, hood up, or no cloak
- 2 weapon display options per class, plus no weapon
- head silhouette
- hair silhouette
- species traits
- height band
- optional build band

Base disc and ring colors should use the same muted metallic palette, but they must be selected independently. These choices drive the composed base layer rather than being baked into the character figure art. The range should feel like painted or tarnished miniature materials, not plastic toy colors. Every option should be dull, scratched, worn, and slightly tarnished. Avoid clean chrome, candy gloss, and pristine enamel.

Good palette direction:

- aged gold
- dull silver
- tarnished brass
- dark bronze
- gunmetal
- metallic green
- deep copper
- blackened iron
- ember-warmed steel

Avoid high-chroma primary colors, candy gloss, neon accents, and bright plastic-looking fills. Red should be reserved for enemies rather than PC or friendly mini bases. The base can still help identify the character, but it should sit inside DNDT's worn miniature language.

The 3 class poses should be authored as meaningful choices, not simple duplicates. One pose can focus on weapon identity, but each class should have three readable silhouettes that work on the combat board.

Pose and posture should not explode into a full combinatorial asset set unless the renderer can support it cleanly. Prefer authored class poses plus layered options.

## Cloaks And Hoods

Cloak choice is applied late in the layer stack. This means the character can have a full head and hair identity even when the current mini uses a hood-up overlay.

`hood_up` visually hides head and hair, but it does not erase those choices.

## Height, Build, And Anchors

Height should use constrained bands instead of arbitrary scaling:

- `short`: halfling, gnome, and similar silhouettes
- `medium`: baseline human, elf, half-elf, and many other species
- `tall`: taller elf, orc, dragonborn, and similar silhouettes

Height bands should change body proportion, not just overall sprite scale. A short/dwarf-like combat mini may use a compact leg-and-torso ratio similar to the first composed Tara draft. A human mini should read roughly 25% taller through the combined legs and torso while keeping the same one-cell base footprint.

Build should also be constrained if used:

- `slight`
- `standard`
- `broad`

The renderer should rely on predictable anchors rather than freeform transforms:

```ts
type MiniAnchors = {
  body: Point;
  head: Point;
  hair: Point;
  horn: Point;
  weaponHand: Point;
  cloak: Point;
};
```

Each class pose and height band combination may need anchor data so heads, hair, horns, weapons, and cloaks land consistently.

## Species Traits

Species should provide small, recognizable visual traits without forcing every mini into a unique pipeline.

Examples:

- Tiefling: horns, tail, optional unusual skin palette.
- Elf / half-elf: ear shape, compatible slimmer or taller head options.
- Dwarf: short height band, broad build, beard support if facial hair becomes separate from hair.
- Halfling / gnome: short height band, smaller body ratio, rounder head silhouettes.
- Dragonborn: likely distinct head sets rather than a normal head overlay; crest or horns may occupy the hair-equivalent slot.

Species traits can be body overlays, head overlays, or compatibility rules. Some species should have restricted head or hair choices rather than trying to force every asset to fit every body.

```ts
type MiniAsset = {
  id: string;
  layer: MiniLayer;
  compatibleSpecies?: string[];
  incompatibleSpecies?: string[];
  compatibleHeightBands?: HeightBand[];
};
```

## Ember Editing

Embers are campfire-style locations where the player can adjust presentation, not rebuild character identity.

Editable at embers:

- base color
- base ring color
- class pose
- armor variant
- cloak, hood up, or no cloak
- weapon display, within currently valid equipment

Locked after character creation:

- species
- height band
- build
- head
- hair
- core species traits such as horns, ears, and tail
- class
- core body silhouette

Story events, disguises, curses, barber services, or special cosmetic rewards can create explicit exceptions later. The default ember editor should not include head or hair changes.

```ts
type MiniEditScope = "creation" | "ember";

type PcMiniField =
  | "baseColor"
  | "ringColor"
  | "poseId"
  | "armorId"
  | "cloakId"
  | "weaponId"
  | "headId"
  | "hairId"
  | "speciesId"
  | "heightBand"
  | "build"
  | "speciesTraitIds";

const MINI_EDIT_RULES: Record<PcMiniField, MiniEditScope[]> = {
  baseColor: ["creation", "ember"],
  ringColor: ["creation", "ember"],
  poseId: ["creation", "ember"],
  armorId: ["creation", "ember"],
  cloakId: ["creation", "ember"],
  weaponId: ["creation", "ember"],
  headId: ["creation"],
  hairId: ["creation"],
  speciesId: ["creation"],
  heightBand: ["creation"],
  build: ["creation"],
  speciesTraitIds: ["creation"],
};
```

## Friendly NPC Combat Minis

Friendly NPC minis are only for combat. They need readability and personality, not a full customization surface.

NPCs should share the PC mini asset vocabulary where useful, but they should be authored as presets.

```ts
type NpcCombatMini = {
  npcId: string;
  archetypeId: string;
  personalityPoseId: string;
  outfitId: string;
  headId?: string;
  hairId?: string;
  cloakId?: "none" | "cloak" | "hood_up";
  propOrWeaponId?: string;
  baseColor?: string;
  ringColor?: string;
};
```

The distinction is important:

- PCs assemble from allowed choices.
- NPCs use authored recipes.

Example presets:

```ts
const npcMiniPresets = {
  nervous_apprentice: {
    archetypeId: "civilian_robed",
    personalityPoseId: "hunched",
    outfitId: "travel_robes",
    headId: "round_soft",
    hairId: "messy_short",
    propOrWeaponId: "satchel_staff",
    ringColor: "ally",
  },

  stern_guard_captain: {
    archetypeId: "soldier",
    personalityPoseId: "square_stance",
    outfitId: "polished_medium_armor",
    headId: "angular",
    hairId: "cropped",
    propOrWeaponId: "sword_at_rest",
    ringColor: "ally",
  },
};
```

NPC personality should come from one or two strong authored signals:

- posture
- silhouette
- prop
- palette
- head shape
- cloak shape
- species trait

They should not require the full PC mini editor.

## Companion Mini Starting Set

The first friendly NPC mini pass should focus on true combat companions. Do not use test PCs, local dialogue characters, or system presences as the baseline for this pass.

Included in the first companion set:

- Tara
- Xavier
- Duncan
- Danica
- Tahrone
- Kestrel

Not included in this first set:

- Aya: test PC fixture, not a companion NPC baseline.
- Brassica: major Act I character and possible future protagonist, but not currently one of the seven companion minis.
- Dockmaster: local dialogue NPC; only needs a combat mini if a specific encounter requires defending, escorting, or fighting beside him.
- The Ember: system/rest presence, not a humanoid combat NPC.

Suggested companion mini directions:

| NPC | Combat Read | Mini Direction |
| --- | --- | --- |
| Tara | Human duelist fighter; fast, profane, deflective. | Locked visual reference: `app/mini_preview/assets/tara_human_rapier_v4.png`. Defensive rapier ready-guard: low crouch, torso forward over lead leg, rapier pulled back rather than lunging, blade closer to straight out in front but not fully horizontal, and straight with no downward bow. Off-hand forward as an active defensive guard. Short blonde hair, human ears, no elven features. Human proportion is required: legs and torso should read about 25% taller than the early dwarf-like composed draft while both boots remain inside the base perimeter. Battered duelist coat or half-cloak, asymmetrical shoulder guard, compact aggressive silhouette. Base pairing: gunmetal/dark disc and pale/faint white ring. |
| Xavier | Assassin rogue; pale, delicate, romantic, impossible hands. | Locked visual reference: `app/mini_preview/assets/xavier_v7.png`. Slender silhouette, long fingers, narrow dagger or hidden blade, bookish scarf or collar, slightly turned-away posture. Avoid generic thief language; make him eerie and graceful, but allow more colour than the other companion drafts: pale grey scarf, blue jacket/coat, brighter colourful cloak with teal-blue outer fabric and muted wine/plum folds. Base pairing: blackened iron and dull silver. |
| Duncan | Lantern cleric; harbour priest, cook, mender, protector. | Grounded silhouette, lantern or mace/symbol, practical apron/robe/coat layers, open protective posture. Warm but not soft. Base pairing: tarnished brass and ember-warmed steel. |
| Danica | Vengeance paladin; enormous black-haired knight, grief weaponized. | Locked visual reference: `app/mini_preview/assets/danica_v4_locked.png`. Tall broad silhouette, double-ended vertical sword held with ritual seriousness, heavy worn armor with proud bright cobalt/royal blue accents, outward-facing guard pose. Black hair tied back severely; armor mass, blue panels, and weapon shape should read clearly at small size. Base pairing: aged gold and blackened iron. |
| Tahrone | Necromancer wizard; former Court authority, procedural, death-law. | Locked visual references: `app/mini_preview/assets/tahrone_masked_base.png` and `app/mini_preview/assets/tahrone_unmasked_wide_curved_mask_on_belt.png`. Upright composed side-on silhouette, simple narrow white robes, small belt-bound ledger, handheld ring-and-crescent Court symbol, short severe hair, and dull silver/gunmetal base. Mask is a toggleable head-slot-style treatment: front-only red signet mask on, or very pale serene unmasked face with all-white eyes and the removed mask hanging from the belt. |
| Kestrel | Lantern patron warlock; living lantern, fragile power, protected/displayed by the Court. | Slight luminous silhouette, careful posture, restrained ceremonial cloth, light held at chest or hand. Beautiful but constrained, not messianic. Base pairing: ember-warmed steel and tarnished brass. |

Recommended learning order:

1. Tara: proves compact martial silhouette and duelist stance.
2. Duncan: proves lantern/support identity and warm ally readability.
3. Xavier: tests subtle rogue details and delicate silhouette at board scale.
4. Danica: tests height/build and large paladin silhouette.
5. Tahrone: tests severe caster posture and Court visual language.
6. Kestrel: tests luminous detail without turning the mini into a symbol marker.

## Locked Tara Mini

Tara is the first approved companion mini direction. Treat `app/mini_preview/assets/tara_human_rapier_v4.png` as the locked visual reference for her current combat mini.

Locked Tara determinations:

- Right-facing side-on isometric is mandatory.
- Tara is human, not elven: normal human ears, short blonde hair.
- Human height is required; the early short/dwarf-like Tara pass is rejected as a human proportion reference.
- Both boots must sit visibly inside the base perimeter.
- The base is part of the authored mini, not a loose runtime layer.
- Runtime placement must use the center of the base ellipse, not the sprite crop center or the visual center of the full figure.
- The preview correction that finally read correctly was a `-6px` upward adjustment from the measured base-center placement; this records the visual lesson, not a license for arbitrary per-mini nudging.
- Figure shadow should not be baked around the body; base/contact shadow can remain part of the combat presentation or base treatment.
- Tara's rapier is a slender straight rapier, not a longsword.
- The rapier should be pulled back into a guarded defensive line, closer to forward than the first down-leg diagonal, but not fully horizontal or lunging.
- The locked blade length is the longer v4 length; the previous shorter forward-guard pass was readable but under-length.
- The v3 blade had a slight downward bow and is rejected; v4 is the corrected straight-blade reference.

Production export still needs a clean final cutout/cache pass from the locked reference before it becomes a library-ready combat sprite. That export must preserve the v4 pose and blade, remove any nontransparent black source background if present, record measured base-center anchor metadata, and pass the one-cell base-footprint test.

## Locked Xavier Mini

Xavier is the second approved companion mini direction. Treat `app/mini_preview/assets/xavier_v7.png` as the locked visual reference for his current combat mini.

Locked Xavier determinations:

- Right-facing side-on isometric is mandatory.
- Xavier should remain pale, delicate, romantic, eerie, and graceful.
- He must not read as a generic thief, bandit, hooded rogue, or swaggering assassin.
- No hood-up silhouette for this mini; his longer, messy pale hair is part of the read.
- Keep the bookish scarf/collar and the scholar-adjacent satchel/book detail.
- Hands should stay long-fingered and slightly unnatural.
- Weapon should stay compact: a narrow dagger or hidden blade, not a long sword or extended attack line.
- No lantern, glowing hanging object, or warm light prop. That visual language belongs to Duncan/Kestrel, not Xavier.
- Feet/contact points should sit near the center of the base ellipse, shifted left from the earlier v1/v2 placement.
- Cloak ends may be ragged and expressive, but should not make the one-cell footprint ambiguous.
- Xavier loves colour more than the rest of the set: the locked palette is pale grey scarf, blue jacket/coat, brighter teal-blue cloak exterior, and muted wine/plum cloak folds.
- Colours should be vivid enough to read at combat scale while remaining worn, scratched, grimy, and non-toy-like.
- Base pairing is blackened iron disc with dull silver ring.

Production export still needs a clean final cutout/cache pass from the locked reference before it becomes a library-ready combat sprite. That export must preserve the v7 pose, colour read, compact dagger, long hair, centered feet, and no-lantern rule, remove any nontransparent black source background if present, record measured base-center anchor metadata, and pass the one-cell base-footprint test.

## Locked Danica Mini

Danica is the third approved companion mini direction. Treat `app/mini_preview/assets/danica_v4_locked.png` as the locked visual reference for her current combat mini.

Locked Danica determinations:

- Right-facing side-on isometric is mandatory.
- Danica has black hair for this locked mini, tied back severely and practically.
- She should read as enormous, broad-shouldered, stern, disciplined, and protective: grief weaponized into guardianship.
- Her armor is a point of pride. Keep the brighter cobalt/royal blue armor and cloth accents vivid enough to read at board scale, while still worn, scratched, chipped, and battle-used.
- Keep the heavy paladin armor mass: broad pauldrons, armored bracers, greaves, layered skirt/tabard panels, and dark worn steel.
- The weapon is a double-ended vertical sword/pole-sword, not an ordinary longsword, spear, halberd, scythe, or decorative staff. It has a central grip/guard assembly, a long upper blade, and a long lower blade descending from below the grip to the base.
- The weapon should be held close and upright with ritual seriousness. It should not become a flourish, lunge, or wide horizontal silhouette.
- Both boots must sit visibly inside the base perimeter.
- Base pairing is aged gold disc with blackened iron rim.
- The base is part of the authored mini, not a loose runtime layer.

Production export still needs a clean final cutout/cache pass from the locked reference before it becomes a library-ready combat sprite. That export must preserve the v4 locked character read, black hair, proud bright blue armor accents, double-ended vertical sword silhouette, base pairing, and one-cell footprint; remove any nontransparent black source background if present; record measured base-center anchor metadata; and pass the one-cell base-footprint test.

## Locked Tahrone Mini

Tahrone is the fourth approved companion mini direction. Treat `app/mini_preview/assets/tahrone_masked_base.png` as his locked masked reference and `app/mini_preview/assets/tahrone_unmasked_wide_curved_mask_on_belt.png` as the matching mask-off head-slot reference.

Locked Tahrone determinations:

- Right-facing side-on isometric is mandatory. He should not face the camera like a portrait.
- Tahrone is tall, severe, composed, and procedural: former Bone Court authority, death-law, judgment, and bureaucracy rather than theatrical necromancy.
- His body/outfit baseline is simple and narrow: plain white or ash-white fabric robes, no voluminous cloak, no chains, no hanging colored center panel, and no ornate robe mass.
- Hair is short and severe, close to the head. No bun, ponytail, long hair, hood, hat, or headdress.
- The small legal/spell ledger is bound to the belt at the waist; it is not a large held book.
- The handheld symbol is simple and readable: a restrained ring-and-crescent Court/religious sigil, not a staff, spell burst, lantern, or complex ornament.
- Base pairing is dull silver disc with gunmetal rim.
- The mask is a toggleable NPC head-slot treatment, comparable in principle to PC cloak/hood head-slot handling.
- Masked version: front-only face plate, not a helmet or hood, with dominant long red signet-paint stripes. The red is official and ceremonial, not gore.
- Mask-off version: same body, robes, belt book, symbol, pose, base, lighting, and proportions; the face has very pale skin, a serene composed expression, and all-white or nearly all-white eyes where visible at board scale. The removed mask hangs from the belt over or partly in front of the small ledger as a separate object.
- Belt-carried mask: it should remain visibly mask-shaped, not a book cover, shield, plaque, or flat tag. It should be broad and visibly curved like a shallow face-plate shell, with thickness/side contour, and dominant long red signet-paint stripes.

Production export still needs a clean final cutout/cache pass from both locked references before they become library-ready combat sprites. The masked and unmasked exports must preserve registration and body alignment so the head-slot toggle does not shift the miniature's footprint, pose, symbol, base, or measured base-center anchor.

## Shared Asset Tiers

Reuse should happen at the asset and renderer level, not by forcing NPCs into the PC customization UI.

### Tier 1: Universal

- base disc and ring logic
- cloak and hood shapes
- simple weapon silhouettes
- generic heads and hair
- palette and tint rules
- source-layer composition code

### Tier 2: Class And Role Shared

- fighter-like armor and weapons
- rogue-like cloaks, daggers, and bows
- wizard-like robes, staves, and foci
- healer or cleric-like armor and symbols

These assets can serve both PC classes and allied NPC combat roles.

### Tier 3: NPC-Specific

- unique props
- exaggerated postures
- story silhouettes
- named-character costume pieces

This is where NPC personality should live.

## Asset Authoring Rules

- Keep each layer registered and addressable by ID.
- Store compatibility metadata with assets.
- Prefer class-relative armor IDs over global armor assumptions.
- Keep hood overlays compatible with head and hair being present underneath.
- Treat generated token images as cache artifacts.
- Keep combat overlays out of mini identity assets.
- Export a completed base-plus-figure combat sprite; source layers may be separate, but runtime alignment should not be.
- Register human-scale friendly bases inside a one-cell 128 x 64 isometric diamond footprint.
- Place completed sprites by measured base-center anchor, never by sprite crop center.
- Reject any exported mini where the figure's ground-contact points fall outside the base perimeter.
- Reject or relight any mini with overbright product-render illumination.
- Test every mini at actual combat-board scale, not just in the creator UI.

## Open Questions

- Whether the first release needs one facing or four facings.
- Whether facial hair is a separate slot or part of hair/head.
- Whether dragonborn-style species use the normal head slot or a species-specific head slot.
- Whether build variation is worth supporting in the first pass.
- How many palettes are global versus class/species-specific.
- Where mini composition cache files should live.
