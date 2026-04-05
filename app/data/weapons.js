export const weapons = [
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
    "value": 50,
    "id": "greatsword"
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
      "light",
      "thrown (20/60)"
    ],
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
      "light",
      "thrown (20/60)"
    ],
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
    "modifiers": { "damageBonuses": [ { "amount": "1d6", "type": "fire" } ] },
    "properties": [
      "versatile"
    ],
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
    "modifiers": { "damageBonuses": [ { "amount": "1d6", "type": "poison" } ] },
    "properties": [
      "finesse",
      "light"
    ],
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
    "modifiers": { "damageBonuses": [ { "amount": 1, "type": null } ] },
    "properties": [
      "heavy",
      "two-handed"
    ],
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
    "modifiers": { "damageBonuses": [ { "amount": "1d6", "type": "thunder" } ] },
    "properties": [
      "versatile"
    ],
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
    "modifiers": { "damageBonuses": [ { "amount": "1d6", "type": "cold" } ] },
    "properties": [
      "finesse"
    ],
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
    "modifiers": { "damageBonuses": [ { "amount": 1, "type": null } ] },
    "properties": [
      "range (150/600)",
      "two-handed"
    ],
    "value": 475,
    "id": "bow_of_accuracy"
  },
  {
    "name": "Exploding Handaxe",
    "description": "A handaxe that detonates in sparks and heat when thrown.",
    "uses": "infinite",
    "consumeOnUse": false,
    "useTime": "action",
    "type": "melee",
    "damage": "1d6",
    "effect": "+1d6 fire damage",
    "modifiers": { "damageBonuses": [ { "amount": "1d6", "type": "fire" } ] },
    "properties": [
      "light",
      "thrown (20/60)"
    ],
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
    "modifiers": { "damageBonuses": [ { "amount": "1d4", "type": "lightning" } ] },
    "properties": [
      "finesse",
      "light"
    ],
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
    "damage": "1d6",
    "effect": "+1 radiant damage",
    "modifiers": { "damageBonuses": [ { "amount": 1, "type": "radiant" } ] },
    "properties": [
      "versatile"
    ],
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
    "modifiers": { "damageBonuses": [ { "amount": 1, "type": null } ] },
    "properties": [
      "finesse",
      "light"
    ],
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
    "modifiers": { "damageBonuses": [ { "amount": "1d6", "type": "force" } ] },
    "properties": [
      "versatile"
    ],
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
    "modifiers": { "damageBonuses": [ { "amount": 1, "type": "psychic" } ] },
    "properties": [
      "range (80/320)",
      "two-handed"
    ],
    "magical": true,
    "value": 460,
    "id": "silent_bow"
  },
  {
    "name": "Buckler",
    "description": "A small shield meant to deflect rather than endure.",
    "uses": "infinite",
    "consumeOnUse": false,
    "useTime": "exploration",
    "type": "shield",
    "effect": "+1 AC",
    "modifiers": { "acBonus": 1 },
    "properties": [
      "light"
    ],
    "value": 8,
    "id": "buckler"
  },
  {
    "name": "Tower Shield",
    "description": "A slab of protection that turns you into a moving wall.",
    "uses": "infinite",
    "consumeOnUse": false,
    "useTime": "exploration",
    "type": "shield",
    "effect": "+2 AC",
    "modifiers": { "acBonus": 2 },
    "properties": [
      "heavy",
      "two-handed"
    ],
    "value": 18,
    "id": "tower_shield"
  },
  {
    "name": "Aegis of Light",
    "description": "A radiant shield that makes darkness tremble.",
    "uses": "infinite",
    "consumeOnUse": false,
    "useTime": "exploration",
    "type": "shield",
    "effect": "+3 AC",
    "modifiers": { "acBonus": 3 },
    "properties": [
      "light",
      "magical"
    ],
    "magical": true,
    "value": 500,
    "id": "aegis_of_light"
  }
];

export function getWeaponById(id) {
  return weapons.find(w => w.id === id) || null;
}