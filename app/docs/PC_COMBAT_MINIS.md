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

This rule also applies to rough planning art. Species posture sheets, silhouette sketches, and other intermediate miniature studies must be right-facing unless they are explicitly marked as rejected or flipped reference material.

The initial assumption is one authored right-facing side-on isometric view. Four directional facings can be added later if the combat presentation needs them, but the first pass should solve one consistent board-facing view.

Human-scale PC and NPC minis should use a one-cell contact footprint. Because combat maps use a 128 x 64 isometric diamond grid, the base ellipse must register inside a single diamond footprint. The figure may rise above the cell, and a weapon or cloak may visually overlap nearby air space, but the base must not claim an adjacent cell and long weapons should not read as occupying half of the next square.

Canonical PC base rule: character figure art is authored and stored base-less. PC bases are separate authored raster assets from the base library, selected by Betrayer's Coin or by disc/rim metal pairing, then composited deterministically with the base-less figure by measured base-center anchors. Do not ask image generation to invent, recolor, or bake a PC base into the character figure.

The combat mini used by the battlemap may be a cached composed sprite, but that sprite is disposable output from `base-less figure + selected base asset + measured anchor metadata`. The editable character identity and the base choice stay separate so the base can be swapped without regenerating or repainting the figure. Runtime placement still uses the composed mini's measured base-center anchor; it must not become a manual feet-to-base alignment exercise.

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

Those belong to the selected authored base asset, the deterministic composed export, or the combat renderer.

## Composed Mini Export

The exported combat mini is the unit the battlemap uses. It is a deterministic composite of a base-less figure layer and a selected authored base PNG, with the one-cell base already aligned.

The composed mini export should include:

```text
one-cell 128 x 64 registration ellipse
selected authored raster base asset
figure artwork with all ground-contact points inside the base perimeter
explicit sprite anchor at the center of the base ellipse
measured base-center anchor metadata, if the sprite crop is not centered on the base
```

The composed mini export should not include:

- scenic rocks, grass, floor, or terrain
- collector plinth height
- cast shadow outside the one-cell footprint
- selection, targeting, health, or condition overlays

The combat renderer places the exported mini by its base-center anchor, not by the visual center of the figure or the center of the transparent crop. Cropping can be skewed by weapons, cloaks, tails, horns, or spell effects. If the base center is not exactly at the crop center, record measured anchor metadata and use that. Do not adjust figure-to-base alignment at runtime. If a mini fails the base-perimeter test, reject or re-author the base-less figure or its anchor metadata before it enters the combat asset library.

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

- class: fighter, rogue, wizard, warlock, cleric, or paladin
- base disc color
- base ring color
- 3 authored poses per class
- 2 armor variants per class
- cloak, hood up, or no cloak
- 2 weapon display options per class, plus no weapon
- head silhouette
- hair silhouette
- species traits

Size and broad body scale are species-locked. Do not expose separate height or build bands elsewhere in the PC mini builder.

The final class list for PC minis is the same as the game data in `app/data/classes.js`: fighter, rogue, wizard, warlock, cleric, and paladin. Do not introduce mini-only classes.

Base disc and ring colors should use the same muted metallic palette, but they must be selected independently. These choices select an authored base PNG rather than being baked into the character figure art. The range should feel like painted or tarnished miniature materials, not plastic toy colors. Every option should be dull, scratched, worn, and slightly tarnished. Avoid clean chrome, candy gloss, and pristine enamel.

Base customization is intentionally simple, but the base art must be raster material artwork, not SVG or shape-rendered UI. Player-facing choices are only `disc` metal and `rim` metal. Each valid pairing should resolve to a pre-rendered bitmap base asset that feels like a real worn metal miniature plinth. Do not expose separate texture, noise, scratch, wear, or patina overlay choices. Those surface qualities belong inside the authored base image, not to player-facing options. The current asset contract lives in `app/mini_preview/base_asset_manifest.js`; it defines the metal IDs and expected PNG path for each disc/rim pairing. PC figure generation must never be used to create the base color; the compositor chooses the base asset.

Character creation should default the PC mini to the unique Betrayer's Coin base. Present this as a selected/ticked unique-base choice. If the player unticks it, reveal the normal base builder using only the disc metal and rim metal controls from the 81 authored PNG combinations.

