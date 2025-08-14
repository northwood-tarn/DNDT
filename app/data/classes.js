// app/data/classes.js
export const classes = {
  Fighter: {
    summary: "Armored frontline warrior; durable and adaptable.",
    name: "Fighter",
    hitDie: 10,
    primaryAbility: ["Strength", "Dexterity"],
    savingThrows: ["Strength", "Constitution"],
    armor: ["All armor", "Shields"],
    weapons: ["Simple weapons", "Martial weapons"],
    tools: [],
    // Class-optimized ability array (27-point-buy style)
    baseAbilities: { STR: 16, DEX: 14, CON: 14, INT: 8, WIS: 12, CHA: 10 },
    features: {
      1: [
        {
          name: "Second Wind",
          description: "Bonus action: regain 1d10 + level HP. Usable once per short rest.",
          type: "Bonus Action",
          uses: "shortRest"
        }
      ],
      2: [
        {
          name: "Action Surge",
          description: "Take one additional action. Usable once per short rest.",
          type: "Special",
          uses: "shortRest"
        }
      ],
      5: [
        {
          name: "Extra Attack",
          description: "You can attack twice when you take the Attack action.",
          type: "Passive"
        }
      ]
    },
    // Starter inventory for new Fighter characters
    starterInventory: [
      { id: "map_fragment", name: "Map Fragment", type: "consumable", qty: 2 }
    ]
    // Proficiency bonus is global by level; use app/rules/proficiency.js instead of per-class duplication.
  },

  Rogue: {
    summary: "Agile skirmisher; excels at stealth, skills, and precision strikes.",
    name: "Rogue",
    hitDie: 8,
    primaryAbility: ["Dexterity"],
    savingThrows: ["Dexterity", "Intelligence"],
    armor: ["Light armor"],
    weapons: ["Simple weapons", "Hand crossbows", "Longswords", "Rapiers", "Shortswords"],
    tools: ["Thieves' tools"],
    // Class-optimized ability array
    baseAbilities: { STR: 8, DEX: 16, CON: 14, INT: 12, WIS: 12, CHA: 10 },
    sneakAttack: {
      diceByLevel: {
        1: 1, 2: 1, 3: 2, 4: 2, 5: 3, 6: 3, 7: 4, 8: 4, 9: 5, 10: 5, 11: 6, 12: 6, 13: 7, 14: 7
      }
    },
    features: {
      1: [
        {
          name: "Sneak Attack",
          description: "Deal extra damage once per turn if you have advantage or an ally is adjacent.",
          type: "Passive"
        }
      ],
      2: [
        {
          name: "Cunning Action",
          description: "Bonus action: Dash, Disengage, or Hide.",
          type: "Bonus Action"
        }
      ],
      5: [
        {
          name: "Uncanny Dodge",
          description: "Reaction: halve the damage of an attack you can see.",
          type: "Reaction"
        }
      ]
    },
    // Starter inventory for new Rogue characters
    starterInventory: [
      { id: "map_fragment", name: "Map Fragment", type: "consumable", qty: 2 }
    ]
    // Proficiency bonus is global by level; use app/rules/proficiency.js
  },

  Sorcerer: {
    summary: "Innate arcane caster; flexible magic fueled by sorcery points.",
    name: "Sorcerer",
    hitDie: 6,
    primaryAbility: ["Charisma"],
    savingThrows: ["Constitution", "Charisma"],
    armor: [],
    weapons: ["Daggers", "Darts", "Slings", "Quarterstaffs", "Light crossbows"],
    tools: [],
    // Class-optimized ability array
    baseAbilities: { STR: 8, DEX: 14, CON: 14, INT: 10, WIS: 10, CHA: 16 },
    slotsByLevel: {
      1: { 1: 2 },
      2: { 1: 3 },
      3: { 1: 4, 2: 2 },
      4: { 1: 4, 2: 3 },
      5: { 1: 4, 2: 3, 3: 2 },
      6: { 1: 4, 2: 3, 3: 3 },
      7: { 1: 4, 2: 3, 3: 3, 4: 1 }
    },
    features: {
      1: [
        {
          name: "Spellcasting",
          description: "Cast spells using Charisma. You know a limited number of spells.",
          type: "Passive"
        }
      ],
      2: [
        {
          name: "Font of Magic",
          description: "Use Sorcery Points to create spell slots or fuel metamagic.",
          type: "Special"
        }
      ],
      3: [],
      5: []
    },
    // Starter inventory for new Sorcerer characters
    starterInventory: [
      { id: "map_fragment", name: "Map Fragment", type: "consumable", qty: 2 }
    ]
    // Proficiency bonus is global by level; use app/rules/proficiency.js
  }
};
