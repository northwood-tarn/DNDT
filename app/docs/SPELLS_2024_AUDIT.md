# Spell Data 2024 Audit

Baseline: every non-homebrew, non-adapted spell in `app/data/spells.js` should match the 2024 PHB / Free Basic Rules spell where that spell exists there. `source` is the existing metadata field; this audit treats `source: "PHB"` as "must be 2024-compatible" and treats `Homebrew`, `PHB (adapted)`, and `PHB (tweaked)` as intentionally non-canonical until separately reviewed.

Primary references used in this pass:
- Roll20 D&D 2024 compendium spell pages, e.g. Sleep, Hex, Guidance, Sacred Flame, Poison Spray, Blade Ward, Resistance, Thorn Whip, Vicious Mockery, Chromatic Orb, Chill Touch, False Life, Cure Wounds, Ray of Sickness.
- D&D Beyond spell pages where accessible for current/legacy contrast.

## Corrections Applied To `spells.js`

These records were updated in the spell data after the initial audit. Some hooks remain declarative until the resolver/action factory grows the corresponding general systems.

| Spell | Previous Problem | 2024 Target Now Reflected |
| --- | --- | --- |
| `sleep` | Bad hybrid: CON save, 20 HP gate, 2 rounds unconscious. | 60 ft range, concentration up to 1 minute, 5 ft radius sphere, WIS save. First failed save gives Incapacitated until end of next turn; second failed save gives Unconscious for duration. No HP pool in 2024. |
| `hex` | Missing material component; text says retarget with no action. | Material component is petrified eye of a newt. Retargeting after target drops to 0 HP requires a Bonus Action on a later turn. Extra damage applies when caster hits target with an attack roll. Disadvantage applies to chosen ability checks only. |
| `guidance` | 2014-style "one ability check" wording. | Touch a willing creature, choose a skill, add 1d4 to any ability check using that skill while concentration lasts. |
| `poison_spray` | Uses old save model and likely old school/range. | Necromancy cantrip, 30 ft range, ranged spell attack, 1d12 poison damage. |
| `acid_splash` | Old one/two creature targeting. | 60 ft range, point target, 5 ft radius sphere, DEX save, 1d6 acid. |
| `chill_touch` | Old ranged spell attack shape. | Touch range, melee spell attack, 1d10 necrotic, no healing until end of caster's next turn. |
| `thorn_whip` | Hook says ranged spell attack; material component absent/incorrect. | 30 ft range but melee spell attack; material component is thorny plant stem; pull up to 10 ft on hit. |
| `vicious_mockery` | Damage is 1d4. | Damage is 1d6 psychic in 2024. |
| `blade_ward` | Old resistance-to-weapon-damage model. | Concentration up to 1 minute; attackers subtract 1d4 from attack rolls against caster. |
| `resistance` | Old saving throw bonus model. | Touch, choose damage type; first matching damage each turn is reduced by 1d4. |
| `false_life` | Uses 1d4+4 and timed duration. | Instantaneous; grants 2d4+4 temporary HP. Higher slots add flat +5 temp HP per slot above 1. |
| `cure_wounds` | Still 1d8 + mod and school Evocation. | 2024: Abjuration, heals 2d8 + spellcasting ability modifier; higher slots add 2d8. |
| `ray_of_sickness` | Adds a CON save to apply Poisoned. | 2024: ranged spell attack; on hit, target takes 2d8 poison and is Poisoned until end of caster's next turn. No second save. |
| `sacred_flame` | Data lacks explicit "ignore half/three-quarters cover" hook. | DEX save target gains no benefit from Half Cover or Three-Quarters Cover for this save. |
| `shocking_grasp` | Current effect says no reactions until end of target next turn. | 2024 prevents Opportunity Attacks until start of caster's next turn. |
| `chromatic_orb` | Missing leap mechanic. | On duplicate d8s, orb can leap to a different target within 30 ft; slot level limits leaps. |

## Likely Compatible But Resolver Support May Lag

