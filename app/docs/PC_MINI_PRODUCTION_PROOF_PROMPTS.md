# PC Mini Production Proof Prompt Plan

This is the Phase 2 plan for the first real art-generation pass. Do not expand to the full asset set until these seven proof assets pass technical and visual validation.

All proof assets should be saved under:

`app/mini_preview/assets/pc_builder_production/proof_set/`

Each asset needs:

- `source/<asset_id>_chroma.png`
- `cutout/<asset_id>.png`
- `prompts/<asset_id>.prompt.txt`
- `metadata/<asset_id>.anchors.json`
- Registry status `generated_pending_review` until visual acceptance.

## Shared Generation Contract

Use case: stylized-concept  
Asset type: reusable transparent raster component for the DNDT PC miniature builder  
Style/medium: dark fantasy isometric tabletop miniature art, painterly raster, matching `app/mini_preview/assets/stress_tests/pc_mini_composition_stress_16_v1.png`  
Composition/framing: single right-facing side-on isometric miniature component, centered, generous padding, complete visible component, no cropping  
Scene/backdrop: perfectly flat solid `#00ff00` chroma-key background for local background removal  
Lighting/mood: dim dark-fantasy material lighting; pale blue-aluminium Lanterna light only when the component is the Lanterna; no warm yellow/orange glow  
Constraints: right-facing side-on isometric tabletop miniature component, dark fantasy DNDT style, transparent/cutout workflow, no base, no plinth, no floor, no active ring, no halo, no wings, no wand, no text  
Avoid: front-facing portrait, top-down token, flat icon, cartoon sprite, scenic terrain, cast shadow, floor shadow, UI ring, watermark, letters, labels

## Proof Assets

### `human_masculine_posture_1_body`

Base-less human masculine neutral body for `posture_1` balanced ready. Empty visible hands close to torso, right-facing, boots positioned to fit inside a one-cell base. No outfit, no cloak, no weapon, no Lanterna, no base.

### `aasimar_feminine_posture_2_body`

Base-less aasimar feminine neutral body for `posture_2` forward intent. Pale severe uncanny humanlike figure, corpse-lit or unusual eyes, no halo, no wings, no facial hair. Empty visible hands close to torso. No outfit, no cloak, no weapon, no Lanterna, no base.

### `dragonborn_posture_3_body`

Base-less dragonborn neutral body for `posture_3` guarded/staff-compatible. Bulky draconic silhouette, right-facing, no hair, empty hands close to torso, staff-compatible channel beside the body. No outfit, no cloak, no weapon, no Lanterna, no base.

### `fighter_outfit_1`

Reusable fighter outfit overlay: worn dark armor, straps, practical martial silhouette, readable at board scale. No body skin, no head, no hair, no weapon, no shield, no Lanterna, no base.

### `hood_up_cloak_arcane`

Reusable hood-up cloak overlay suitable for wizard or warlock. Substantial road-worn dark cloak, hood visually hides hair and most head shape, arms/equipment channels remain usable. No body skin, no weapon, no Lanterna, no base.

### `wizard_1_grounded_staff`

Reusable grounded staff weapon/hand display layer. Staff held at slight forward angle, bottom planted near front foot, hand close to torso, guarded rather than dramatic. No body, no outfit, no base, no Lanterna.

### `lanterna_neck_chain`

Reusable neck-chain Lanterna layer. Small material lantern/charm centered on chest, pale white/blue-aluminium light, no yellow or orange glow, modest scale. No body, no outfit, no base.

## Validation Notes

The proof set should be composited into at least three proof renders:

- Human fighter: `human_masculine_posture_1_body + fighter_outfit_1 + wizard_1_grounded_staff + lanterna_neck_chain + Betrayer's Coin`
- Aasimar hood-up caster: `aasimar_feminine_posture_2_body + hood_up_cloak_arcane + lanterna_neck_chain + Betrayer's Coin`
- Dragonborn guarded staff: `dragonborn_posture_3_body + hood_up_cloak_arcane + wizard_1_grounded_staff + custom base`

These proof renders are not final 40-output stress examples. They are acceptance checks for layer quality, base separation, anchors, and style match.
