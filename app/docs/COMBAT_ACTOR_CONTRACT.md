# Combat Actor Contract

Combat uses snapshot actors. A combat actor is not a player profile or an enemy source record. It is the resolved, encounter-ready shape consumed by the rules engine.

## Required Actor Fields

- `id`: unique instance id inside the scenario.
- `name`: display/log name.
- `team`: `heroes` or `enemies`.
- `hp`, `maxHp`, `ac`: numeric combat values.
- `speed`: movement in grid squares.
- `position`: `{ x, y }` grid position.
- `actions`: generated combat actions.
- `economy`: normalized turn economy; added by `normalizeCombatActor`.

## Optional Actor Surfaces

- `sourceId`: source data id for generated actors.
- `role`, `creatureType`, `tags`: tactical and narrative metadata.
- `saves`, `abilityMods`, `initiativeBonus`: roll inputs.
- `resources`: finite uses used by features, reactions, and actions.
- `features`, `featureHooks`: declarative class/species/enemy hooks.
- `activeEffects`, `conditions`, `marks`, `auras`: ongoing rules state.
- `inventory`, `equipment`: consumables and equipped/mastered weapons.
- `resistances`, `immunities`, `conditionImmunities`: damage and condition defenses.
- `ai`: encounter-local AI profile metadata.

## Required Action Rules

Actions must be generated through the relevant factory or mapper:

- Weapons: `createWeaponAction`.
- Natural attacks: `createNaturalWeaponAction`.
- Compound mastery attacks: `createNickAttackAction`.
- Spells: `createSpellAction`.
- Consumables: `createConsumableAction`.
- Feature actions: resolved from declarative feature data.

Manual action construction is valid only in narrow unit-test fixtures. Scenario and data bridges should use factories.

## Source Boundaries

- Character draft -> resolved sheet -> combat actor.
- Enemy source record -> combat actor.
- Encounter source record -> scenario actor instances.

Combat should not read character drafts, profiles, or enemy source records after the snapshot is created.
