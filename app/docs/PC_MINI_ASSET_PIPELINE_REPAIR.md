# PC Mini Asset Pipeline Repair

## Current Classification

### Production-Usable Authored Assets

- `app/mini_preview/assets/base_combinations/betrayers_coin.png`
- `app/mini_preview/assets/base_combinations/base_disc-*_rim-*.png`

These are the only current production PC miniature assets. They are authored raster PNG bases and remain swappable. They are not destructively resized; runtime display remains `115px` against the `128x64` grid diamond.

### Reference-Only Assets

These images show the target visual direction or planning intent, but they are not reusable production layer assets:

- `app/mini_preview/assets/stress_tests/pc_mini_composition_stress_16_v1.png`
- `app/mini_preview/assets/pc_vertical_slices/aasimar_female_p2_warlock2_mace_necklanterna_green_gold_v1_body_no_base.png`
- `app/mini_preview/assets/pc_tests/figure3_guarded_lanterna_body_no_base_v2.png`
- `app/mini_preview/assets/class_outfits/human_posture1_class_outfit_cloak_sheet_v2.png`
- `app/mini_preview/assets/weapon_holding/human_posture1_class_weapon_holding_sheet_v3_no_wands.png`
- `app/mini_preview/assets/lanterna/human_postures_lanterna_attachment_sheet_v1.png`
- `app/mini_preview/assets/species_postures/species_posture_sketch_sheet_v4.png`

Reasons: most are full-sheet references, RGB planning sheets, or complete figures. Some include baked bases or complete poses. They are useful for prompt/style guidance, not production registry records.

### Placeholder Assets

Everything under `app/mini_preview/assets/pc_builder/` that was produced by `tools/generate-pc-mini-builder-assets.mjs` is placeholder-only. These files were made with code drawing primitives and must not count as production miniature art:

- `app/mini_preview/assets/pc_builder/body/*.png`
- `app/mini_preview/assets/pc_builder/head/*.png`
- `app/mini_preview/assets/pc_builder/hair/*.png`
- `app/mini_preview/assets/pc_builder/facial_hair/*.png`
- `app/mini_preview/assets/pc_builder/species_features/*.png`
- `app/mini_preview/assets/pc_builder/outfit/*.png`
- `app/mini_preview/assets/pc_builder/cloak/*.png`
- `app/mini_preview/assets/pc_builder/weapon/*.png`
- `app/mini_preview/assets/pc_builder/lanterna/*.png`

The render matrix and stress outputs under `app/mini_preview/assets/pc_builder/render_matrix/` and `app/mini_preview/assets/pc_builder/stress_40/` are also placeholder-derived and must not be treated as final validation evidence.

### Missing Production Raster Art Assets

The builder still needs real art-generation or authored transparent PNGs for:

- Base-less body/species/posture layers for all supported species, both body types, and all three postures.
- Humanlike and dragonborn heads.
- Hair and facial-hair layers.
- Tiefling horns/tail species feature layer.
- Two outfits per class.
- Hood-down and hood-up cloak overlays.
- All legal weapon/hand display layers.
- All three Lanterna layers.

## Validation Repair

The previous validator incorrectly passed because it accepted code-generated `pc_builder` PNGs as production. The repaired registry and validator now distinguish:

- `production`
- `reference`
- `placeholder`
- `generated_pending_review`
- `planning`

Production validation now fails if a visible layer plan uses `placeholder` or `code_generated_placeholder` assets. This is intentional until real production art assets exist.

## Production Asset Manifest Plan

Production art should be written to a separate folder, for example:

`app/mini_preview/assets/pc_builder_production/`

Each production asset must have:

- Transparent PNG cutout.
- Preserved chroma/source PNG when generated.
- Prompt/provenance text.
- Anchor metadata.
- `sourceKind` such as `image_generated_chroma_cutout` or `authored_raster`.
- Status `generated_pending_review` until visually accepted, then `production`.

Do not mix production art with the current `pc_builder` placeholder folder.

## Prompt Contract

Every generation prompt for miniature layers must include:

```text
right-facing side-on isometric tabletop miniature component, dark fantasy DNDT style, transparent/cutout workflow, no base, no plinth, no floor, no active ring, no halo, no wings, no wand, no text
```

For built-in image generation, request a flat chroma-key background and remove it locally before registry use.

## Proof Set Required Before Expansion

The next real asset phase should create only:

- `human masculine posture_1` base-less body.
- `aasimar feminine posture_2` base-less body.
- `dragonborn posture_3` base-less body.
- One fighter outfit.
- One wizard/warlock hood-up cloak.
- One grounded staff weapon layer.
- One neck-chain Lanterna layer.

Only after this proof set is visually inspected and technically validated should the full selectable asset set be generated.

## Current Trimmed Humanoid Armed Pool

The first usable armed miniature pool should be class-independent. Do not treat the existing fighter and rogue experiments as separate class-locked sets. Treat them as one humanoid armed pool and keep only the strongest silhouettes.

The goal is not exhaustive weapon coverage. The player only needs enough strong, readable options to choose a miniature that suits how they are playing: martial, shielded, daggered, ranged, holy, staff-casting, body-casting, or hybrid. Do not expand this into every class x weapon x posture combination unless a real silhouette gap appears in play.

Current selected candidates:

- Balanced sword from `human_masculine_posture1_fighter_weapons_v2.png`.
- Balanced sword plus round shield from `human_masculine_posture1_fighter_weapons_v2.png`.
- Aggressive sword from `human_masculine_posture2_fighter_weapons_v3.png`.
- Aggressive sword plus square shield from `human_masculine_posture2_fighter_weapons_v3.png`.
- Defensive sword plus square shield from `human_masculine_posture3_fighter_weapons_v2.png`.
- Defensive spear or polearm from `human_masculine_posture3_fighter_weapons_v2.png`.
- Single dagger from `human_feminine_all_postures_rogue_weapons_v1.png`.
- Dual daggers from `human_feminine_all_postures_rogue_weapons_v1.png`.
- Crossbow from `human_feminine_all_postures_rogue_weapons_v1.png`.
- Aggressive unarmed from rogue posture 3, first image, in `human_feminine_all_postures_rogue_weapons_v1.png`.

Rejected or demoted:

- Rogue longsword replacement review composites, especially `human_feminine_rogue_postures_selected_longsword_review_v3.png`; these remain review artifacts only.
- Weapon repeats that do not read differently across defensive, neutral, and aggressive posture.
- Any silhouette where the weapon floats, visibly collides with the body, or only differs by weapon trivia at board scale.

## Human Feminine Cleric Weapon Matrix

The current locked review pass uses the human feminine base and keeps only the first two rows from the cleric-leaning weapon matrix. This is a review sheet only, not production cutouts.

Locked review sheet:

- `app/mini_preview/assets/pc_builder_production/body_head/review/cleric_weapon_matrix/human_feminine_cleric_weapon_matrix_2x3_attempt_04_crop_from_02.png`
- `app/mini_preview/assets/pc_builder_production/body_head/review/cleric_weapon_matrix/human_feminine_cleric_weapon_matrix_2x3_attempt_04_crop_from_02.lock.json`

Attempt 05 is demoted. It improved the greatsword symmetry but re-rendered the sheet too much, so it should not replace attempt 04.

Matrix:

| Cell | Contents |
| --- | --- |
| 1.1 | Greatshield and mace |
| 1.2 | Mace and cleric holy symbol |
| 1.3 | Danica-like grounded double-ended greatsword |
| 2.1 | Greatshield and longsword |
| 2.2 | Square shield and mace |
| 2.3 | Holy symbol and empty hand |

Holy symbol target: one full circle with half of a second circle on top, mounted on a straight handle. Attempt 04 preserves the preferred six-cell composition from attempt 02 after removing the third row.

## Human Feminine Arcane / Pact Matrix

The current locked review pass uses the human feminine base and covers wizard and warlock together. Wizard reads through staff-casting silhouettes. Warlock reads through direct body/open-hand spellcasting. This is a review sheet only, not production cutouts.

Locked review sheet:

- `app/mini_preview/assets/pc_builder_production/body_head/review/arcane_pact_matrix/human_feminine_arcane_pact_matrix_3x3_attempt_02.png`
- `app/mini_preview/assets/pc_builder_production/body_head/review/arcane_pact_matrix/human_feminine_arcane_pact_matrix_3x3_attempt_02.lock.json`

Attempt 02 replaces attempt 01 because cell 2.1 no longer has an independently floating staff. It now uses a mace plus open spell hand.

Matrix:

| Cell | Contents |
| --- | --- |
| 1.1 | Balanced staff caster |
| 1.2 | Balanced body caster with low dark spell |
| 1.3 | Balanced hybrid with staff carried |
| 2.1 | Aggressive mace plus open spell hand |
| 2.2 | Aggressive body caster with open-hand dark spell |
| 2.3 | Aggressive short blade plus open spell hand |
| 3.1 | Defensive staff caster |
| 3.2 | Defensive body caster with warding hand and held-close spell |
| 3.3 | Defensive hybrid with carried staff and warding hand |

With the trimmed humanoid armed pool, locked cleric matrix, and locked arcane/pact matrix, the current weapon and shield pose coverage is sufficient for the next production step. Further generation should focus on cutout quality, anchors, base-fit checks, and later species/body compatibility rather than adding more weapon options.

## Locked Weapon Pose Cutouts

The locked review sheets have been extracted into transparent PNG cutouts for scroll/filter UI review:

- `app/mini_preview/assets/pc_builder_production/body_head/cutout/locked_weapon_pose_pool/martial/`
- `app/mini_preview/assets/pc_builder_production/body_head/cutout/locked_weapon_pose_pool/divine/`
- `app/mini_preview/assets/pc_builder_production/body_head/cutout/locked_weapon_pose_pool/arcane/`

Manifest:

- `app/mini_preview/assets/pc_builder_production/body_head/metadata/locked_weapon_pose_pool.json`

Review contact sheet:

- `app/mini_preview/assets/pc_builder_production/body_head/review/locked_weapon_pose_pool_contact_sheet.png`

Current counts:

- Martial: 10 cutouts, `martial_01` through `martial_10`.
- Divine: 6 cutouts, `divine_01` through `divine_06`.
- Arcane: 9 cutouts, `arcane_01` through `arcane_09`.

These remain `review_cutout` assets. They are suitable for filter/scroll review and base-fit testing, but should not be promoted to production registry entries until anchor metadata and combat-base checks are complete.

## Locked Accessory Pose Cutouts

Status: not yet produced.

The first accessory-only extraction attempts were rejected. Hand-drawn/guessed prop masks produced random body fragments, and generic-body subtraction also failed because several locked weapon poses do not exactly match the available unarmed body references.

Correct path:

- Use exact source-family subtraction wherever a matching unarmed or less-equipped donor exists.
- For every locked pose that lacks an exact donor, create or regenerate a matching no-weapon/no-shield/no-spell human body cell first, then subtract that exact body from the weapon cell.
- Do not promote accessory-only layers from approximate body subtraction, lasso masks, or colour-only filtering.

The required future output is still the same: separate weapon, shield, holy-symbol, and spell-mark transparent PNGs that can be anchored to different bodies.
