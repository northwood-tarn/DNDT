// app/data/consumables.js
// Consumable and limited-use gear registry.
//
// Resolver-facing rule:
// - Top-level fields stay stable for inventory/UI compatibility.
// - Structured combat metadata belongs in `combat`.
// - Unsupported combat kinds are valid data, but require a resolver before use.

const legacyConsumableRecords = [
  {
    id: "rope_50_ft",
    name: "Rope (50 ft)",
    type: "utility",
    uses: "infinite",
    useTime: "exploration",
    value: 1,
    consumeOnUse: false,
    combat: { kind: "utility" },
    description: "A sturdy length of hemp rope for climbing and securing."
  },
  {
    id: "healing_potion",
    name: "Healing Potion",
    type: "potion",
    uses: 1,
    useTime: "bonus",
    effect: "Restores 2d4 + 2 HP",
    value: 50,
    consumeOnUse: true,
    combat: { kind: "healing", target: "self", healing: "2d4+2" },
    description: "The red liquid in this vial heartens you even when you just look at it."
  },
  {
    id: "greater_healing_potion",
    name: "Greater Healing Potion",
    type: "potion",
    uses: 1,
    useTime: "bonus",
    effect: "Restores 4d4 + 4 HP",
    value: 100,
    consumeOnUse: true,
    combat: { kind: "healing", target: "self", healing: "4d4+4" },
    description: "A stronger restorative potion."
  },
  {
    id: "superior_healing_potion",
    name: "Superior Healing Potion",
    type: "potion",
    uses: 1,
    useTime: "bonus",
    effect: "Restores 8d4 + 8 HP",
    value: 500,
    consumeOnUse: true,
    combat: { kind: "healing", target: "self", healing: "8d4+8" },
    description: "A potent restorative potion for serious wounds."
  },
  {
    id: "supreme_healing_potion",
    name: "Supreme Healing Potion",
    type: "potion",
    uses: 1,
    useTime: "bonus",
    effect: "Restores 10d4 + 20 HP",
    value: 5000,
    consumeOnUse: true,
    combat: { kind: "healing", target: "self", healing: "10d4+20" },
    description: "A rare restorative potion of exceptional strength."
  },
  {
    id: "antitoxin",
    name: "Antitoxin",
    type: "remedy",
    uses: 1,
    useTime: "action",
    effect: "Grants advantage on saving throws against poison for 1 hour.",
    value: 50,
    consumeOnUse: true,
    combat: {
      kind: "condition_defense",
      target: "self",
      durationRounds: 600,
      advantageOnSaves: ["poison"]
    },
    description: "A bitter draught used to resist poison."
  },
  {
    id: "acid_vial",
    name: "Acid Vial",
    type: "alchemical",
    uses: 1,
    useTime: "action",
    effect: "Thrown vial; one target within 20 ft takes 2d6 acid damage on hit.",
    value: 25,
    consumeOnUse: true,
    combat: { kind: "thrown_damage", rangeFt: 20, damage: "2d6", damageType: "acid" },
    description: "A stoppered vial of corrosive acid."
  },
  {
    id: "alchemists_fire",
    name: "Alchemist's Fire",
    type: "alchemical",
    uses: 1,
    useTime: "action",
    effect: "Thrown flask; one target within 20 ft takes ongoing fire damage until extinguished.",
    value: 50,
    consumeOnUse: true,
    combat: {
      kind: "thrown_ongoing_damage",
      rangeFt: 20,
      damage: "1d4",
      damageType: "fire",
      repeatTrigger: "turn_start",
      endCondition: "extinguish_action"
    },
    description: "A sticky burning fluid that ignites on impact."
  },
  {
    id: "holy_water",
    name: "Holy Water",
    type: "alchemical",
    uses: 1,
    useTime: "action",
    effect: "Thrown flask; an undead or fiend within 20 ft takes 2d6 radiant damage on hit.",
    value: 25,
    consumeOnUse: true,
    combat: {
      kind: "thrown_damage",
      rangeFt: 20,
      damage: "2d6",
      damageType: "radiant",
      targetTags: ["undead", "fiend"]
    },
    description: "Water blessed for use against undead and fiends."
  },
  {
    id: "oil_flask",
    name: "Oil Flask",
    type: "alchemical",
    uses: 1,
    useTime: "action",
    effect: "Can coat a creature or 5 ft square; ignited oil burns for 2 rounds.",
    value: 1,
    consumeOnUse: true,
    combat: {
      kind: "flammable_oil",
      rangeFt: 20,
      area: { shape: "square", sizeFt: 5 },
      ignitedDamage: "5",
      damageType: "fire",
      durationRounds: 2
    },
    description: "A flask of oil for lamps, fire, or battlefield preparation."
  },
  {
    id: "caltrops",
    name: "Caltrops",
    type: "deployable",
    uses: 1,
    useTime: "action",
    effect: "Covers a 5 ft square; creatures entering risk piercing damage and reduced speed.",
    value: 1,
    consumeOnUse: true,
    combat: {
      kind: "deployable_hazard",
      area: { shape: "square", sizeFt: 5 },
      save: { ability: "dex", dc: 15 },
      damage: "1",
      damageType: "piercing",
      movementEffect: { speedReductionFt: 10, untilHealed: true }
    },
    description: "A pouch of small spikes scattered to slow pursuit."
  },
  {
    id: "ball_bearings",
    name: "Ball Bearings",
    type: "deployable",
    uses: 1,
    useTime: "action",
    effect: "Covers a 10 ft square; creatures moving through risk falling prone.",
    value: 1,
    consumeOnUse: true,
    combat: {
      kind: "deployable_hazard",
      area: { shape: "square", sizeFt: 10 },
      save: { ability: "dex", dc: 10 },
      condition: "prone"
    },
    description: "A bag of small metal balls used to make footing treacherous."
  },
  {
    id: "hunting_trap",
    name: "Hunting Trap",
    type: "deployable",
    uses: 1,
    useTime: "action",
    effect: "A sprung trap deals 1d4 piercing damage and stops the target until freed.",
    value: 5,
    consumeOnUse: false,
    combat: {
      kind: "deployable_trap",
      save: { ability: "dex", dc: 13 },
      damage: "1d4",
      damageType: "piercing",
      condition: "grappled",
      escape: { ability: "str", dc: 13 }
    },
    description: "A saw-toothed steel trap fixed by a chain."
  },
  {
    id: "basic_poison",
    name: "Basic Poison",
    type: "poison",
    uses: 1,
    useTime: "action",
    effect: "Coats one weapon or three pieces of ammunition; hit targets must save or take 1d4 poison damage.",
    value: 100,
    consumeOnUse: true,
    combat: {
      kind: "weapon_coating",
      durationRounds: 10,
      maxHits: 1,
      save: { ability: "con", dc: 10 },
      damage: "1d4",
      damageType: "poison"
    },
    description: "A simple injury poison for blades and ammunition."
  },
  {
    id: "healers_kit",
    name: "Healer's Kit",
    type: "kit",
    uses: 10,
    useTime: "action",
    effect: "Spend one use to stabilize a dying creature without a medicine check.",
    value: 5,
    consumeOnUse: true,
    combat: { kind: "stabilize", target: "creature", usesPerAction: 1 },
    description: "Bandages, salves, and splints for emergency care."
  },
  {
    id: "map_fragment",
    name: "Map Fragment",
    type: "unique",
    uses: "infinite",
    useTime: "exploration",
    consumeOnUse: false,
    combat: { kind: "utility" },
    description: "A collection of weird drawings, hints, and fantasies about treasure."
  },
  {
    id: "fire_granado",
    name: "Fire Granado",
    type: "bomb",
    uses: 1,
    useTime: "action",
    effect: "Explodes in a 5 ft radius; creatures take 2d6 fire damage (DEX save for half).",
    value: 50,
    consumeOnUse: true,
    combat: {
      kind: "area_damage",
      rangeFt: 20,
      area: { shape: "radius", radiusFt: 5 },
      save: { ability: "dex", dc: 13, onSave: "half" },
      damage: "2d6",
      damageType: "fire"
    },
    description: "If a colour could sizzle silently, it would be the colour of this."
  },
  {
    id: "smoke_jar",
    name: "Smoke Jar",
    type: "bomb",
    uses: 1,
    useTime: "action",
    effect: "Creates a 10 ft radius smoke cloud that heavily obscures the area for 1d4 rounds.",
    value: 25,
    consumeOnUse: true,
    combat: {
      kind: "obscuring_area",
      rangeFt: 20,
      area: { shape: "radius", radiusFt: 10 },
      duration: "1d4",
      obscures: "heavy"
    },
    description: "A clay orb whose outline lazily shifts."
  },
  {
    id: "lightning_paper",
    name: "Lightning Paper",
    type: "coating",
    uses: 1,
    useTime: "bonus",
    effect: "Rub on a weapon as a bonus action; weapon deals +1d6 lightning damage on each hit for 2 rounds.",
    value: 100,
    consumeOnUse: true,
    combat: {
      kind: "weapon_damage_buff",
      durationRounds: 2,
      bonusDamage: "1d6",
      damageType: "lightning"
    },
    description: "This paper is storm incarnate."
  },
  {
    id: "greater_lightning_paper",
    name: "Greater Lightning Paper",
    type: "coating",
    uses: 1,
    useTime: "bonus",
    effect: "Rub on a weapon as a bonus action; weapon deals +1d6 lightning damage on each hit for 6 rounds.",
    value: 250,
    consumeOnUse: true,
    combat: {
      kind: "weapon_damage_buff",
      durationRounds: 6,
      bonusDamage: "1d6",
      damageType: "lightning"
    },
    description: "The stack of papers you keep this sheathed in writhes in pain."
  },

  // === Aya starting gear support (dev save slot 99) ===
  {
    id: "crowbar",
    name: "Crowbar",
    type: "utility",
    uses: "infinite",
    useTime: "exploration",
    value: 2,
    consumeOnUse: false,
    combat: { kind: "utility" },
    description: "A heavy iron bar used for prying and leverage."
  },
  {
    id: "hammer",
    name: "Hammer",
    type: "utility",
    uses: "infinite",
    useTime: "exploration",
    value: 1,
    consumeOnUse: false,
    combat: { kind: "utility" },
    description: "A simple hammer suited for driving spikes and breaking stone."
  },
  {
    id: "tinderbox",
    name: "Tinderbox",
    type: "utility",
    uses: "infinite",
    useTime: "exploration",
    value: 1,
    consumeOnUse: false,
    combat: { kind: "utility" },
    description: "Flint and steel for reliably starting a fire."
  },
  {
    id: "ration",
    name: "Rations",
    type: "ration",
    uses: "per_quantity",
    useTime: "exploration",
    value: 1,
    consumeOnUse: true,
    combat: { kind: "utility" },
    description: "Preserved food sufficient for a day of travel."
  },
  {
    id: "waterskin",
    name: "Waterskin",
    type: "utility",
    uses: "infinite",
    useTime: "exploration",
    value: 1,
    consumeOnUse: false,
    combat: { kind: "utility" },
    description: "A leather flask used to carry drinking water."
  }
];

