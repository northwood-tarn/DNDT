# Equipment Contract

This file locks the canonical equipment standard. It defines loadouts, equip eligibility, proficiencies, slot occupancy, derived actor values, and the combat actions granted by equipped weapons.

The canonical item definition and inventory shapes remain in `app/docs/ITEM_CONTRACT.md`. Equipment applies those definitions to a character; it does not create a second item model.

## Core Rules

- Equipment is the character's current loadout of equipped item IDs.
- Equipment never changes a character's base data permanently.
- The runtime derives a fresh actor view from the character and current valid loadout.
- A character may equip an item only when proficient with it and when all of its class and level requirements are met.
- Proficiency and item requirements are hard gates. Non-proficient or otherwise ineligible equipment cannot be equipped or used.
- Invalid equipment is absent from equipment selection lists and is not a valid drag-and-drop target.
- Equipment cannot be equipped, unequipped, moved, or rearranged during combat.
- Inventory has no capacity limit.
- If equipped gear becomes invalid, it is immediately unequipped and returned to inventory.
- Equipping an item into an occupied slot first returns the displaced item to inventory.
- Accessories have no separate subsystem. Headwear, rings, and boots operate through their equipped effects.

## Equipment Slots

Every character loadout has these slots:

- `headwear`
- `armor`
- `ring-1`
- `ring-2`
- `weapon-set-1-hand-1`
- `weapon-set-1-hand-2`
- `weapon-set-2-hand-1`
- `weapon-set-2-hand-2`
- `boots`

The Equipment panel also exposes three readied-consumable slots beneath the weapon sets:

- `consumable-1`
- `consumable-2`
- `consumable-3`

Each consumable slot holds up to three units of one eligible consumable. Multiple slots may hold the same consumable. Only consumables placed in these slots are available during combat. Saboteur devices remain separate subclass resources and never occupy these slots.

An empty slot contains `null`.

Weapons and shields occupy the four hand slots arranged as two weapon sets. A shield does not have a separate equipment slot. Torches and other held utility objects are not equipment and do not occupy these slots.

## Loadout Shape

```ts
type EquipmentLoadout = {
  headwear: ItemId | null;
  armor: ItemId | null;
  "ring-1": ItemId | null;
  "ring-2": ItemId | null;
  "weapon-set-1-hand-1": ItemId | null;
  "weapon-set-1-hand-2": ItemId | null;
  "weapon-set-2-hand-1": ItemId | null;
  "weapon-set-2-hand-2": ItemId | null;
  boots: ItemId | null;
};
```

The loadout stores item IDs only. The referenced item definitions own names, inspect text, requirements, effects, weapon rules, armour rules, and other mechanics.

## Companion Equipment

Companions are authored characters, not secondary player-character equipment shells. The player does not replace or rearrange a companion's weapons, armour, headwear, boots, or other signature gear.

Only the following companion slots are exposed to the player, and they may be changed only at an ember:

- `ring-1`
- `ring-2`
- `consumable-1`
- `consumable-2`
- `consumable-3`

Companion consumable slots follow the standard rule: each holds up to three units of one eligible consumable, and multiple slots may hold the same consumable.

Each companion retains a fixed signature weapon type and fighting style. Signature weapons advance automatically with campaign progression rather than through player equipment choice:

- Act I: standard signature weapon.
- Necropolis: `+1` signature weapon with a small elemental bonus.
- Backlands: `+2` signature weapon with a second bonus.

Each companion's armour is also fixed. It receives an authored improvement at that companion's designated signature narrative moment. Armour advancement is caused by that story event, not by act transition, loot, inventory selection, or player choice.

## Equip Eligibility

An item is eligible for a slot only when all of the following are true:

1. The item exists and has `type: "equipment"`.
2. The slot appears in the item's `allowedSlots`.
3. The character has every proficiency required by the item.
4. The character meets the item's class requirement, when present.
5. The character meets the item's minimum-level requirement, when present.
6. Equipping it would not violate any occupancy rule, including two-handed weapon occupancy.
7. The character is not in combat.

When an item lists multiple eligible classes, belonging to any one listed class satisfies the class requirement. Class, level, and proficiency gates all apply independently.

The interface exposes only eligible choices for a slot. Drag-and-drop accepts only eligible equipment; an invalid item cannot be dropped and then rejected after the fact.

Every equipment-slot field supports both canonical selection paths:

- A compatible item may be dragged from Inventory and dropped directly onto the field.
- Clicking the field opens a dropdown list drawn from the character's current inventory and filtered to items eligible for that exact slot.
- The dropdown does not show incompatible, unavailable, or non-proficient items.
- Both paths invoke the same equip operation and validation rules; neither path mutates the presentation directly.

## Proficiencies

Equipment definitions declare the proficiency or proficiencies they require. These references use the character contract's canonical proficiency identifiers.

```ts
type EquipmentProficiencyRequirement = {
  proficiencies: ProficiencyId[];
};
```

Proficiency is a hard gate for every equippable item, including weapons, armour, shields, headwear, rings, and boots when those items declare a proficiency requirement.

- A non-proficient weapon cannot be equipped and grants no attack action.
- Non-proficient armour or accessories cannot be equipped and grant no effects.
- Proficiency does not replace class or level requirements; all applicable gates must pass.

## Slot Occupancy

### Ordinary equipment

An ordinary item occupies one selected slot from its `allowedSlots`.

A ring may allow both ring slots, but one copy occupies only the selected slot. A one-handed weapon or shield may allow any hand slot, but one copy occupies only the selected hand slot in one weapon set.

### Two-handed weapons

