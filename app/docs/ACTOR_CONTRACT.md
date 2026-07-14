# Shared Actor Contract

The shared actor architecture separates reusable authored facts from mutable campaign and encounter state.

## Layers

### ActorDefinition

An `ActorDefinition` describes what an actor is. It has a stable ID and contains identity, classification, presentation, base mechanics, capabilities, equipment, behaviour, rewards, and narrative references.

Definitions are immutable during play. Current canonical IDs use namespaces such as `enemy.goblin` and `character.aya`.

### ActorInstance

An `ActorInstance` describes one occurrence of a definition. It contains an instance ID, `definitionId`, team, position, mutable resources, inventory, conditions, effects, marks, and instance overrides.

Instances—not definitions—belong in save and encounter state.

### CombatActor

`CombatActor` remains the combat engine's resolved runtime view. A definition and instance resolve into this existing shape. This preserves the tested combat interface while preventing combat-specific fields from becoming the authored or saved source of truth.

## Canonical flow

`ActorDefinition + ActorInstance -> resolveActorToCombatActor() -> CombatActor`

After combat, mutable results are written back into the corresponding actor instance.

## Current migration

- All enemy records are exposed as canonical `enemy.*` definitions.
- Aya is exposed as `character.aya`.
- New character records contain `actorDefinition` and `actorInstance` alongside temporary compatibility mirrors.
- Version 1 character records are normalized into version 2 canonical records when loaded.
- Version 1 saves are normalized into save schema version 2 and gain `party.actorInstances`.
- Encounters expose `actorDefinitionId` instead of authored `enemyId`; expansion retains an `enemyId` compatibility alias for old callers.
- Every combat snapshot retrofits all actors—including hand-authored test/NPC actors—with a definition, instance, and contract reference.
- The legacy Aya bootstrap registers its definition and instance in global state, and legacy profile mutations synchronize HP and inventory into the instance.

## Compatibility fields

`CharacterRecord.combatActor`, `CharacterRecord.runtime`, legacy `state.player`, and expanded encounter `enemyId` remain temporarily available because existing UI and gameplay callers still consume them. They are derived or synchronized compatibility surfaces, not the intended long-term authority.

They can be removed after their consumers move to actor definitions/instances and save migration has shipped.

## Validation

- `validateActorDefinition()` validates canonical definitions.
- `validateActorInstance()` validates mutable instances and definition linkage.
- `resolveActorToCombatActor()` validates that canonical records produce a valid combat actor.
- `npm run validate:actors` checks the actor-definition registry.
- Character, state, combat, encounter, and combat-actor contract tests cover the migration boundaries.