Locked runtime base footprint: PC mini bases display at 115 px wide on the combat map. This width is judged against the `generate_combat_map` grid diamond size: 128 x 64 px. Base source PNGs may remain larger for source quality, but runtime placement must center the visible base bounds inside the occupied 128 x 64 diamond. Do not use source canvas dimensions or old export anchors as the runtime footprint.

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

Lineage-driven body colors:

- Dragonborn lineages: black, blue, brass, bronze, copper, gold, green, red, silver, white.
- Tiefling lineages: abyssal, chthonic, infernal.

Dragonborn and Tiefling body color comes from lineage. They must not expose the general humanoid skin-tone selector.

The 3 class poses should be authored as meaningful choices, not simple duplicates. One pose can focus on weapon identity, but each class should have three readable silhouettes that work on the combat board.

Pose and posture should not explode into a full combinatorial asset set unless the renderer can support it cleanly. Prefer authored class poses plus layered options.

Class outfit planning should start on the Human posture-1 mannequin so outfit shape is not confused with species or posture differences. First-pass class outfit choices:

- Outfit 1: practical/default class outfit.
- Outfit 2: alternate, heavier, or more class-flavoured outfit.
- Cloak, hood down: heavy all-covering travel cloak overlay, hood resting down at shoulders/back. It should feel closer to a dark road-worn wrapped cloak than a light cape: layered, ragged, and materially covering much of the body while leaving hands and equipment channels usable.
- Cloak, hood up: much simpler hood-up cloak overlay that hides hair/head silhouette but keeps the arms and equipment channels usable.

Outfit and cloak sheets must not bake in weapons, tools, holy symbols, books, Lanterna, magic effects, or bases. They must preserve visible hand space and a clear grounded-staff channel beside the body. Current references: `app/mini_preview/assets/class_outfits/human_posture1_class_outfit_cloak_sheet_v1.png` and `app/mini_preview/assets/class_outfits/human_posture1_class_outfit_cloak_sheet_v2.png`.

Armor and clothing belong to class outfit layers, not species posture sheets. Species posture work should stay as neutral body/posture planning so it can later accept class outfit, cloak, weapon, and Lanterna layers without baking in the wrong choice.

Warlock outfit 1 and outfit 2 need especially distinct silhouettes. Outfit 1 should read as a pact exile: long narrow asymmetrical coat over fitted travel layers, strange belt wraps, torn sleeve ends, and subtle occult straps. Outfit 2 should read as a patron-marked ceremonial survivor: broken ceremonial cloth over practical dark clothes, asymmetric mantle, jagged layered hems, and a more ritual/damaged silhouette. Neither should include glow, held props, symbols, or lanterns at the outfit stage.

The trusted weapon-display planning reference is the five-column class sheet supplied after the base-composition correction. It is mostly accepted, with one source cell dropped from each class and the specific changes below. The legal weapon-display set is four choices per class, not five.

Dropped weapon-display source cells:

- Fighter: drop 5.
- Rogue: drop 3.
- Wizard: drop 2.
- Cleric: drop 4.
- Paladin: drop 5.
- Warlock: drop 4.

Weapon and hand-holding planning uses these five source slot meanings, but each class now keeps only four legal displays:

1. Main weapon / primary class carry.
2. Offhand or shield set, including shield where appropriate.
3. Heavy, reach, or two-handed option.
4. Ranged, sidearm, magic glove, or alternate staff option.
5. Empty-hand gesture: no held item, ready for magic, holy symbol, focus, command, or practical off-hand use.

Legal weapon displays by class:

| Class | Legal Displays |
| --- | --- |
| Fighter | 1 primary sword; 2 sword and shield; 3 two-handed halberd; 4 grounded spear |
| Rogue | 1 single dagger; 2 dual daggers; 4 crossbow; 5 empty subtle hand |
| Wizard | 1 grounded staff in hand; 3 staff strapped to back; 4 small sidearm dagger; 5 empty casting hand |
| Cleric | 1 mace and shield; 2 sword and shield; 3 ritual staff; 5 handheld magic symbol |
| Paladin | 1 primary sword; 2 sword and shield; 3 hands resting on a huge greatsword; 4 grounded spear |
| Warlock | 1 short blade; 2 magic glove hand; 3 pact staff; 5 empty casting hand |

