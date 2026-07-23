# Combat UI v2 icon trial audit

Status: **TRIAL — awaiting visual approval**

This audit covers the choices currently produced by combat scenario data for Mara Vey, Nix Calder, and Sister Elian. Upcast spell actions share the native spell icon; spell-slot level, availability, concentration, uses, and other state remain separate UI treatments. Quickcast uses the same choice payload and icon registry as Action Options.

## Required icon inventory

### Weapons — current focus

- Shared across surfaces, unique by weapon type: `shortsword`, `longsword`, `greatsword`, `maul`, `glaive`, `dagger`, `battleaxe`, `warhammer`, `quarterstaff`, `rapier`, `scimitar`, `handaxe`, `longbow`, `shortbow`, and `mace`.
- The setting's greatsword is the Danica-reference double-ended weapon: two full blades around a central grip, presented on the same bottom-left to top-right axis as every other weapon icon.
- Named magical records currently reuse their underlying weapon-type art. Spell and effect variants are deferred until the atomic effect language is designed.
- Weapon sources are 80×80 PNGs. Action Options renders normal icons at 40×40, weapon-set boxes at 68×68, and quickcast boxes at 64×64 with 56×56 art.
- Weapon-set slots reuse their constituent weapon icons; the set itself does not need separate art unless a future combined-set command receives its own stable ID.

#### Weapon handedness roster

Handedness comes from the canonical `hands` field produced by `app/data/weapons.js`.

| Weapon icon type | Hands |
| --- | --- |
| Shortsword | One-handed |
| Longsword | One-handed |
| Greatsword | Two-handed |
| Maul | Two-handed |
| Glaive | Two-handed |
| Dagger | One-handed |
| Battleaxe | One-handed |
| Warhammer | One-handed |
| Quarterstaff | One-handed |
| Rapier | One-handed |
| Scimitar | One-handed |
| Handaxe | One-handed |
| Longbow | Two-handed |
| Shortbow | Two-handed |
| Mace | One-handed |

Named magical records inherit the handedness of their underlying weapon type. The current two-handed roster is Greatsword, Maul, Glaive, Longbow, and Shortbow.

In Action Options, a two-handed weapon occupies both positions in its weapon set. The left position remains the draggable action. The right position repeats the same icon rotated 180 degrees at 70% opacity and is non-interactive, communicating that no second weapon can occupy that position.

### Spells

- Mara: `fire_bolt`, `ray_of_frost`, `shocking_grasp`, `magic_missile`, `mage_armor`, `burning_hands`, `misty_step`, `hold_person`, `shatter`, `fireball`, `hypnotic_pattern`, `banishment`, `wall_of_force`, `cone_of_cold`, `chain_lightning`, `forcecage`.
- Elian: `guidance`, `sacred_flame`, `light`, `toll_the_dead`, `word_of_radiance`, `cure_wounds`, `bless`, `guiding_bolt`, `shield_of_faith`, `aid`, `spiritual_weapon`, `lesser_restoration`, `spirit_guardians`, `dispel_magic`, `mass_healing_word`, `banishment`, `death_ward`, `dawn`, `greater_restoration`, `heal`, `fire_storm`.
- Shared artwork: `banishment` is shared between Mara and Elian. Every upcast variant shares its `sourceSpellId` artwork.
- Unique artwork: every other named spell should receive its own emblem; damaging and support spells share a spell-family frame/value structure but not the central silhouette.

### Consumables and devices

- Shared consumable: `healing_potion` for all three actors.
- Nix devices: `device_fire_paper`, `device_smoke_vial`, `device_thunder_wire`, `device_makeshift_fan`, `device_frost_grenado`.
- Device art is shared when the same prepared device is selected through Catastrophic Charge, Quick Rigging, or Double Rig. The parent abilities retain their own parent icons.

### Movement and tactics

- Universal: `dash`, `dodge`.
- Nix: `cunning_action_dash`, `cunning_action_disengage`, `cunning_action_hide`.
- Shared artwork: Dash and Cunning Action: Dash may share the same dominant boot/forward-motion art; the action-economy slot already communicates cost. Disengage and Hide require distinct silhouettes.

### Class, subclass, species, and lineage abilities

- Mara: `stonecunning`, `spell_rhythm`.
- Nix parent abilities: `catastrophic_charge`, `quick_rigging`, `double_rig`. Their selected device uses device art in the second-stage list.
- Elian: `healing_hands`, `celestial_revelation`, `lantern_pulse`, `halo_of_daybreak`.
- These require unique central artwork. They share the ability-family outer mass and aged-brass bias.

### Channel Divinity

- Elian: `turn_undead`, `harness_divine_power`, `sear_undead`, `radiance_of_the_dawn`.
- All four require unique artwork. They share a strong sacred radial or vertical axis that distinguishes them from the irregular spell diamond language.

### Reactions

- Mara: `shield`.
- Nix: `device_makeshift_fan`.
- Reactions remain behind Settings and are not valid Action/Bonus quickcast assignments in the current locked interaction model. Their art still resolves through the shared registry for reaction UI and future hover surfaces.

## Proposed visual grammar

| Category | Dominant shape | Internal geometry | Value / restrained colour |
| --- | --- | --- | --- |
| Weapon | Long diagonal mass | Edge, guard, impact direction | Bone steel, aged brass |
| Spell | Irregular luminous core | Burst for damage; open hand/cross/halo for support | Fog blue-green; muted ember only when semantic |
| Consumable | Closed vessel silhouette | Cork, neck, contained fill | Green glass, dull brass |
| Movement / tactic | Low forward wedge | Boot, wake, broken trail | Pale fog wake |
| Ability | Stable circular or hexagonal mass | One class-specific mark | Aged brass with fog highlight |
| Channel Divinity | Strong radial or vertical symmetry | Rays, gate, sacred interruption | Bone light, old gold |
| Reaction | Shielding/intercepting mass | Incoming mark stopped at edge | Cold steel and a single bright contact |
| Device | Mechanical bottle, charge, wire, or fan | Hardware seam, pin, coil | Soot-black metal, brass, fog-grey effect |

Category recognition must survive greyscale: silhouette and mass distribution are primary; colour is reinforcement only. Critical marks remain inside a roughly 4px source-safe margin at 40×40.

## Representative painted trial

The original trial contains eight 40×40 PNG sources. The revised weapon sources are 80×80 PNGs:

- Longsword — weapon attack
- Fireball — damaging spell
- Cure Wounds — support/healing spell
- Healing Potion — consumable
- Dash — movement/tactical action
- Spell Rhythm — subclass ability
- Smoke Vial — saboteur device
- Shield — reaction

The current registry maps exact stable IDs first, then uses a category-appropriate painted fallback. No renderer contains per-action icon paths. The drag payload carries stable icon identity/category data, and the existing Action-versus-Bonus drop restriction remains unchanged.

## Approval gate

Do not expand this trial into the full library until the painted style, silhouette scale, palette, and 20×20 legibility are approved.
