const legacyWeaponRecords = [
  {
    "name": "Shortsword",
    "description": "A quick, practical blade made for close quarters.",
    "uses": "infinite",
    "consumeOnUse": false,
    "useTime": "action",
    "type": "melee",
    "damage": "1d6",
    "properties": [
      "finesse",
      "light"
    ],
    "mastery": "vex",
    "value": 10,
    "id": "shortsword"
  },
  {
    "name": "Longsword",
    "description": "A balanced steel blade that rewards disciplined form.",
    "uses": "infinite",
    "consumeOnUse": false,
    "useTime": "action",
    "type": "melee",
    "damage": "1d8",
    "properties": [
      "versatile"
    ],
    "mastery": "sap",
    "value": 15,
    "id": "longsword"
  },
  {
    "name": "Greatsword",
    "description": "A heavy two-handed sword that ends arguments fast.",
    "uses": "infinite",
    "consumeOnUse": false,
    "useTime": "action",
    "type": "melee",
    "damage": "2d6",
    "properties": [
      "heavy",
      "two-handed"
    ],
    "mastery": "graze",
    "value": 50,
    "id": "greatsword"
  },
  {
    "name": "Maul",
    "description": "A massive two-handed hammer built to break armor and drive foes from their feet.",
    "uses": "infinite",
    "consumeOnUse": false,
    "useTime": "action",
    "type": "melee",
    "damage": "2d6",
    "properties": [
      "heavy",
      "two-handed"
    ],
    "mastery": "topple",
    "value": 10,
    "id": "maul"
  },
  {
    "name": "Glaive",
    "description": "A long-hafted cutting weapon whose reach keeps enemies at the edge of a sweeping blade.",
    "uses": "infinite",
    "consumeOnUse": false,
    "useTime": "action",
    "type": "melee",
    "damage": "1d10",
    "properties": [
      "heavy",
      "reach",
      "two-handed"
    ],
    "mastery": "graze",
    "value": 20,
    "id": "glaive"
  },
  {
    "name": "Dagger",
    "description": "A small, wicked edge built for speed and desperation.",
    "uses": "infinite",
    "consumeOnUse": false,
    "useTime": "action",
    "type": "melee",
    "damage": "1d4",
    "properties": [
      "finesse",
      "light"
    ],
    "mastery": "nick",
    "value": 2,
    "id": "dagger"
  },
  {
    "name": "Battleaxe",
    "description": "A broad axehead that bites deep when it lands.",
    "uses": "infinite",
    "consumeOnUse": false,
    "useTime": "action",
    "type": "melee",
    "damage": "1d8",
    "properties": [
      "versatile"
    ],
    "mastery": "topple",
    "value": 10,
    "id": "battleaxe"
  },
  {
    "name": "Warhammer",
    "description": "A solid hammer head that cracks bone and plate alike.",
    "uses": "infinite",
    "consumeOnUse": false,
    "useTime": "action",
    "type": "melee",
    "damage": "1d8",
    "properties": [
      "versatile"
    ],
    "mastery": "push",
    "value": 15,
    "id": "warhammer"
  },
  {
    "name": "Quarterstaff",
    "description": "A plain staff that becomes dangerous in trained hands.",
    "uses": "infinite",
    "consumeOnUse": false,
    "useTime": "action",
    "type": "melee",
    "damage": "1d6",
    "properties": [
      "versatile"
    ],
    "mastery": "topple",
    "value": 2,
    "id": "quarterstaff"
  },
  {
    "name": "Rapier",
    "description": "A slender duelist’s weapon, swift and precise.",
    "uses": "infinite",
    "consumeOnUse": false,
    "useTime": "action",
    "type": "melee",
    "damage": "1d8",
    "properties": [
      "finesse"
    ],
    "mastery": "vex",
    "value": 25,
    "id": "rapier"
  },
  {
    "name": "Scimitar",
    "description": "A curved blade that flows through close-range cuts.",
    "uses": "infinite",
    "consumeOnUse": false,
    "useTime": "action",
    "type": "melee",
    "damage": "1d6",
    "properties": [
      "finesse",
      "light"
    ],
    "mastery": "nick",
    "value": 25,
    "id": "scimitar"
  },
  {
    "name": "Handaxe",
    "description": "A compact axe suited for chopping or throwing.",
    "uses": "infinite",
    "consumeOnUse": false,
    "useTime": "action",
    "type": "melee",
    "damage": "1d6",
    "properties": [
      "light"
    ],
    "mastery": "vex",
    "value": 5,
    "id": "handaxe"
  },
  {
    "name": "Longbow",
    "description": "A tall bow with the reach to pick targets apart.",
    "uses": "infinite",
    "consumeOnUse": false,
    "useTime": "action",
    "type": "ranged",
    "damage": "1d8",
    "properties": [
      "range (150/600)",
      "two-handed"
    ],
    "mastery": "slow",
    "value": 50,
    "id": "longbow"
  },
  {
    "name": "Shortbow",
    "description": "A lighter bow that trades range for speed.",
    "uses": "infinite",
    "consumeOnUse": false,
    "useTime": "action",
    "type": "ranged",
    "damage": "1d6",
    "properties": [
      "range (80/320)",
      "two-handed"
    ],
    "mastery": "vex",
    "value": 25,
    "id": "shortbow"
  },
  {
    "name": "Flaming Longsword",
    "description": "A longsword that burns with a steady, hungry flame.",
    "uses": "infinite",
    "consumeOnUse": false,
    "useTime": "action",
    "type": "melee",
    "damage": "1d8",
    "effect": "+1d6 fire damage",
    "modifiers": { "enhancementBonus": 1, "damageBonuses": [ { "amount": "1d6", "type": "fire" } ] },
    "properties": [
      "versatile"
    ],
    "mastery": "sap",
    "value": 500,
    "id": "flaming_longsword"
  },
  {
    "name": "Venomous Dagger",
    "description": "A dagger that leaves a poisonous lesson behind.",
    "uses": "infinite",
    "consumeOnUse": false,
    "useTime": "action",
    "type": "melee",
    "damage": "1d4",
    "effect": "+1d6 poison damage",
    "modifiers": { "enhancementBonus": 1, "damageBonuses": [ { "amount": "1d6", "type": "poison" } ] },
    "properties": [
      "finesse",
      "light"
    ],
    "mastery": "nick",
    "value": 450,
    "id": "venomous_dagger"
  },
  {
    "name": "Greatsword of Wounding",
    "description": "A brutal greatsword that refuses to let wounds close.",
    "uses": "infinite",
    "consumeOnUse": false,
    "useTime": "action",
    "type": "melee",
    "damage": "2d6",
    "effect": "+1 damage",
    "modifiers": { "enhancementBonus": 1, "damageBonuses": [ { "amount": 1, "type": null } ] },
    "properties": [
      "heavy",
      "two-handed"
    ],
    "mastery": "graze",
    "value": 600,
    "id": "greatsword_of_wounding"
  },
  {
    "name": "Thunder Hammer",
    "description": "A warhammer that answers each blow with thunder.",
    "uses": "infinite",
    "consumeOnUse": false,
    "useTime": "action",
    "type": "melee",
    "damage": "1d8",
    "effect": "+1d6 thunder damage",
    "modifiers": { "enhancementBonus": 1, "damageBonuses": [ { "amount": "1d6", "type": "thunder" } ] },
    "properties": [
      "versatile"
    ],
    "mastery": "push",
    "value": 550,
    "id": "thunder_hammer"
  },
  {
    "name": "Frost Brand Rapier",
    "description": "A rapier rimed with cold that numbs on contact.",
    "uses": "infinite",
    "consumeOnUse": false,
    "useTime": "action",
    "type": "melee",
    "damage": "1d8",
    "effect": "+1d6 cold damage",
    "modifiers": { "enhancementBonus": 1, "damageBonuses": [ { "amount": "1d6", "type": "cold" } ] },
    "properties": [
      "finesse"
    ],
    "mastery": "vex",
    "value": 500,
    "id": "frost_brand_rapier"
  },
  {
    "name": "Bow of Accuracy",
    "description": "A bow that seems to guide the shot on its own.",
    "uses": "infinite",
    "consumeOnUse": false,
    "useTime": "action",
    "type": "ranged",
    "damage": "1d8",
    "effect": "+1 damage",
    "modifiers": { "enhancementBonus": 1, "damageBonuses": [ { "amount": 1, "type": null } ] },
    "properties": [
      "range (150/600)",
      "two-handed"
    ],
    "mastery": "slow",
    "value": 475,
    "id": "bow_of_accuracy"
  },
  {
    "name": "Exploding Handaxe",
    "description": "A handaxe that detonates in sparks and heat on impact.",
    "uses": "infinite",
    "consumeOnUse": false,
    "useTime": "action",
    "type": "melee",
    "damage": "1d6",
    "effect": "+1d6 fire damage",
    "modifiers": { "enhancementBonus": 1, "damageBonuses": [ { "amount": "1d6", "type": "fire" } ] },
    "properties": [
      "light"
    ],
    "mastery": "vex",
    "value": 420,
    "id": "exploding_handaxe"
  },
  {
    "name": "Shocking Scimitar",
    "description": "A scimitar that snaps with lightning along the edge.",
    "uses": "infinite",
    "consumeOnUse": false,
    "useTime": "action",
    "type": "melee",
    "damage": "1d6",
    "effect": "+1d4 lightning damage",
    "modifiers": { "enhancementBonus": 1, "damageBonuses": [ { "amount": "1d4", "type": "lightning" } ] },
    "properties": [
      "finesse",
      "light"
    ],
    "mastery": "nick",
    "value": 430,
    "id": "shocking_scimitar"
  },
  {
    "name": "Blessed Quarterstaff",
    "description": "A staff marked by faith, striking with quiet radiance.",
    "uses": "infinite",
    "consumeOnUse": false,
    "useTime": "action",
    "type": "melee",
    "damage": "1d8",
    "effect": "+1 radiant damage",
    "modifiers": { "enhancementBonus": 1, "damageBonuses": [ { "amount": 1, "type": "radiant" } ] },
    "properties": [
      "two-handed"
    ],
    "mastery": "topple",
    "value": 400,
    "id": "blessed_quarterstaff"
  },
  {
    "name": "Piercing Shortsword",
    "description": "A shortsword honed to punch through weak points.",
    "uses": "infinite",
    "consumeOnUse": false,
    "useTime": "action",
    "type": "melee",
    "damage": "1d6",
    "effect": "+1 damage",
    "modifiers": { "enhancementBonus": 1, "damageBonuses": [ { "amount": 1, "type": null } ] },
    "properties": [
      "finesse",
      "light"
    ],
    "mastery": "vex",
    "value": 410,
    "id": "piercing_shortsword"
  },
  {
    "name": "Battleaxe of Fury",
    "description": "An axe that howls with force when swung in anger.",
    "uses": "infinite",
    "consumeOnUse": false,
    "useTime": "action",
    "type": "melee",
    "damage": "1d8",
    "effect": "+1d6 force damage",
    "modifiers": { "enhancementBonus": 1, "damageBonuses": [ { "amount": "1d6", "type": "force" } ] },
    "properties": [
      "versatile"
    ],
    "mastery": "topple",
    "magical": true,
    "value": 480,
    "id": "battleaxe_of_fury"
  },
  {
    "name": "Silent Bow",
    "description": "A bow that fires with a hush and a headache behind the eyes.",
    "uses": "infinite",
    "consumeOnUse": false,
    "useTime": "action",
    "type": "ranged",
    "damage": "1d6",
    "effect": "+1 psychic damage",
    "modifiers": { "enhancementBonus": 1, "damageBonuses": [ { "amount": 1, "type": "psychic" } ] },
    "properties": [
      "range (80/320)",
      "two-handed"
    ],
    "mastery": "vex",
    "magical": true,
    "value": 460,
    "id": "silent_bow"
  },
  {
    "name": "Mace",
    "description": "A weighted metal head mounted on a sturdy haft.",
    "uses": "infinite",
    "consumeOnUse": false,
    "useTime": "action",
    "type": "melee",
    "damage": "1d6",
    "properties": [],
    "mastery": "sap",
    "value": 5,
    "id": "mace"
  }
];