Required corrections to the trusted weapon sheet:

- Paladin 3: replace the clasped/empty posture with both hands resting on a huge greatsword.
- Cleric 5: replace the empty hand with a handheld magic symbol, using Tahrone's ring-and-crescent Court symbol treatment as the visual precedent.
- Cleric 1: add a shield to the mace display.
- Wizard 3: the staff is strapped to the wizard's back, not held forward.

No wands. Do not use wands as PC mini equipment, silhouettes, or planning placeholders. For arcane hand/focus choices, use a magic glove, an empty casting hand, a grounded staff, or an alternate staff posture instead.

Current active reference: `app/mini_preview/assets/weapon_holding/human_posture1_class_weapon_holding_sheet_v3_no_wands.png`. Rejected wand-containing reference: `app/mini_preview/assets/weapon_holding/human_posture1_class_weapon_holding_sheet_v2_rejected_wands.png`.

Lanterna attachment is universal for PCs and must be tested against posture, species body, outfit, cloak, and weapon choices. It is a small material object, not a glowing combat marker, and it must not replace class symbols, weapons, spell effects, or held lantern props.

Lanterna attachment modes:

1. Dangling: small lantern hanging from belt/strap near hip or thigh.
2. Side-affixed: small lantern fixed to belt, pack ring, armor ring, robe strap, or side hardware.
3. Neck-chain: small lantern or ember charm hanging high on the chest from a chain.

Lanterna constraints:

- It must remain modest in scale, with a dim ember core at most and no bright light spill.
- It should leave all hands free for weapon, staff, holy symbol, magic glove, or empty gesture choices.
- It should not collide with shield, cloak hem, weapon sidearm, tail, or the possible staff line in posture option 3.
- Dangling and side-affixed placements are likely safest for martial, rogue, tail-on Tiefling, and heavy cloak cases.
- Neck-chain can work for casters and clerics, but must not fight holy symbols, cloak closures, Dragonborn chest bulk, or Goliath scale.

Current Lanterna planning references: `app/mini_preview/assets/lanterna/human_postures_lanterna_attachment_sheet_v1.png`, `app/mini_preview/assets/lanterna/species_stress_lanterna_attachment_sheet_v1.png`, and `app/mini_preview/assets/lanterna/feminine_postures_lanterna_attachment_sheet_v1.png`.

Current composition stress-test reference: `app/mini_preview/assets/stress_tests/pc_mini_composition_stress_16_v1.png`. Treat this as a collision/readability sheet for species scale, posture, cloak/outfit mass, weapon/staff channels, and Lanterna attachment; it is not a locked final-art sheet.

Stress-test note: figure 16 is acceptable as a warning case, but its Lanterna sits too far around the front/right of the body. In final composition, that placement should move left, counterclockwise around the body, until the Lanterna is centered on the chest.

Current standalone grid test: `app/mini_preview/figure3_grid_test.html`, using `app/mini_preview/assets/pc_tests/figure3_guarded_lanterna_trimmed.png` and `app/mini_preview/assets/pc_tests/figure3_guarded_lanterna_base_corrected_v3_trimmed.png`. This page is a quick standalone preview only: it copies the 128 x 64 diamond math, but it does not use the `generate_combat_map` 1920 x 1080 fixed-stage contract, stage metadata, validation overlay, or runtime combat projection renderer. Do not treat it as proof that a mini/base works on the actual combat map. The next valid test must place the mini through the real combat-grid/runtime presentation path. The corrected v3 base is the current art-direction test, while `app/mini_preview/assets/pc_tests/figure3_guarded_lanterna_base_forward_v1.png` is rejected because it only resized/stretched the old bad base and did not actually fix the tilt.

Current base-only fit test: `app/mini_preview/figure3_combat_grid_test.html`. This page is a brand-new blank combat grid based on the `generate_combat_map` geometry contract: fixed 1920 x 1080 plate, 14 x 10 standard grid, explicit origin `{ x: 960, y: 120 }`, and 128 x 64 isometric diamonds via `createGridProjectionFromStage()` / `projectGridPoint()`. It places only the original `app/mini_preview/assets/base_combinations/betrayers_coin.png` at the locked 115 px runtime display width. The source PNG remains unchanged at 192 x 128. Runtime placement centers the visible coin bounds inside the highlighted cell rather than using the old source export anchor. It intentionally has no figure, no background art, no sliders, and no map controls.

