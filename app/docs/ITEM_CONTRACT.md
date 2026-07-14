# Item Contract

This file locks the canonical item standard. It defines item records, inventory holdings, equipment, usable items, tools, quest items, requirements, targeting, and item state effects.

## Core Rules

- Every distinct item has one stable item definition and `id`.
- Identical copies are interchangeable. The game does not create per-copy item instances or instance IDs.
- If an item differs mechanically or narratively, it receives its own definition and item ID.
- Inventory stores an `itemId` and `quantity` only.
- An item is exactly one of `equipment`, `usable`, `tool`, or `quest`.
- An item cannot be both equippable and usable.
- Rarity is not part of the item contract.
- `loot` is not an item type. Items placed as rewards use whichever of the three item types describes what they actually are.

## Shared Item Shape

Every item definition provides:

- `id`: stable unique item identifier.
- `type`: `equipment`, `usable`, `tool`, or `quest`.
- `name`: player-facing name.
- `inspectText`: player-facing description shown when the item is inspected.
- `stackable`: whether one inventory holding can contain more than one copy.
- `maxStackSize`: maximum quantity in one holding; this must be `1` when `stackable` is `false`.

Inventory holdings have this shape:

```js
{
  itemId: "healing_potion",
  quantity: 3
}
```

`quantity` must be a positive whole number no greater than the referenced item's `maxStackSize`.

## Item Requirements

Equipment and usable items may declare:

```js
requirements: {
  classes: ["fighter", "paladin"],
  minimumLevel: 3
}
```

- `classes` is optional. When present, the character must belong to any one of the listed classes.
- `minimumLevel` is optional. When present, the character must be at least that level.
- When both are present, both requirements must be met.
- Omitted requirements impose no restriction.

## Equipment Items

Equipment items add:

- `allowedSlots`: one or more slots in which the item may be equipped.
- `requirements`: optional class and level requirements.
- `effects`: state effects that apply to the wearer while the item remains equipped.

The equipment slots are:

- `headwear`
- `armor`
- `ring-1`
- `ring-2`
- `weapon-set-1-hand-1`
- `weapon-set-1-hand-2`
- `weapon-set-2-hand-1`
- `weapon-set-2-hand-2`
- `boots`

A ring that can occupy either ring slot declares both `ring-1` and `ring-2`. A one-handed weapon or shield may declare all four hand slots. A two-handed weapon occupies both hands of whichever single weapon set receives it.

Equipment effects always target the wearer. Equipment does not declare a use target.

Characters cannot equip, unequip, or rearrange equipment during combat.

## Usable Items

Usable items add:

- `availability`: `combat`, `exploration`, `narrative`, `noncombat`, or `anywhere`.
- For non-scroll items, `targets`: one or more of `self`, `ally`, `enemy`, or `creature`.
- `requirements`: optional class and level requirements.
- Exactly one of:
  - `effects`: state effects resolved when the item is used.
  - `spellId`: an existing spell invoked by the item.
- `consumedOnUse`: whether one unit is removed from inventory after use.
- For non-scroll items available in combat, `combatCost`: `action`, `bonus-action`, or `reaction`.

Availability meanings:

- `combat`: available only during combat.
- `exploration`: available only through exploration play.
- `narrative`: available only through narrative play.
- `noncombat`: available during exploration and narrative play, but not combat.
- `anywhere`: available during combat, exploration, and narrative play.

Target meanings:

- `self`: the user only.
- `ally`: another allied character.
- `enemy`: an enemy, including the target of a thrown grenade-like potion.
- `creature`: any allied or enemy creature allowed by the situation.

An item may list both `self` and `ally`, as ordinary potions do. Its availability, requirements, and target rules must all permit a proposed use.

A spell scroll references the canonical spell by `spellId`; it does not copy the spell's effects into the item definition. The referenced spell owns its targeting and effects.

## Tool Items

Tools are retained inventory items that become useful when an exploration or narrative situation supports them. They are not directly activated from inventory and are not consumed.

Tool items add:

- `useHookId`: the contextual hook a situation may support.
- `requirements`: optional class and level requirements.

A situation with a matching hook may offer an interaction such as using thieves' tools on a locked door. The situation owns the check, outcome, and progression. Without a matching situation hook, a tool remains inspectable but provides no Use action.

## Quest Items

Quest items are collected but are neither equipped nor directly used by the player. They do not declare equipment slots, use targets, requirements, or state effects.

A quest item may be a component of a multipart key:

```js
{
  id: "northern_pass_map_fragment",
  type: "quest",
  name: "Northern Pass Map Fragment",
  inspectText: "A torn part of a route through the northern pass.",
  stackable: true,
  maxStackSize: 3,
  keyComponent: {
    keyId: "northern_pass_map"
  }
}
```

`keyComponent.keyId` identifies the multipart key to which the item contributes. Map fragments use this allowance.

