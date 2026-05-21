export const armor = [
  {
    "name": "Leather Armor",
    "description": "Supple leather armor offering basic protection without sacrificing mobility.",
    "uses": "infinite",
    "useTime": "exploration",
    "consumeOnUse": false,
    "dexCap": null,
    "stealthDisadvantage": false,
    "type": "light",
    "properties": [
      "light"
    ],
    "ac": 11,
    "magical": false,
    "value": 10,
    "id": "leather_armor"
  },
  {
    "name": "Studded Leather",
    "description": "Reinforced with metal studs, this armor balances agility with added protection.",
    "uses": "infinite",
    "useTime": "exploration",
    "consumeOnUse": false,
    "dexCap": null,
    "stealthDisadvantage": false,
    "type": "light",
    "properties": [
      "light"
    ],
    "ac": 12,
    "magical": false,
    "value": 45,
    "id": "studded_leather"
  },
  {
    "name": "Hide Armor",
    "description": "Crude layers of cured hide, tough enough to turn aside glancing blows.",
    "uses": "infinite",
    "useTime": "exploration",
    "consumeOnUse": false,
    "dexCap": 2,
    "stealthDisadvantage": false,
    "type": "medium",
    "properties": [
      "medium"
    ],
    "ac": 12,
    "magical": false,
    "value": 10,
    "id": "hide_armor"
  },
  {
    "name": "Half Plate",
    "description": "Even a glance at this armor is enough to deter some enemies.",
    "uses": "infinite",
    "useTime": "exploration",
    "consumeOnUse": false,
    "dexCap": 2,
    "stealthDisadvantage": true,
    "type": "medium",
    "properties": [
      "medium"
    ],
    "ac": 15,
    "magical": false,
    "value": 750,
    "id": "half_plate"
  },
  {
    "name": "Chain Mail",
    "description": "Interlocking metal rings clatter softly, a familiar sound of seasoned warriors.",
    "uses": "infinite",
    "useTime": "exploration",
    "consumeOnUse": false,
    "dexCap": 0,
    "stealthDisadvantage": true,
    "type": "heavy",
    "properties": [
      "heavy"
    ],
    "ac": 16,
    "magical": false,
    "value": 75,
    "id": "chain_mail"
  },
  {
    "name": "Plate Armor",
    "description": "A masterwork of steel plates, forged to make its wearer nearly untouchable.",
    "uses": "infinite",
    "useTime": "exploration",
    "consumeOnUse": false,
    "dexCap": 0,
    "stealthDisadvantage": true,
    "type": "heavy",
    "properties": [
      "heavy"
    ],
    "ac": 18,
    "magical": false,
    "value": 1500,
    "id": "plate_armor"
  },
  {
    "name": "Shadow Leather Armor",
    "description": "Darkened leather that seems to drink in the light, favored by stealthy operatives.",
    "uses": "infinite",
    "useTime": "exploration",
    "consumeOnUse": false,
    "dexCap": null,
    "stealthDisadvantage": false,
    "type": "light",
    "properties": [
      "light",
      "magical"
    ],
    "ac": 12,
    "effect": "+1 stealth",
    "modifiers": { skillBonuses: { stealth: 1 } },
    "magical": true,
    "value": 350,
    "id": "shadow_leather_armor"
  },
  {
    "name": "Blessed Studded Leather",
    "description": "Light armor etched with subtle blessings, offering protection beyond its weight.",
    "uses": "infinite",
    "useTime": "exploration",
    "consumeOnUse": false,
    "dexCap": null,
    "stealthDisadvantage": false,
    "type": "light",
    "properties": [
      "light",
      "magical"
    ],
    "ac": 13,
    "effect": "+1 AC",
    "modifiers": { acBonus: 1 },
    "magical": true,
    "value": 400,
    "id": "blessed_studded_leather"
  },
  {
    "name": "Storm Hide",
    "description": "Thick hide crackling faintly with stored energy from violent storms.",
    "uses": "infinite",
    "useTime": "exploration",
    "consumeOnUse": false,
    "dexCap": 2,
    "stealthDisadvantage": false,
    "type": "medium",
    "properties": [
      "medium",
      "magical"
    ],
    "ac": 13,
    "effect": "resist lightning",
    "modifiers": { resistances: ["lightning"] },
    "magical": true,
    "value": 600,
    "id": "storm_hide"
  },
  {
    "name": "Half Plate of Fortitude",
    "description": "Heavier than it looks, this armor radiates stubborn resilience.",
    "uses": "infinite",
    "useTime": "exploration",
    "consumeOnUse": false,
    "dexCap": 2,
    "stealthDisadvantage": true,
    "type": "medium",
    "properties": [
      "medium",
      "magical"
    ],
    "ac": 16,
    "effect": "+1 AC",
    "modifiers": { acBonus: 1 },
    "magical": true,
    "value": 800,
    "id": "half_plate_of_fortitude"
  },
  {
    "name": "Infernal Chain Mail",
    "description": "Forged in hellish fires, the links are warm to the touch and hard to damage.",
    "uses": "infinite",
    "useTime": "exploration",
    "consumeOnUse": false,
    "dexCap": 0,
    "stealthDisadvantage": true,
    "type": "heavy",
    "properties": [
      "heavy",
      "magical"
    ],
    "ac": 17,
    "effect": "resist fire",
    "modifiers": { resistances: ["fire"] },
    "magical": true,
    "value": 900,
    "id": "infernal_chain_mail"
  },
  {
    "name": "Celestial Plate Armor",
    "description": "Polished plates gleam with a quiet radiance, inspiring allies and unsettling foes.",
    "uses": "infinite",
    "useTime": "exploration",
    "consumeOnUse": false,
    "dexCap": 0,
    "stealthDisadvantage": true,
    "type": "heavy",
    "properties": [
      "heavy",
      "magical"
    ],
    "ac": 19,
    "effect": "+1 AC",
    "modifiers": { acBonus: 1 },
    "magical": true,
    "value": 1600,
    "id": "celestial_plate_armor"
  },
  {
    "name": "Shield",
    "description": "A standard shield carried in one hand for reliable protection.",
    "uses": "infinite",
    "useTime": "exploration",
    "consumeOnUse": false,
    "type": "shield",
    "effect": "+2 AC",
    "modifiers": { "acBonus": 2 },
    "properties": [
      "shield"
    ],
    "magical": false,
    "value": 10,
    "id": "shield"
  },
  {
    "name": "Buckler",
    "description": "A small shield meant to deflect rather than endure.",
    "uses": "infinite",
    "useTime": "exploration",
    "consumeOnUse": false,
    "type": "shield",
    "effect": "+1 AC",
    "modifiers": { "acBonus": 1 },
    "properties": [
      "light",
      "shield"
    ],
    "magical": false,
    "value": 8,
    "id": "buckler"
  },
  {
    "name": "Tower Shield",
    "description": "A slab of protection that turns you into a moving wall.",
    "uses": "infinite",
    "useTime": "exploration",
    "consumeOnUse": false,
    "type": "shield",
    "effect": "+2 AC",
    "modifiers": { "acBonus": 2 },
    "properties": [
      "heavy",
      "two-handed",
      "shield"
    ],
    "magical": false,
    "value": 18,
    "id": "tower_shield"
  },
  {
    "name": "Aegis of Light",
    "description": "A radiant shield that makes darkness tremble.",
    "uses": "infinite",
    "useTime": "exploration",
    "consumeOnUse": false,
    "type": "shield",
    "effect": "+3 AC",
    "modifiers": { "acBonus": 3 },
    "properties": [
      "light",
      "magical",
      "shield"
    ],
    "magical": true,
    "value": 500,
    "id": "aegis_of_light"
  }
];

const _armorById = new Map(armor.map(a => [a.id, a]));

export function getArmorById(id) {
  if (!id) return null;
  return _armorById.get(id) || null;
}
