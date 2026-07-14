# Consumables Contract

This file locks the canonical rules for potions, thrown consumables, spell scrolls, contextual tools, stack consumption, restrictions, and combat or noncombat use.

The canonical item definitions, inventory holdings, requirements, targets, availability values, and state effects remain in `app/docs/ITEM_CONTRACT.md`. This contract defines how those records are offered and resolved at runtime.

## Scope

This system supports:

- potions used on the user or an ally
- thrown consumables used against enemies
- spell scrolls that invoke canonical spells
- reusable tools offered by matching exploration or narrative situations
- stack counts and consumption
- class and level requirements
- combat action-economy costs

This system does not support food or travel supplies. Lanterna oil is not a consumable under this contract; it is reserved for its own countdown/resource system.

## Core Rules

- Consumable state is represented by ordinary inventory holdings: `itemId` and `quantity`.
- Identical consumables are interchangeable and use the Item contract's stack rules.
- A use must pass availability, target, inventory, and requirement checks before it can be committed.
- Cancelling before commitment spends neither the item nor an action-economy cost.
- Once a valid use is committed, its cost is paid even when an attack misses, a save succeeds, or the intended effect otherwise fails.
- Consuming an item subtracts one from its holding. A holding is removed when its quantity reaches zero.
- Tools are contextual inventory items, not directly activated consumables, and are never consumed.
- No consumable or tool definition contains bespoke story logic. Situations own contextual outcomes.

## Availability

Usable items declare one availability:

- `combat`: only during combat.
- `exploration`: only through exploration play.
- `narrative`: only through narrative play.
- `noncombat`: during exploration and narrative play, but not combat.
- `anywhere`: during combat, exploration, and narrative play.

The current mode must satisfy the item's availability before Use is offered.

Tools do not declare availability. They are considered only by exploration and narrative situations with a matching contextual hook and are never offered during combat.

## Targets

Usable items declare one or more allowed targets:

- `self`: the character using the item.
- `ally`: another allied character.
- `enemy`: an enemy.
- `creature`: any allied or enemy creature allowed by the current mode.

Ordinary potions use `targets: ["self", "ally"]`. They are not used against enemies.

Thrown grenade-like consumables use `targets: ["enemy"]`.

Spell scrolls inherit targeting from their referenced spell. A scroll record may omit its own `targets`; the spell's target contract is authoritative.

## Potions

A potion:

- has `type: "usable"`
- is consumed on use
- targets `self`, `ally`, or both
- resolves its declared state effects
- declares where it is available
- declares its combat cost when combat use is allowed

```js
{
  id: "healing_potion",
  type: "usable",
  name: "Healing Potion",
  inspectText: "A restorative red liquid.",
  stackable: true,
  maxStackSize: 10,
  availability: "anywhere",
  targets: ["self", "ally"],
  consumedOnUse: true,
  combatCost: "bonus-action",
  effects: [
    { type: "change-resource", resource: "health", amountFormula: "2d4+2" }
  ]
}
```

The exact effects and combat cost belong to each potion definition. A resource change declares exactly one fixed `amount` or dice `amountFormula`. A formula is rolled once when the effect resolves.

## Thrown Consumables

A thrown consumable:

- has `type: "usable"`
- is consumed once its use is committed
- targets an enemy
- declares a `delivery` block containing range, attack-or-save resolution, and optional area
- pays its combat cost even if it misses or the target resists the effect

Thrown items do not occupy weapon slots and do not become equipped weapons. Their action exists only while at least one unit remains in inventory and the character satisfies all requirements.

### Thrown delivery

Every thrown consumable declares:

```ts
type ThrownDelivery = {
  kind: "thrown";
  range: number;
  resolution: ThrownAttackResolution | ThrownSaveResolution;
  area?: ThrownArea;
};

type ThrownAttackResolution = {
  type: "attack";
  ability: AbilityId;
  addProficiency: boolean;
};

type ThrownSaveResolution = {
  type: "save";
  ability: AbilityId;
  dc: number;
  onSuccess: "none" | "half";
};

type ThrownArea = {
  shape: "radius" | "cone" | "line";
  size: number;
};
```