The item does not decide when it is consumed or what it reveals. A situation that requires the multipart key declares the matching `keyId`, required component quantities, and the result of satisfying the requirement. When confronted, that situation checks the inventory and consumes the declared components in order to reveal the way forward.

## State Effects

Items reuse the shared character/combat identifiers for resources, stats, and conditions. Item-specific copies of those registries must not be created.

The shared item effect forms are:

```js
{ type: "change-resource", resource: "health", amountFormula: "2d4+2" }

{ type: "damage", damageFormula: "2d6", damageType: "acid" }

{ type: "add-condition", conditionId: "poisoned", duration: { rounds: 3 } }

{ type: "remove-condition", conditionId: "poisoned" }

{ type: "modify-stat", stat: "ac", amount: 2 }
```

- `change-resource` is immediate. It declares exactly one of a fixed `amount` or an `amountFormula`. Positive results restore or add; negative results reduce. A formula is rolled once when the effect resolves.
- `damage` is immediate. It declares exactly one of a fixed `damage` value or a `damageFormula`, plus a registered `damageType`.
- `add-condition` applies a registered condition. `duration` is optional and uses the combat condition-duration format.
- `remove-condition` immediately removes the registered condition.
- `modify-stat` changes a registered stat. On equipment, it remains active only while the item is equipped.
- Equipment effects implicitly target the wearer.
- Usable-item effects target the valid target selected under the item's `target` rule.

## Canonical Shapes

```ts
type ItemDefinition = EquipmentItem | UsableItem | ToolItem | QuestItem;

type ItemBase = {
  id: string;
  name: string;
  inspectText: string;
  stackable: boolean;
  maxStackSize: number;
};

type ItemRequirements = {
  classes?: CharacterClassId[];
  minimumLevel?: number;
};

type EquipmentSlot =
  | "headwear"
  | "armor"
  | "ring-1"
  | "ring-2"
  | "weapon-set-1-hand-1"
  | "weapon-set-1-hand-2"
  | "weapon-set-2-hand-1"
  | "weapon-set-2-hand-2"
  | "boots";

type EquipmentItem = ItemBase & {
  type: "equipment";
  allowedSlots: EquipmentSlot[];
  requirements?: ItemRequirements;
  effects: StateEffect[];
};

type UsableItem = ItemBase & {
  type: "usable";
  availability: "combat" | "exploration" | "narrative" | "noncombat" | "anywhere";
  requirements?: ItemRequirements;
  consumedOnUse: boolean;
} & (
  | {
      targets: ("self" | "ally" | "enemy" | "creature")[];
      effects: StateEffect[];
      combatCost?: "action" | "bonus-action" | "reaction";
      delivery?: ThrownDelivery;
      spellId?: never;
    }
  | {
      spellId: SpellId;
      targets?: never;
      effects?: never;
      combatCost?: never;
      delivery?: never;
    }
);

type ToolItem = ItemBase & {
  type: "tool";
  useHookId: string;
  requirements?: ItemRequirements;
};

type QuestItem = ItemBase & {
  type: "quest";
  keyComponent?: {
    keyId: string;
  };
};

type ItemHolding = {
  itemId: string;
  quantity: number;
};

type StateEffect =
  | ({ type: "change-resource"; resource: ResourceId } & (
      | { amount: number; amountFormula?: never }
      | { amountFormula: DiceFormula; amount?: never }
    ))
  | ({ type: "damage"; damageType: DamageTypeId } & (
      | { damage: number; damageFormula?: never }
      | { damageFormula: DiceFormula; damage?: never }
    ))
  | { type: "add-condition"; conditionId: ConditionId; duration?: EffectDuration }
  | { type: "remove-condition"; conditionId: ConditionId }
  | { type: "modify-stat"; stat: StatId; amount: number };
```

## Validation Invariants

- Item IDs are unique and stable.
- Item type is exactly `equipment`, `usable`, `tool`, or `quest`.
- Non-stackable items have `maxStackSize: 1`.
- Equipment declares at least one valid slot and cannot declare usable-item fields.
- Usable items declare an availability and exactly one of `effects` or `spellId`; non-scroll usable items also declare at least one target and a combat cost when available in combat.
- A usable item with thrown delivery follows the canonical `ThrownDelivery` shape in the Consumables contract.
- Tool items declare one `useHookId`; they cannot declare equipment fields, usable-item effects, spell IDs, targets, availability, or consumption behavior.
- Quest items cannot declare equipment fields, usable-item fields, requirements, or state effects.
- Every class, spell, resource, stat, and condition reference resolves to its canonical registry.
- Every formula uses the canonical dice-expression format.
- Resource-change and damage effects declare exactly one fixed value or formula.
- Every `keyComponent.keyId` used by a situation matches the relevant multipart-key requirement.
