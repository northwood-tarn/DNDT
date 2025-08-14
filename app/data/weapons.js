export const weapons = [
  {
    "name": "Shortsword",
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
    "type": "melee",
    "damage": "1d8",
    "properties": [
      "versatile (1d10)"
    ],
    "value": 15,
    "id": "longsword"
  },
  {
    "name": "Greatsword",
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
    "type": "melee",
    "damage": "1d8",
    "properties": [
      "versatile (1d10)"
    ],
    "value": 10,
    "id": "battleaxe"
  },
  {
    "name": "Warhammer",
    "type": "melee",
    "damage": "1d8",
    "properties": [
      "versatile (1d10)"
    ],
    "value": 15,
    "id": "warhammer"
  },
  {
    "name": "Quarterstaff",
    "type": "melee",
    "damage": "1d6",
    "properties": [
      "versatile (1d8)"
    ],
    "value": 2,
    "id": "quarterstaff"
  },
  {
    "name": "Rapier",
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
    "type": "melee",
    "damage": "1d8 + 1d6 fire",
    "properties": [
      "versatile (1d10)"
    ],
    "magical": true,
    "value": 500,
    "id": "flaming_longsword"
  },
  {
    "name": "Venomous Dagger",
    "type": "melee",
    "damage": "1d4 + 1d6 poison",
    "properties": [
      "finesse",
      "light"
    ],
    "magical": true,
    "value": 450,
    "id": "venomous_dagger"
  },
  {
    "name": "Greatsword of Wounding",
    "type": "melee",
    "damage": "2d6 + 1",
    "properties": [
      "heavy",
      "two-handed"
    ],
    "magical": true,
    "value": 600,
    "id": "greatsword_of_wounding"
  },
  {
    "name": "Thunder Hammer",
    "type": "melee",
    "damage": "1d8 + 1d6 thunder",
    "properties": [
      "versatile (1d10)"
    ],
    "magical": true,
    "value": 550,
    "id": "thunder_hammer"
  },
  {
    "name": "Frost Brand Rapier",
    "type": "melee",
    "damage": "1d8 + 1d6 cold",
    "properties": [
      "finesse"
    ],
    "magical": true,
    "value": 500,
    "id": "frost_brand_rapier"
  },
  {
    "name": "Bow of Accuracy",
    "type": "ranged",
    "damage": "1d8 + 1",
    "properties": [
      "range (150/600)",
      "two-handed"
    ],
    "magical": true,
    "value": 475,
    "id": "bow_of_accuracy"
  },
  {
    "name": "Exploding Handaxe",
    "type": "melee",
    "damage": "1d6 + 1d6 fire",
    "properties": [
      "light",
      "thrown (20/60)"
    ],
    "magical": true,
    "value": 420,
    "id": "exploding_handaxe"
  },
  {
    "name": "Shocking Scimitar",
    "type": "melee",
    "damage": "1d6 + 1d4 lightning",
    "properties": [
      "finesse",
      "light"
    ],
    "magical": true,
    "value": 430,
    "id": "shocking_scimitar"
  },
  {
    "name": "Blessed Quarterstaff",
    "type": "melee",
    "damage": "1d6 + 1 radiant",
    "properties": [
      "versatile (1d8)"
    ],
    "magical": true,
    "value": 400,
    "id": "blessed_quarterstaff"
  },
  {
    "name": "Piercing Shortsword",
    "type": "melee",
    "damage": "1d6 + 1",
    "properties": [
      "finesse",
      "light"
    ],
    "magical": true,
    "value": 410,
    "id": "piercing_shortsword"
  },
  {
    "name": "Battleaxe of Fury",
    "type": "melee",
    "damage": "1d8 + 1d6 force",
    "properties": [
      "versatile (1d10)"
    ],
    "magical": true,
    "value": 480,
    "id": "battleaxe_of_fury"
  },
  {
    "name": "Silent Bow",
    "type": "ranged",
    "damage": "1d6 + 1 psychic",
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
    "type": "shield",
    "acBonus": 1,
    "properties": [
      "light"
    ],
    "value": 8,
    "id": "buckler"
  },
  {
    "name": "Tower Shield",
    "type": "shield",
    "acBonus": 2,
    "properties": [
      "heavy",
      "two-handed"
    ],
    "value": 18,
    "id": "tower_shield"
  },
  {
    "name": "Aegis of Light",
    "type": "shield",
    "acBonus": 3,
    "properties": [
      "light",
      "magical"
    ],
    "magical": true,
    "value": 500,
    "id": "aegis_of_light"
  }
];