Current PC vertical-slice test: `app/mini_preview/aasimar_vertical_slice_grid_test.html`, using `app/mini_preview/assets/pc_vertical_slices/aasimar_female_p2_warlock2_mace_necklanterna_green_gold_v1_trimmed.png`. This tests palest Aasimar, feminine body, posture 2, Warlock outfit 2, mace, neck-chain Lanterna, and green/gold base direction on the locked 115 px runtime base footprint. The v1 image is a first-pass generated sprite; it should be judged on silhouette, pose, class read, and grid scale before mass production. Its baked generated base is rejected as a pipeline direction. PC bases must come from the authored base library and be composited under a base-less figure.

Species posture planning has its own hard constraints:

- All posture sketches and final posture assets must be right-facing side-on isometric.
- Every posture must leave the hands empty, visible, and close enough to the body for later weapon, shield, holy symbol, magic, or vertical staff choices.
- A vertical staff with its bottom resting on the ground beside the body must be plausible in every posture.
- Do not let posture option 3 become the broadest or strongest pose. Option 3 should usually be more secretive, guarded, contained, wary, or covert than option 2.
- Posture option 3 should be especially staff-compatible: imagine a staff held at a slight forward angle, bottom planted on the ground near the front foot, with the hand close to the torso. The same hand/body position must also be able to become a weapon grip, holy symbol, or magic hand later.
- Do not bake default tools, weapons, holy symbols, books, or lanterns into species posture assets.
- Every PC will later carry the Lanterna in one of its attachment modes: dangling down, affixed to the side, or on a chain around the neck. Species posture should leave room for that attachment but does not need to show it in posture sketches.

Species feature toggles should stay simple. Tiefling tail/horns should be a player-facing on/off species-feature toggle. Tieflings still use normal hair choices as well as their species-feature choices. Aasimar should not have wings or halos. For PC mini selection, treat Aasimar as humans with access to an extra Aasimar-pale skin tone. This presentation is separate from posture and should not force a different pose.

Skin tone choices are needed for most humanoid PC species. Offer four authored skin-tone families:

- Aasimar pale: Aasimar-only, drained and uncanny.
- Pale: general humanlike pale skin.
- Brown: warm brown humanlike skin.
- Black: dark humanlike skin, using Abubakar Salim as the face/skin-value reference.

Dragonborn and Tiefling do not use these skin-tone choices; their body colour is determined by lineage.

Head, hair, and facial-hair choices:

- Humanlike head choices: narrow/severe, broad/solid, soft/round.
- Dragonborn use a Dragonborn-specific head choice and no normal hair choices.
- Gnomes and Halflings use humanlike heads at 85% head size.
- Hair choices: short messy, short severe, long loose, long tied back, topknot/bun, bald or shaved.
- Tieflings use normal hair choices; horns/tail remain a separate species-feature toggle.
- Facial hair starts with three options: none, full beard, moustache.
- Dwarves must support one full beard option and one moustache option, but facial hair is not forced.
- Aasimar do not use facial hair choices; their facial hair option is always none.
- Hood-up hides hair visually but does not delete the stored hair choice.

## Cloaks And Hoods

Cloak choice is applied late in the layer stack. This means the character can have a full head and hair identity even when the current mini uses a hood-up overlay.

`hood_up` visually hides head and hair, but it does not erase those choices.

## Species Scale And Anchors

Size is species-locked. Do not expose independent height or build choices in the PC mini builder.

Relative authored figure heights, measured against a human baseline:

- Human: `1.0x`
- Elf: `1.0x`, with a leaner and slightly longer line rather than a separate height category
- Dwarf: `0.75x` human height, broad and compact
- Halfling: small species scale; below dwarf and close to gnome scale unless later art requires a slight distinction
- Gnome: `0.5x` human height
- Dragonborn: `1.0x` human height but bulkier, broader, and more draconic
- Goliath: `1.5x` human height
- Orc: `1.0x` human height, heavier and more forward-shouldered than human
- Tiefling: `1.0x` human height, with optional horns/tail feature toggle
- Aasimar: `1.0x` human height, pale severe uncanny human presentation

The renderer should rely on predictable anchors rather than freeform transforms:

```ts
type MiniAnchors = {
  baseCenter: Point;
  groundContactLeft: Point;
  groundContactRight: Point;
  bodyRoot: Point;
  head: Point;
  hair: Point;
  hornLeft?: Point;
  hornRight?: Point;
  tailRoot?: Point;
  weaponHand: Point;
  offhand: Point;
  staffBottom: Point;
  cloak: Point;
  lanternaDangling: Point;
  lanternaSideAffixed: Point;
  lanternaNeckChain: Point;
};
```

Anchor rules:

- `baseCenter` is the only combat placement anchor.
- `groundContactLeft` and `groundContactRight` must land visibly inside the selected base perimeter.
- `staffBottom` must land inside the selected base perimeter and remain plausible for posture 3's guarded staff-compatible pose.
- `weaponHand` and `offhand` must remain close enough to the torso for every legal weapon slot.
- `lanternaDangling`, `lanternaSideAffixed`, and `lanternaNeckChain` must not collide with shield, cloak hem, tail, or staff line.
- `hood_up` may hide head and hair visually, but it must not delete head or hair anchors.

Each species posture and class pose combination needs anchor data so heads, hair, horns, weapons, cloaks, and Lanterna attachment modes land consistently. Any asset without required anchors is not ready for batch composition.

## Species Traits

Species should provide small, recognizable visual traits without forcing every mini into a unique pipeline.

Examples:

- Tiefling: horns/tail on-off feature toggle. Tiefling skin colour comes from lineage, not the general humanoid skin-tone selector.
- Elf / half-elf: ear shape, compatible slimmer or taller head options.
- Dwarf: 0.75x human height, broad compact build, beard support if facial hair becomes separate from hair.
- Halfling / gnome: small species scale, smaller body ratio, rounder head silhouettes.
- Dragonborn: likely distinct head sets rather than a normal head overlay; crest or horns may occupy the hair-equivalent slot. Dragonborn colour comes from lineage, not a separate skin-tone selector.
- Aasimar: pale severe uncanny human presentation; no wings or halos; standard three skin-tone slots shifted one factor paler.

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
| Tara | Human duelist fighter; fast, profane, deflective. | Locked visual reference: `app/mini_preview/assets/tara_human_rapier_v4.png`. Defensive rapier ready-guard: low crouch, torso forward over lead leg, rapier pulled back rather than lunging, blade closer to straight out in front but not fully horizontal, and straight with no downward bow. Off-hand forward as an active defensive guard. Short blonde hair, human ears, no elven features. Human proportion is required: legs and torso should read about 25% taller than the early dwarf-like composed draft while both boots remain inside the base perimeter. Battered duelist coat or half-cloak, asymmetrical shoulder guard, compact aggressive silhouette. Base identity: gunmetal/dark disc. The pale/faint white ring seen around Tara is an active-character turn overlay, not Tara-specific base identity. |
| Xavier | Assassin rogue; pale, delicate, romantic, impossible hands. | Locked visual reference: `app/mini_preview/assets/xavier_v7.png`. Slender silhouette, long fingers, narrow dagger or hidden blade, bookish scarf or collar, slightly turned-away posture. Avoid generic thief language; make him eerie and graceful, but allow more colour than the other companion drafts: pale grey scarf, blue jacket/coat, brighter colourful cloak with teal-blue outer fabric and muted wine/plum folds. Base pairing: blackened iron and dull silver. |
| Duncan | Lantern cleric; harbour priest, cook, mender, protector. | Grounded silhouette, lantern or mace/symbol, practical apron/robe/coat layers, open protective posture. Warm but not soft. Base pairing: tarnished brass and ember-warmed steel. |
| Danica | Vengeance paladin; enormous black-haired knight, grief weaponized. | Locked visual reference: `app/mini_preview/assets/danica_v4_locked.png`. Tall broad silhouette, double-ended vertical sword held with ritual seriousness, heavy worn armor with proud bright cobalt/royal blue accents, outward-facing guard pose. Black hair tied back severely; armor mass, blue panels, and weapon shape should read clearly at small size. Base pairing: aged gold and blackened iron. |
| Tahrone | Necromancer wizard; former Court authority, procedural, death-law. | Locked visual references: `app/mini_preview/assets/tahrone_masked_base.png` and `app/mini_preview/assets/tahrone_unmasked_wide_curved_mask_on_belt.png`. Upright composed side-on silhouette, simple narrow white robes, small belt-bound ledger, handheld ring-and-crescent Court symbol, short severe hair, and dull silver/gunmetal base. Mask is a toggleable head-slot-style treatment: front-only red signet mask on, or very pale serene unmasked face with all-white eyes and the removed mask hanging from the belt. |
| Kestrel | Lantern patron warlock; living lantern, cellar survivor, fragile power. | Locked visual reference: `app/mini_preview/assets/kestrel_locked.png`. Slight, wary, not helpless; small controlled hand-light held outward as if to illuminate or threaten. Three clothing layers: velvet pants and simple brown boots, torn once-white floral dress, oversized blue shirt over everything. Long black hair layered across her back and messy/matted over the face. Longer boot knife tucked into one boot. Base pairing: ember-warmed steel and tarnished brass. |

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
- Tara's identity base is gunmetal/dark. The pale/faint white ring belongs to the combat UI active-character/whose-turn overlay and should move to whichever actor currently has the turn; it is not part of Tara's authored mini identity.
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

