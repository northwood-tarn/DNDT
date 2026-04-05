// app/data/consumables.js
// Adds a 'useTime' field to drive action economy + combat visibility.
// Allowed values: 'free', 'bonus', 'action', 'exploration' (hidden in combat).

export const consumables = [
  {
    name: "Rope (50 ft)",
    type: "utility",
    id: "rope_50_ft",
    uses: "infinite",
    useTime: "exploration",
    value: 1,
    consumeOnUse: false,
    description: "A sturdy length of hemp rope for climbing and securing."
  },
  {
    name: "Healing Potion",
    type: "potion",
    id: "healing_potion",
    uses: 1,
    useTime: "bonus",
    effect: "Restores 2d4 + 2 HP",
    value: 50,
    consumeOnUse: true,
    description: "The red liquid in this vial heartens you even when you just look at it."
  },
  {
    name: "Map Fragment",
    type: "unique",
    id: "map_fragment",
    uses: "infinite",
    useTime: "exploration",
    description: "A collection of weird drawings, hints, and fantasies about treasure.",
    consumeOnUse: false
  },

  {
    name: "Fire Granado",
    type: "bomb",
    id: "fire_granado",
    uses: 1,
    useTime: "action",
    effect: "Explodes in a 5 ft radius; creatures take 2d6 fire damage (DEX save for half).",
    value: 50,
    consumeOnUse: true,
    description: "If a colour could sizzle silently, it would be the colour of this."
  },
  {
    name: "Smoke Jar",
    type: "bomb",
    id: "smoke_jar",
    uses: 1,
    useTime: "action",
    effect: "Creates a 10 ft radius smoke cloud that heavily obscures the area for 1d4 rounds.",
    value: 25,
    consumeOnUse: true,
    description: "A clay orb whose outline lazily shifts."
  },
  {
    name: "Lightning Paper",
    type: "coating",
    id: "lightning_paper",
    uses: 1,
    useTime: "bonus",
    effect: "Rub on a weapon as a bonus action; weapon deals +1d6 lightning damage on each hit for 2 rounds.",
    value: 100,
    consumeOnUse: true,
    description: "This paper is storm incarnate."
  },
  {
    name: "Greater Lightning Paper",
    type: "coating",
    id: "greater_lightning_paper",
    uses: 1,
    useTime: "bonus",
    effect: "Rub on a weapon as a bonus action; weapon deals +1d6 lightning damage on each hit for 6 rounds.",
    value: 250,
    consumeOnUse: true,
    description: "The stack of papers you keep this sheathed in writhes in pain."
  },

  // === Aya starting gear support (dev save slot 99) ===
  {
    name: "Crowbar",
    type: "utility",
    id: "crowbar",
    uses: "infinite",
    useTime: "exploration",
    value: 2,
    consumeOnUse: false,
    description: "A heavy iron bar used for prying and leverage."
  },
  {
    name: "Hammer",
    type: "utility",
    id: "hammer",
    uses: "infinite",
    useTime: "exploration",
    value: 1,
    consumeOnUse: false,
    description: "A simple hammer suited for driving spikes and breaking stone."
  },
  {
    name: "Tinderbox",
    type: "utility",
    id: "tinderbox",
    uses: "infinite",
    useTime: "exploration",
    value: 1,
    consumeOnUse: false,
    description: "Flint and steel for reliably starting a fire."
  },
  {
    name: "Rations",
    type: "ration",
    id: "ration",
    uses: "per_quantity",
    useTime: "exploration",
    value: 1,
    consumeOnUse: true,
    description: "Preserved food sufficient for a day of travel."
  },
  {
    name: "Waterskin",
    type: "utility",
    id: "waterskin",
    uses: "infinite",
    useTime: "exploration",
    value: 1,
    consumeOnUse: false,
    description: "A leather flask used to carry drinking water."
  }
];

export function getConsumableById(id){
  return consumables.find(c => c.id === id) || null;
}
