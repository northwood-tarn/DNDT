// app/data/consumables.js
// Adds a 'useTime' field to drive action economy + combat visibility.
// Allowed values: 'free', 'bonus', 'action', 'exploration' (hidden in combat).

export const consumables = [
  {
    "name": "Rope (50 ft)",
    "type": "tool",
    "uses": "tied, climbed, pulled",
    "weight": "10 lb",
    "value": 1,
    "id": "rope_50_ft",
    "useTime": "exploration"
  },
  {
    "name": "Torch",
    "type": "light",
    "burnTime": "1 hour",
    "lightRadius": "20 feet",
    "ignites": true,
    "value": 0.1,
    "id": "torch",
    "useTime": "action"
  },
  {
    "name": "Healing Potion",
    "type": "potion",
    "effect": "Restores 2d4 + 2 HP",
    "uses": 1,
    "value": 50,
    "id": "healing_potion",
    "useTime": "bonus"
  },
  {
    "name": "Map Fragment",
    "type": "consumable",
    "stackable": true,
    "description": "A collection of weird drawings, hints, and fantasies about treasure.",
    "id": "map_fragment",
    "useTime": "exploration"
  },

  {
    "name": "Fire Granado",
    "type": "bomb",
    "effect": "Explodes in a 5 ft radius; creatures take 2d6 fire damage (DEX save for half).",
    "uses": 1,
    "value": 50,
    "id": "fire_granado",
    "useTime": "action"
  },
  {
    "name": "Smoke Jar",
    "type": "alchemical",
    "effect": "Creates a 10 ft radius smoke cloud that heavily obscures the area for 1d4 rounds.",
    "uses": 1,
    "value": 25,
    "id": "smoke_jar",
    "useTime": "action"
  },
  {
    "name": "Lightning Paper",
    "type": "weapon_coating",
    "effect": "Rub on a weapon as a bonus action; weapon deals +1d6 lightning damage on each hit for 2 rounds.",
    "uses": 1,
    "value": 100,
    "id": "lightning_paper",
    "useTime": "bonus"
  },
  {
    "name": "Greater Lightning Paper",
    "type": "weapon_coating",
    "effect": "Rub on a weapon as a bonus action; weapon deals +1d6 lightning damage on each hit for 6 rounds.",
    "uses": 1,
    "value": 250,
    "id": "greater_lightning_paper",
    "useTime": "bonus"
  }

];

export function getConsumableById(id){
  return consumables.find(c => c.id === id) || null;
}

[
  {
    "name": "Salted Cavefish",
    "type": "ration",
    "description": "A leathery strip of blind cavefish, cured with crystalline salt from dripping walls.",
    "id": "ration_cavefish",
    "uses": 1,
    "value": 1,
    "useTime": "exploration"
  },
  {
    "name": "Glowcap Stew",
    "type": "ration",
    "description": "Thick paste made from bioluminescent fungi, faintly glowing even after drying.",
    "id": "ration_glowcap_stew",
    "uses": 1,
    "value": 1,
    "useTime": "exploration"
  },
  {
    "name": "Ash-Baked Root",
    "type": "ration",
    "description": "A blackened tuber roasted in ember-ash, earthy and bitter but filling.",
    "id": "ration_ash_baked_root",
    "uses": 1,
    "value": 1,
    "useTime": "exploration"
  },
  {
    "name": "Spider Jerky",
    "type": "ration",
    "description": "Strips of desiccated spider-leg meat, chewy and faintly venomous-smelling.",
    "id": "ration_spider_jerky",
    "uses": 1,
    "value": 1,
    "useTime": "exploration"
  },
  {
    "name": "Fungus Loaf",
    "type": "ration",
    "description": "Dense loaf of ground mycelium and moss, sour and heavy as stone.",
    "id": "ration_fungus_loaf",
    "uses": 1,
    "value": 1,
    "useTime": "exploration"
  },
  {
    "name": "Pickled Eyestalks",
    "type": "ration",
    "description": "A jar of vinegared eyestalks from cave crabs; the brine is more nourishing than the meat.",
    "id": "ration_pickled_eyestalks",
    "uses": 1,
    "value": 1,
    "useTime": "exploration"
  },
  {
    "name": "Lantern-Oil Biscuits",
    "type": "ration",
    "description": "Flat biscuits fried in lantern oil, leaving a greasy, sustaining taste.",
    "id": "ration_oil_biscuits",
    "uses": 1,
    "value": 1,
    "useTime": "exploration"
  },
  {
    "name": "Moss Cakes",
    "type": "ration",
    "description": "Compressed moss patties bound with cave honey, sweet and oddly spongy.",
    "id": "ration_moss_cakes",
    "uses": 1,
    "value": 1,
    "useTime": "exploration"
  },
  {
    "name": "Bone Marrow Porridge",
    "type": "ration",
    "description": "Congealed gruel boiled from cracked beast bones, oddly comforting underground.",
    "id": "ration_marrow_porridge",
    "uses": 1,
    "value": 1,
    "useTime": "exploration"
  },
  {
    "name": "Crystal Fruit",
    "type": "ration",
    "description": "Translucent fruit from deep chasms, crunching like ice but sweet as nectar.",
    "id": "ration_crystal_fruit",
    "uses": 1,
    "value": 1,
    "useTime": "exploration"
  },

  {
  "name": "Premium Lantern Oil",
  "type": "oil",
  "id": "oil_premium",
  "uses": "100",
  "value": "200"
},

  {
  "name": "Basilisk Oil",
  "type": "oil",
  "id": "oil_basilisk",
  "uses": "50",
  "value": "220"
}
]