- `range` is measured in combat-grid squares.
- An attack resolution explicitly declares the character ability used to derive the attack bonus and whether proficiency is added.
- A save resolution explicitly declares the target's saving-throw ability, save DC, and whether success negates or halves the effect.
- `area` is omitted for a single-target item.
- When present, `area` describes the affected shape and its size in combat-grid squares.
- The item definition owns the delivery and payload data.
- Combat owns positioning, line/range checks, legal target selection, attack and save rolls, area membership, effect application, and logging.

An attack-roll example:

```js
{
  id: "acid_vial",
  type: "usable",
  name: "Acid Vial",
  inspectText: "A stoppered vial of corrosive acid.",
  stackable: true,
  maxStackSize: 10,
  availability: "combat",
  targets: ["enemy"],
  consumedOnUse: true,
  combatCost: "action",
  delivery: {
    kind: "thrown",
    range: 4,
    resolution: {
      type: "attack",
      ability: "dexterity",
      addProficiency: true
    }
  },
  effects: [
    { type: "damage", damageFormula: "2d6", damageType: "acid" }
  ]
}
```

An area save example:

```js
{
  id: "fire_bomb",
  type: "usable",
  name: "Fire Bomb",
  inspectText: "A fragile vessel filled with an explosive mixture.",
  stackable: true,
  maxStackSize: 10,
  availability: "combat",
  targets: ["enemy"],
  consumedOnUse: true,
  combatCost: "action",
  delivery: {
    kind: "thrown",
    range: 4,
    resolution: {
      type: "save",
      ability: "dexterity",
      dc: 13,
      onSuccess: "half"
    },
    area: {
      shape: "radius",
      size: 2
    }
  },
  effects: [
    { type: "damage", damageFormula: "3d6", damageType: "fire" }
  ]
}
```

Damage effects declare exactly one fixed `damage` value or dice `damageFormula`. The formula is rolled when the effect resolves.

## Spell Scrolls

A spell scroll:

- has `type: "usable"`
- references one canonical `spellId`
- does not duplicate the spell's effects, targeting, range, or action-economy cost
- inherits those rules from the referenced spell
- may declare class and minimum-level requirements
- consumes one scroll when a valid cast is committed

```js
{
  id: "scroll_of_fireball",
  type: "usable",
  name: "Scroll of Fireball",
  inspectText: "A spell written in heat-scarred script.",
  stackable: true,
  maxStackSize: 10,
  availability: "anywhere",
  consumedOnUse: true,
  requirements: {
    classes: ["wizard"],
    minimumLevel: 5
  },
  spellId: "fireball"
}
```

The scroll is not committed until spell targeting and all other required cast choices are valid. After commitment, the scroll is consumed even if the spell misses, is resisted, or has no effect.

## Tools

A tool:

- has `type: "tool"`
- normally has `stackable: false` and `maxStackSize: 1`
- remains in inventory
- is never selected through a general Use action
- is never consumed
- declares a `useHookId`
- may declare class and level requirements

```js
{
  id: "thieves_tools",
  type: "tool",
  name: "Thieves' Tools",
  inspectText: "Picks and implements for defeating locks and traps.",
  stackable: false,
  maxStackSize: 1,
  useHookId: "thieves_tools"
}
```

An exploration or narrative situation may declare support for `thieves_tools`. When the character owns the tool and meets its requirements, that situation may offer an interaction such as opening a locked door.

The situation owns:

- whether the tool applies
- any ability or proficiency check
- the success and failure outcomes
- state or narrative changes
- whether another condition prevents the attempt

The tool definition owns none of those situation-specific rules.

## Requirements

Usable items and tools use the Item contract's requirements:

```ts
type ItemRequirements = {
  classes?: CharacterClassId[];
  minimumLevel?: number;
};
```