const SIMPLE_WEAPON_IDS = new Set([
  "dagger", "venomous_dagger",
  "handaxe", "exploding_handaxe",
  "quarterstaff", "blessed_quarterstaff", "mace",
  "shortbow", "silent_bow",
]);

export const weapons = legacyWeaponRecords.map(toCanonicalWeapon);

export function isWeaponProficient(weapon, proficiencyNames = []) {
  if (!weapon) return false;
  const names = proficiencyNames.map((name) => String(name || "").trim().toLowerCase());
  if (names.includes("simple weapons") && weapon.proficiencies?.includes("simple_weapons")) return true;
  if (names.includes("martial weapons") && weapon.proficiencies?.includes("martial_weapons")) return true;
  const weaponName = String(weapon.name || "").trim().toLowerCase();
  return names.some((name) => name === weaponName || name === `${weaponName}s`);
}

function toCanonicalWeapon(record) {
  const twoHanded = record.properties.includes("two-handed");
  const ranged = record.type === "ranged";
  return {
    id: record.id,
    type: "equipment",
    equipmentKind: "weapon",
    name: record.name,
    inspectText: record.description,
    stackable: false,
    maxStackSize: 1,
    allowedSlots: ["weapon-1", "weapon-2"],
    proficiencies: [SIMPLE_WEAPON_IDS.has(record.id) ? "simple_weapons" : "martial_weapons"],
    effects: [],
    weaponType: record.type,
    attackAbility: ranged || record.properties.includes("finesse") ? "dexterity" : "strength",
    damageFormula: record.damage,
    damageType: baseDamageType(record.id),
    range: ranged ? rangeFromProperties(record.properties) : record.properties.includes("reach") ? 2 : 1,
    hands: twoHanded ? 2 : 1,
    properties: record.properties.filter((property) => !property.startsWith("range (")),
    mastery: record.mastery,
    enhancementBonus: record.modifiers?.enhancementBonus || 0,
    damageBonuses: (record.modifiers?.damageBonuses || []).map(canonicalDamageBonus),
    magical: record.magical === true || Boolean(record.modifiers),
    value: record.value,
    icon: weaponIcon(record.id, record.magical === true || Boolean(record.modifiers)),
  };
}

function weaponIcon(id, magical) {
  return {
    src: magical
      ? `combat_ui_v2/icons/weapon_badges/previews/${id}.png`
      : `combat_ui_v2/icons/weapons/${id}.png`,
    width: 80,
    height: 80,
  };
}

function canonicalDamageBonus(bonus) {
  return typeof bonus.amount === "number"
    ? { damage: bonus.amount, damageType: bonus.type || null }
    : { damageFormula: bonus.amount, damageType: bonus.type || null };
}

function baseDamageType(id) {
  if (["dagger", "venomous_dagger", "rapier", "frost_brand_rapier", "shortsword", "piercing_shortsword", "longbow", "bow_of_accuracy", "shortbow", "silent_bow"].includes(id)) return "piercing";
  if (["warhammer", "thunder_hammer", "quarterstaff", "blessed_quarterstaff", "mace", "maul"].includes(id)) return "bludgeoning";
  return "slashing";
}

function rangeFromProperties(properties) {
  const property = properties.find((entry) => entry.startsWith("range ("));
  const match = property?.match(/range \((\d+)\//);
  return Math.max(1, Math.ceil(Number(match?.[1] || 5) / 5));
}

export function getWeaponById(id) {
  return weapons.find(w => w.id === id) || null;
}