const TOOL_IDS = new Set(["rope_50_ft", "crowbar", "hammer", "tinderbox", "waterskin"]);
const QUEST_IDS = new Set(["map_fragment"]);
const EXCLUDED_IDS = new Set(["ration"]);
const HEALING_KINDS = new Set(["healing"]);
const THROWN_ATTACK_KINDS = new Set(["thrown_damage", "thrown_ongoing_damage"]);
const THROWN_SAVE_KINDS = new Set(["area_damage"]);
const SELF_EFFECT_KINDS = new Set(["condition_defense", "weapon_coating", "weapon_damage_buff"]);

export const consumables = legacyConsumableRecords
  .filter((record) => !EXCLUDED_IDS.has(record.id))
  .map(toCanonicalItemRecord);

function toCanonicalItemRecord(record) {
  if (TOOL_IDS.has(record.id)) {
    return {
      id: record.id,
      type: "tool",
      name: record.name,
      inspectText: record.description,
      stackable: false,
      maxStackSize: 1,
      useHookId: record.id,
      value: record.value,
    };
  }
  if (QUEST_IDS.has(record.id)) {
    return {
      id: record.id,
      type: "quest",
      name: record.name,
      inspectText: record.description,
      stackable: true,
      maxStackSize: 99,
      keyComponent: { keyId: "map_fragments" },
    };
  }

  const runtime = structuredClone(record.combat || {});
  const canonical = {
    id: record.id,
    type: "usable",
    name: record.name,
    inspectText: record.description,
    stackable: record.id !== "hunting_trap",
    maxStackSize: record.id === "hunting_trap" ? 1 : 10,
    availability: HEALING_KINDS.has(runtime.kind) || runtime.kind === "condition_defense" ? "anywhere" : "combat",
    targets: canonicalTargets(runtime.kind),
    consumedOnUse: record.consumeOnUse !== false,
    combatCost: canonicalCombatCost(record.useTime),
    effects: canonicalEffects(runtime),
    value: record.value,
    runtime,
  };
  const delivery = canonicalDelivery(runtime);
  if (delivery) canonical.delivery = delivery;
  return canonical;
}