## Locked Kestrel Mini

Kestrel is the fifth approved companion mini direction. Treat `app/mini_preview/assets/kestrel_locked.png` as the locked visual reference for her current combat mini.

Locked Kestrel determinations:

- Right-facing side-on isometric is mandatory. She should read as a board-scale miniature, not a portrait.
- Kestrel is not a damsel in distress. She should read as slight, wary, cellar-worn, exhausted, and dangerous enough to survive.
- She is a living lantern, but the light is restrained: a small controlled glow in one hand, held outward as if to illuminate or threaten. It is not a blast, halo, aura, or heroic fire effect.
- Keep the three-layer clothing read: velvet pants with simple brown boots; a once-white floral dress over the pants, now torn, dirty, frayed, and damaged; and a large oversized blue shirt over everything.
- No trappings of wealth, Court finery, ornate jewelry, polished ceremonial styling, or armor.
- Hair is black, long, and layered across her back, with messy/matted strands over the face. Do not clean it into salon hair or shorten it.
- Her face should stay grounded and wary, with a slightly blunt nose and serious expression.
- A longer boot knife is tucked into one boot. It should be visible but not become her main weapon.
- Base pairing is ember-warmed steel disc with tarnished brass rim.
- Keep her slightly shorter than the earlier Kestrel draft; preserve the locked size, gesture, and footprint from `kestrel_locked.png`.

Production export still needs a clean final cutout/cache pass from the locked reference before it becomes a library-ready combat sprite. That export must preserve the cellar-survivor character read, clothing stack, restrained hand-light, boot knife, hair/face direction, base pairing, and one-cell footprint; remove any nontransparent black source background if present; record measured base-center anchor metadata; and pass the one-cell base-footprint test.

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
- Validate selection rules and choice compatibility with `tools/validate-pc-mini-selection.js`; this validator is also run by `tools/validate.js`.
- Register reusable mini layers in `app/mini_preview/pc_mini_asset_registry.js`; do not create authored registry records for full character permutations.
- Resolve one character selection into a deterministic layer plan/cache key with `app/mini_preview/pc_mini_compositor.js`.
- Validate mini asset registries with `tools/validate-pc-mini-assets.js`; this validator is also run by `tools/validate.js`.
- Prefer class-relative armor IDs over global armor assumptions.
- Keep hood overlays compatible with head and hair being present underneath.
- Treat generated token images as cache artifacts.
- Keep combat overlays out of mini identity assets.
- Author PC figures base-less; never bake PC base color, plinth, or terrain into the figure layer.
- Choose PC bases only from the authored raster base library.
- Export or cache a completed base-plus-figure combat sprite from deterministic composition; source figure and selected base remain separately editable.
- Register human-scale friendly bases inside a one-cell 128 x 64 isometric diamond footprint.
- Place completed sprites by measured base-center anchor, never by sprite crop center.
- Reject any exported mini where the figure's ground-contact points fall outside the base perimeter.
- Reject or relight any mini with overbright product-render illumination.
- Test every mini at actual combat-board scale, not just in the creator UI.

## Open Questions

- Whether the first release needs one facing or four facings.
- Whether build variation is worth supporting in the first pass.
- How many palettes are global versus class/species-specific.
