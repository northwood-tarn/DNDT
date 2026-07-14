# Current Actor Field Inventory

Status: diagnostic inventory only. This document describes current representations; it does not define the future shared actor contract.

## Current actor pipeline

The active player-character path is:

`CharacterDraft -> ResolvedCharacterSheet -> CombatActor -> CharacterRecord.runtime -> SaveGameState.party.characterRecords`

The active enemy path is:

`Enemy source record -> enemyFactory -> CombatActor -> combat snapshot`

Both paths already converge on `CombatActor` for combat. They do not yet share one authored actor-definition shape, and only player-character runtime state is persisted into `SaveGameState`.

## 1. CharacterDraft

Source: `app/character/characterDraft.js`

Purpose: records player choices made in character creation. It is not resolved rules data or runtime state.

| Section | Current fields |
| --- | --- |
| `identity` | `characterName`, `level`, `backgroundId`, `speciesId`, `lineageId`, `classId`, `subclassId`, `pactId` |
| `abilities` | `strength`, `dexterity`, `constitution`, `intelligence`, `wisdom`, `charisma` as numeric scores |
| `choices` | `backgroundAbilityScores`, `backgroundOriginFeatChoice`, `speciesChoices`, `classChoices`, `weaponMasteryIds`, `featChoices`, `proficiencyChoices`, `spellChoices` |
| `gear` | `weaponIds`, `armorId`, `shieldId`, `inventory`, `attunedItemIds` |
| `spells` | `knownSpellIds`, `preparedSpellIds` |
| `devices` | `preparedRecipeIds` |
| `metadata` | `source`, `notes` |

## 2. ResolvedCharacterSheet

Source: `app/character/resolvedSheet.js`

Purpose: authoritative resolved output of character creation for character UI, publishing, and conversion to combat.

| Section | Current fields |
| --- | --- |
| `identity` | `characterName`, `level`, background/species/class/subclass/pact IDs and names |
| `abilities.<ability>` | `score`, `modifier`, `sources` |
| Root rules fields | `proficiencyBonus`, `attacks`, `resources`, `features`, `featureHooks` |
| `proficiencies` | `skills`, `tools`, `expertise`, `armor`, `weapons`, `savingThrows` |
| `combatBasics` | `armorClass`, `initiativeBonus`, `speed`, `senses`, `passivePerception`, `saves`, `attackActionAttacks` |
| `durability` | `maxHp`, `hitDice`, `resistances`, `immunities`, `conditionImmunities`, `hitPointBonuses` |
| `advancement` | `abilityScoreImprovements` |
| `narrative` | `tags` |
| `spellcasting` | `canCast`, `source`, `classId`, `ability`, `preparation`, `pactMagic`, `ritualCasting`, `startsAtLevel`, `spellSaveDc`, `spellAttackBonus`, `slots`, `knownSpellIds`, `preparedSpellIds` |
| `devices` | `ability`, `saveDc`, `knownRecipeIds`, `preparedRecipeIds`, `recipeBook` |
| `equipment` | `weaponIds`, `masteredWeaponIds`, `armorId`, `shieldId`, `inventory`, `attunedItemIds` |
| `metadata` | `resolverVersion`, `unresolved`, `notes`, `classChoices` |

## 3. Enemy source record

Source: `app/data/enemies.js`

Purpose: authored reusable enemy definition used by encounters and converted by `enemyFactory`.

Fields present across current enemy records:

- Identity/classification: `id`, `name`, `role`, `creatureType`, `undeadRank`, `size`, `level`, `description`, `tags`.
- Base combat statistics: `hp`, `maxHp`, `ac`, `speed`, `attackBonus`, `saves`, `abilityMods` where supplied.
- Offence: `weaponId`, `naturalAttack`, `damage`, `damageType`, `actionRefs`.
- Capabilities/state templates: `resources`, `features`, `featureHooks`, `activeEffects`, `auras`, `marks` where supplied.
- Defences: `resistances`, `immunities`, `conditionImmunities` where supplied.
- Behaviour: `aiProfile`, `awareness` (`vision`, `hostility`, `visionRange`, optional `swarmGroup`).
- Rewards: `xpValue`, `loot` (`gold`, `table`, `rarityBias`).
- Optional equipment/mastery controls: `enableWeaponMastery`, `masteredWeaponIds`.