A two-handed weapon occupies both hand slots of one weapon set simultaneously. Both slots in that set reference the same item ID for occupancy purposes, but the loadout represents one equipped item, not two copies.

Equipping a two-handed weapon returns the items previously occupying either hand of the selected set to inventory. A one-handed weapon or shield cannot be equipped into either hand of that set while a two-handed weapon occupies both. The other weapon set is unaffected.

### Shields

A shield occupies one hand slot in one weapon set. A one-handed weapon and a shield may therefore occupy the two hands of the same set. A shield is subject to its own proficiency and item requirements.

## Equipment Changes

Equipment changes are permitted only outside combat.

An equip operation:

1. Confirms that the requested slot and item are eligible.
2. Determines every slot the item must occupy.
3. Returns displaced equipment to inventory.
4. Removes one unit of the equipped item from inventory.
5. Writes the resulting loadout.
6. Re-derives the actor view.

An unequip operation:

1. Clears every slot occupied by that item, including both hands of one weapon set for a two-handed weapon.
2. Returns one unit of the item to inventory.
3. Re-derives the actor view.

Equipping the same item ID in two independent slots requires two inventory units. The shared ID used by a two-handed weapon across both hand slots of one weapon set is the explicit exception and represents one unit.

## Invalid Loadout Recovery

A loadout must be revalidated whenever relevant character state or referenced item data changes, including class, level, proficiencies, or item requirements.

If an equipped item is no longer eligible:

- It is immediately removed from every slot it occupies.
- One unit is returned to inventory.
- Its equipped effects and granted actions end immediately.
- The actor view is re-derived from the remaining valid loadout.

Inventory capacity cannot block this recovery because inventory has no capacity limit.

Invalid or missing item references in saved data are cleared during loadout validation. A missing definition cannot be returned as a usable inventory holding and must be reported as invalid saved data.

## Equipment Effects and Derived Values

Equipment effects reuse the shared state-effect format defined by the Item contract and the canonical identifiers owned by the character and combat contracts.

- Equipment effects implicitly target the wearer.
- Effects begin when the valid item is equipped.
- Effects end when the item is unequipped or becomes invalid.
- Base character data is never overwritten by equipment.
- Derived actor values are recalculated from base character data plus all currently valid equipment effects.

Derived values include, when affected by equipment:

- Armour Class
- attack values
- damage values
- saving throws
- movement speed
- resources and limits
- conditions or immunities represented by registered effects
- available combat actions

The character and combat contracts own the canonical calculation rules for these values. The equipment system supplies validated equipment contributions and applies them in the order required by those contracts; it does not create competing formulas.

## Armour and Shields

Armour records provide the data required by the canonical Armour Class calculation, including any base AC, Dexterity contribution rule, or other registered modifier.

Shields contribute their registered equipped effects, normally an AC modifier.

The actor's Armour Class is always derived from the currently valid armour, shield, other equipment effects, and applicable character features. Equipping or removing armour never writes a permanent AC value onto the character.

## Weapons and Combat Actions

Each valid equipped weapon independently grants its canonical weapon attack option.

Weapon records provide the combat data needed to generate that option, including:

- damage
- damage type
- melee reach or ranged distance
- one-handed or two-handed occupancy
- relevant weapon properties
- mastery property, when present
- the unambiguous attack and damage values required by the simplified weapon rules

Weapon-to-ability ambiguity is not resolved dynamically by Equipment. Weapon definitions and the simplified weapon rules must provide one unambiguous result.

Equipping two weapons does not automatically combine their attacks. Each appears as an available attack, and the combat action economy determines which attacks may be made.

An unequipped, invalid, or non-proficient weapon grants no weapon attack action.

## Two-Weapon and Light-Weapon Rules

When two valid equipped weapons satisfy the Light-weapon rule:

- Taking the Attack action and attacking with one Light weapon unlocks one extra attack later that turn with the other Light weapon.
- The extra attack normally costs a Bonus Action.
- The extra attack does not add the attack ability modifier to its damage unless that modifier is negative.
- The Nick mastery moves that extra Light-weapon attack into the Attack action instead of consuming the Bonus Action. It does not grant an additional Light-weapon attack.
- The Two-Weapon Fighting feature allows the attack ability modifier to be added to the extra attack's damage.

The combat system owns turn economy, attack sequencing, once-per-turn enforcement, Nick resolution, and Two-Weapon Fighting resolution. Equipment supplies the two validated equipped weapon records and their granted attack options.

## Canonical Equipment Result

Equipment resolution produces a validated result for the character-to-actor bridge:

```ts
type ResolvedEquipment = {
  loadout: EquipmentLoadout;
  equippedItems: EquipmentItemDefinition[];
  effects: StateEffect[];
  weaponActions: CombatAction[];
  invalidEntries: InvalidEquipmentEntry[];
};
```

`invalidEntries` reports malformed or missing saved references. Ordinary ineligible choices do not enter the loadout because the selection and drop interfaces exclude them.

## Validation Invariants

- Every non-null loadout ID resolves to an equipment item definition.
- Every equipped item is allowed in each slot it occupies.
- Every equipped item passes proficiency, class, and level gates.
- Hand slots contain weapons or shields only.
- A shield occupies one hand slot; it has no separate shield slot.
- A two-handed weapon occupies both hands of one weapon set and represents one item unit.
- Independently repeated item IDs represent separate inventory units unless they are the two hand-slot references of one two-handed weapon in the same set.
- No equipment mutation succeeds during combat.
- Invalid equipped items return to inventory immediately when eligibility changes.
- Every active equipment effect comes from a currently valid equipped item.
- Every granted weapon action comes from a currently valid, proficient, equipped weapon.
- Derived actor values can be reproduced from base character data and the current valid loadout.