When both fields are present, both must pass. A list of classes means that any listed class satisfies the class requirement.

An ineligible item remains in inventory and can be inspected, but its Use action or contextual tool interaction is not offered.

## Combat Action Economy

Every non-scroll usable item available in combat declares one combat cost:

```ts
type ConsumableCombatCost = "action" | "bonus-action" | "reaction";

type ThrownDelivery = {
  kind: "thrown";
  range: number;
  resolution:
    | {
        type: "attack";
        ability: AbilityId;
        addProficiency: boolean;
      }
    | {
        type: "save";
        ability: AbilityId;
        dc: number;
        onSuccess: "none" | "half";
      };
  area?: {
    shape: "radius" | "cone" | "line";
    size: number;
  };
};
```

The action is available only when the actor has the required action-economy resource and every other use rule passes.

Spell scrolls inherit their cost from the referenced spell. They never declare a competing `combatCost`.

A reaction consumable must also declare or invoke a valid reaction trigger through the combat action contract. It cannot be activated freely merely because a Reaction remains available.

## Use Lifecycle

A usable-item attempt follows this order:

1. Resolve the item definition and inventory holding.
2. Confirm that quantity is at least one.
3. Confirm availability in the current mode.
4. Confirm class and level requirements.
5. Confirm that a valid target or required spell choice can be selected.
6. In combat, confirm the required action-economy resource and reaction trigger when applicable.
7. Allow the player to confirm or cancel.
8. On confirmation, commit the use and pay its action-economy cost.
9. If `consumedOnUse` is true, subtract one inventory unit.
10. Resolve the item effects or referenced spell.
11. Remove a zero-quantity holding.

Steps 8 and 9 occur before outcome resolution. A miss, successful enemy save, immunity, or ineffective result does not refund a committed item or action cost.

## Runtime Action Availability

Combat creates usable-item actions only for inventory holdings that:

- have positive quantity
- reference an item available in combat
- satisfy the actor's requirements
- have a valid combat cost or reference a valid spell

Exploration and narrative interfaces offer Use only for usable items available in the current mode.

Tools are discovered from the current situation's supported hook IDs, not from a global inventory Use list.

## Canonical Runtime Shapes

```ts
type UseAvailability =
  | "combat"
  | "exploration"
  | "narrative"
  | "noncombat"
  | "anywhere";

type ItemTarget = "self" | "ally" | "enemy" | "creature";

type ConsumableCombatCost = "action" | "bonus-action" | "reaction";

type ConsumableUseRequest = {
  actorId: ActorId;
  itemId: ItemId;
  targetId?: ActorId;
  situationId?: SituationId;
};

type ToolOpportunity = {
  situationId: SituationId;
  actorId: ActorId;
  itemId: ItemId;
  useHookId: string;
};
```

## Validation Invariants

- A usable item declares exactly one of `effects` or `spellId`.
- A non-scroll usable item declares at least one target.
- A scroll references an existing canonical spell and does not duplicate its targets, effects, range, or action cost.
- Every usable item declares one valid availability.
- Every non-scroll item available in combat declares one valid combat cost.
- A reaction-cost item has a valid reaction trigger.
- Every thrown consumable declares a valid `delivery` block.
- A thrown attack explicitly declares its attack ability and whether proficiency applies.
- A thrown save explicitly declares its save ability, DC, and successful-save result.
- Thrown range and area sizes are positive combat-grid square counts.
- Every resource-change and damage effect declares exactly one fixed value or dice formula.
- A committed consumed item always subtracts exactly one unit.
- A cancelled or invalid attempt consumes no item and no action-economy resource.
- A holding with quantity zero does not remain in inventory.
- A tool declares one contextual `useHookId`, is never directly activated, and is never consumed.
- Tools are offered only by matching exploration or narrative situation hooks.
- Food and travel supplies are outside this contract.
- Lanterna oil is outside this contract and must not be implemented as an ordinary consumable.