Enemy records currently mix reusable definition values (`maxHp`, actions, AI) with what looks like initial instance state (`hp`).

## 4. CombatActor

Sources: `app/combat/actor.js`, `app/character/combatActorAdapter.js`, `app/combat/enemyFactory.js`

Purpose: common gameplay-ready actor representation consumed by combat. This is the current convergence point for heroes and enemies.

### Contractually required by validation

- `id`
- `name`
- `team` (`heroes` or `enemies`)
- `hp`
- `maxHp`
- `ac`
- `position.x`, `position.y`
- `actions`
- `economy`

### Normalized runtime fields

- `speed`
- `inventory`
- `conditions`
- `marks`
- `auras`
- `activeEffects`
- `tags`
- `resources`
- `features`
- `featureHooks`
- `luck`
- `turnFlags`
- `combatFlags`
- `defeated`
- Compatibility fields `movementRemaining` and `actionUsed`

### Additional fields emitted for resolved player characters

- Classification/presentation: `role`, `creatureType`, `token`, `level`.
- Rules: `proficiencyBonus`, `spellSaveDC`, `deviceSaveDC`, `initiativeBonus`, `attackActionAttacks`, `abilityMods`, `saves`, `senses`.
- Durability: `armorClassSources`, `resistances`, `immunities`, `conditionImmunities`.
- Spell/device state: `spellSlots`, `devices`.
- Equipment: `armorId`, `armorType`, `shieldId`, `weaponIds`, `masteredWeaponIds`.

### Additional fields emitted for enemies

- Definition link/classification: `sourceId`, `role`, `creatureType`, `undeadRank`, `size`.
- Behaviour: `ai.profile`, `ai.targetPriority`, `awareness`.
- Rewards: `xpValue`, `loot`.
- Equipment: `weaponIds`, `masteredWeaponIds`, `naturalAttackIds`.

The validator currently checks only the minimal combat fields. Most optional fields are accepted structurally without actor-level validation.

## 5. CharacterRecord and character runtime

Source: `app/character/characterRepository.js`

Purpose: stored player-character package.

### CharacterRecord fields

- `version`
- `id`
- `slot`
- `status`
- `savedAt`
- `characterDraft`
- `resolvedCharacterSheet`
- `combatActor`
- `runtime`
- `validityReport`
- `preview`

### Runtime fields

- `hp`
- `maxHp`
- `tempHp`
- `defeated`
- `spellSlots`
- `resources`
- `inventory`
- `conditions`
- `activeEffects`
- `marks`
- `luck`

The stored record duplicates the full draft, resolved sheet, generated combat actor, and mutable runtime overlay. This supports debugging and recovery but creates multiple stored copies of some concepts.

## 6. SaveGameState actor-related fields

Source: `app/state/saveGameState.js`

Purpose: whole-run persistence.

| Section | Current fields |
| --- | --- |
| Root | `schemaVersion`, `runId`, `savedAt`, `metadata` |
| `party` | `activeSlot`, `slots`, `characterRecords` keyed by slot |
| `inventory` | `shared` |
| `encounter` | `activeEncounterId`, `activeScenarioId`, `state`, `lastOutcome` |
| `world` | `flags`, `visitedAreas`, `location` |
| `rests` | `shortRestsUsed`, `hungryStreak` keyed by character slot |

Current actor persistence is player-character-specific. There is no equivalent persisted companion record, enemy instance collection, or general `actorInstances` collection. Active encounter state is opaque and cloned without a defined actor-state schema.

## 7. Encounter actor references

Sources: `app/data/encounters.js`, `app/combat/encounterScenario.js`

Encounter enemy groups currently use:

- `enemyId`
- `count`
- Optional `defaults`
- Optional `instances`

Instance overrides currently include fields such as:

- `id`
- `name`
- `position`
- `hp`
- `speed`
- `masteredWeaponIds`

The encounter factory expands groups, combines defaults and instance overrides, then creates combat actors. Encounter records also carry `id`, `name`, `difficulty`, optional `battlefield`, and optional `storyFlags`.

## 8. Companion and NPC representations

There is no production companion or general NPC actor definition in the current data layer.