function canonicalTargets(kind) {
  if (HEALING_KINDS.has(kind) || kind === "condition_defense") return ["self", "ally"];
  if (SELF_EFFECT_KINDS.has(kind)) return ["self"];
  if (kind === "stabilize") return ["ally"];
  return ["enemy"];
}

function canonicalCombatCost(useTime) {
  if (useTime === "bonus" || useTime === "bonus_action") return "bonus-action";
  if (useTime === "reaction") return "reaction";
  return "action";
}

function canonicalEffects(runtime) {
  if (runtime.kind === "healing") {
    return [{ type: "change-resource", resource: "health", amountFormula: runtime.healing }];
  }
  if (runtime.kind === "thrown_damage" || runtime.kind === "area_damage") {
    return [{ type: "damage", damageFormula: runtime.damage, damageType: runtime.damageType }];
  }
  if (runtime.kind === "thrown_ongoing_damage") {
    return [{ type: "add-condition", conditionId: "burning" }];
  }
  return [];
}

function canonicalDelivery(runtime) {
  if (THROWN_ATTACK_KINDS.has(runtime.kind)) {
    return {
      kind: "thrown",
      range: feetToSquares(runtime.rangeFt || 20),
      resolution: {
        type: "attack",
        ability: "dexterity",
        addProficiency: true,
      },
    };
  }
  if (THROWN_SAVE_KINDS.has(runtime.kind)) {
    return {
      kind: "thrown",
      range: feetToSquares(runtime.rangeFt || 20),
      resolution: {
        type: "save",
        ability: expandAbility(runtime.save?.ability || "dex"),
        dc: runtime.save?.dc || 10,
        onSuccess: runtime.save?.onSave === "half" ? "half" : "none",
      },
      area: {
        shape: runtime.area?.shape || "radius",
        size: feetToSquares(runtime.area?.radiusFt || runtime.area?.sizeFt || 5),
      },
    };
  }
  return null;
}

function expandAbility(ability) {
  return ({ str: "strength", dex: "dexterity", con: "constitution", int: "intelligence", wis: "wisdom", cha: "charisma" })[ability] || ability;
}

function feetToSquares(feet) {
  return Math.max(1, Math.ceil(Number(feet) / 5));
}

export function getConsumableById(id){
  return consumables.find(c => c.id === id) || null;
}