| Spell | Data Status | Resolver Note |
| --- | --- | --- |
| `magic_missile` | Data has auto-hit/darts hook and looks compatible. | Factory/resolver still need auto-hit multi-dart support. |
| `fire_bolt` | Basic attack/damage data looks compatible. | Object ignition / object targeting may need richer targeting later. |
| `ray_of_frost` | Looks compatible. | Speed reduction hook needs general modifier/effect support. |
| `mind_sliver` | Core save/damage/effect looks compatible. | Duration should be 1 round in data; penalty-to-next-save needs general roll modifier support. |
| `burning_hands` | Looks compatible. | Area targeting already works for cone saves. |
| `thunderwave` | Looks compatible in broad mechanics. | Push-on-failed-save needs general failed-save movement support. |
| `charm_person` | Broad condition shape looks compatible. | Needs canonical 2024 text check for awareness/hostility details. |
| `detect_magic` | Broad utility record looks compatible enough for non-combat. | Needs exploration resolver later. |
| `comprehend_languages` | Broad utility record looks compatible enough for non-combat. | Not combat-priority. |
| `expeditious_retreat` | Broad effect looks compatible. | Needs ongoing bonus-action Dash modifier. |
| `shield_of_faith` | Broad +2 AC concentration effect looks compatible. | Needs actor modifier system. |
| `bless` | Broad +1d4 attack/save effect looks compatible. | Needs roll modifier system and multi-target support. |
| `guiding_bolt` | Broad attack/damage/next-attack-advantage effect looks compatible. | Already mostly mapped. |
| `inflict_wounds` | Broad melee spell attack/damage looks compatible. | Confirm 2024 damage dice before marking complete. |
| `mage_armor` | Broad AC formula looks compatible. | Needs actor modifier/derived AC system. |
| `shield` | Broad reaction/+5 AC/Magic Missile immunity looks compatible. | Reactions are intentionally deferred. |
| `misty_step` | Broad teleport record looks compatible. | Needs teleport movement action support. |
| `darkness` | Broad area obscurement record looks compatible. | Needs persistent combat object / obscurement zone support. |
| `hold_person` | Broad WIS save/paralyzed/repeat-save shape looks compatible. | Already useful in trial arena. |
| `shatter` | Broad area CON save/damage looks compatible. | Needs object/material riders later. |
| `arms_of_hadar` | Broad STR save/damage/no-opportunity effect looks compatible. | Needs precise no-opportunity condition. |
| `hellish_rebuke` | Broad reaction save/damage looks compatible. | Reactions are intentionally deferred. |
| `protection_from_evil_and_good` | Broad effect looks compatible. | Needs typed source categories and immunity/attack modifier layer. |
| `counterspell` | Needs 2024 verification. | 2024 Counterspell is materially different from 2014; current text may be 2014-like. |
| `hunger_of_hadar` | Broad area hazard idea looks compatible. | Needs persistent zone/hazard/obscurement system. |
| `blight` | Broad CON save necrotic damage looks compatible. | Needs plant/creature-type riders if relevant. |
| `fear` | Broad cone WIS save/frightened/repeat-save shape looks compatible. | Needs drop-held-items and repeat-save line-of-sight details. |
| `fireball` | Looks compatible. | Area radius works. |
| `hypnotic_pattern` | Broad condition bundle looks compatible. | Needs wake-on-damage/action condition cleanup. |
| `circle_of_death` | Broad CON save necrotic area damage looks compatible. | Area size and material component should be verified. |
| `disintegrate` | Broad DEX save force damage looks compatible. | Needs object/death-dust rider if desired. |

## Source Metadata Corrections

These records are not 2024 PHB-compatible as written and should not remain plain `source: "PHB"` unless corrected:

- `minor_magic`: is a homebrew consolidation of harmless rudimentary magical effects, not a PHB spell named Minor Magic.
- `witch_bolt`: already labelled `PHB (adapted)` and should stay out of the canonical bucket.
- `sanctuary`, `command`: already labelled `PHB (tweaked)`.
- `armor_of_agathys`, `banishment`, `wall_of_force`, `far_step`, `synaptic_static`: already labelled adapted or non-PHB expansion and should stay out of the canonical PHB bucket unless explicitly targeted.

## Rule For The Next Pass

Do not build new resolver systems against any spell record until that record is either:

1. `source: "PHB"` and audited as 2024-compatible, or
2. explicitly marked `Homebrew`, `PHB (adapted)`, or `PHB (tweaked)` with implementation notes.

This keeps Rule 1 intact: resolver systems should interpret structured, correct data, not compensate for stale or hybrid spell records.
