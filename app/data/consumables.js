export const consumables = [
  {
    "name": "Rope (50 ft)",
    "type": "tool",
    "uses": "tied, climbed, pulled",
    "weight": "10 lb",
    "value": 1,
    "id": "rope_50_ft"
  },
  {
    "name": "Torch",
    "type": "light",
    "burnTime": "1 hour",
    "lightRadius": "20 feet",
    "ignites": true,
    "value": 0.1,
    "id": "torch"
  },
  {
    "name": "Healing Potion",
    "type": "potion",
    "effect": "Restores 2d4 + 2 HP",
    "uses": 1,
    "value": 50,
    "id": "healing_potion"
  },
  {
    "name": "Map Fragment",
    "type": "consumable",
    "stackable": true,
    "description": "A collection of weird drawings, hints, and fantasies about treasure.",
    "id": "map_fragment"
  }
];