Combat test scenarios contain two temporary patterns:

- Hand-authored hero-side combat actors with minimal fields.
- Resolved character drafts converted through the player-character pipeline and relabelled as NPCs.

Neither currently models recruitment state, dialogue identity, faction, service role, persistent companion runtime, or save ownership.

## 9. Legacy actor-shaped data

These shapes are present but are not part of the active resolved-character-to-combat pipeline.

### Legacy player model

Source: `app/data/player.js`

Fields include `id`, `name`, `classId`, `class`, `level`, `xp`, `hp`, `maxHp`, `spellSlots`, `inventory`, `equipped`, `knownSpells`, `features`, `battlesWonThisLevel`, `sorceryPoints`, `metamagic`, and `metamagicPassive`, plus methods that directly mutate the object.

### Aya blueprint

Source: `app/data/characters/aya.json`

Fields include `id`, `name`, `class`, `subclass`, `level`, `xp`, abbreviated ability scores, `proficiencies`, embedded equipment records, `vitals`, `combat`, `inventory`, `quests`, `flags`, and `notes`.

This blueprint uses different nesting and naming from `CharacterDraft`, `ResolvedCharacterSheet`, and `CombatActor`.

## 10. Equivalent concepts with different names or shapes

| Concept | Current representations |
| --- | --- |
| Actor identity | `identity.characterName`; `name`; `id`; `sourceId`; character-record `id`; encounter-instance `id` |
| Actor category/allegiance | `team`; `role`; `creatureType`; no general actor `kind` |
| Class | `identity.classId`/`className`; legacy `classId`/`class`; test `className` |
| Ability data | Draft numeric long names; resolved `{score, modifier, sources}` long names; combat abbreviated modifiers; Aya abbreviated scores |
| Saving throws | `proficiencies.savingThrows`; `combatBasics.saves`; combat/enemy `saves`; Aya `proficiencies.saves` |
| Armour class | `combatBasics.armorClass`; combat/enemy `ac`; Aya embedded equipment AC plus bonuses |
| Hit points | Resolved `durability.maxHp`; combat/runtime `hp`, `maxHp`, `tempHp`; Aya `vitals.*`; enemy source `hp` and `maxHp` |
| Movement | Resolved speed in feet; combat/enemy speed in squares; awareness uses ranges apparently in feet |
| Equipment | Draft `gear`; resolved `equipment` IDs; combat `equipment`; legacy `equipped`; Aya embedded records |
| Spells | Draft `spells`; resolved `spellcasting`; combat `spellSlots` plus compiled `actions`; legacy `knownSpells` |
| Features/actions | Resolved `features`, `featureHooks`, `attacks`; enemy `features`, `actionRefs`; combat compiled `actions`, `featureHooks` |
| Mutable resources | Resolved templates and combat/runtime arrays; spell slots use a separate keyed object |
| Runtime effects | Combat/runtime `conditions`, `activeEffects`, `marks`, `luck`; absent from authored character sheet |
| Inventory | Draft/resolved/runtime actor inventory plus `SaveGameState.inventory.shared`; item-entry validation is not owned by the actor contract |
| Position | Combat `position`; save-game world `location`; encounter instance `position`; no common map-aware actor location |
| Persistence version | Character record `version`; save `schemaVersion`; resolved sheet `metadata.resolverVersion` |

## 11. Initial findings

1. `CombatActor` is already the practical shared runtime contract, and the current combat contract report passes for enemy records and representative scenarios.
2. The authored definitions remain separate: player characters originate as choice-based drafts while enemies originate as direct stat blocks.
3. Definition data and instance state are not consistently separated. Enemy `hp`, generated combat actors, and stored character records all mix or duplicate the two layers.
4. Player saves store several complete representations of the same character. Enemies and companions have no equivalent general persistence model.
5. Units and naming need explicit normalization, especially ability names, armour class, movement/range, saving throws, equipment, and spell resources.
6. Companion and NPC requirements cannot be unified from production data yet because those production contracts do not exist.
7. The legacy player model and Aya blueprint should be explicitly migrated, adapted, or retired; they should not silently shape the new contract.

## Verification baseline

`node tools/report-combat-actor-contract.js` currently passes for all authored enemies and registered representative combat scenarios.
