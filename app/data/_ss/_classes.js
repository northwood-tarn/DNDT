// app/data/Classes.js
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
    starterInventory: [
      { id: "map_fragment", name: "Map Fragment", type: "consumable", qty: 2 }
    ]
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
          description: "Deal extra damage once per turn if you have advantage or an enemy is distracted.",
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
    starterInventory: [
      { id: "map_fragment", name: "Map Fragment", type: "consumable", qty: 2 }
    ]
  },

  Cleric: {
    summary: "Devout spellcaster who channels divine power for healing, protection, and radiant wrath.",
    name: "Cleric",
    hitDie: 8,
    primaryAbility: ["Wisdom"],
    savingThrows: ["Wisdom", "Charisma"],
    armor: ["Light armor", "Medium armor", "Shields"],
    weapons: ["Simple weapons"],
    tools: [],
    baseAbilities: { STR: 10, DEX: 10, CON: 14, INT: 10, WIS: 16, CHA: 12 },
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
          name: "Divine Grace",
          type: "Action",
          uses: "proficiency",
          description: [
            "As an action, heal yourself for 1d8 + Wisdom modifier.",
            "If at full HP, instead gain 1 Overflow charge (max equal to your proficiency bonus).",
            "As a bonus action within 1 minute, spend an Overflow to choose one effect:",
            "• Shield: Gain 2 temporary HP (scales with level).",
            "• Smite: Next attack before end of next turn deals +1d4 radiant damage (scales with level).",
            "Overflow charges expire 1 minute after being gained."
          ].join(" ")
        }
      ],
      5: [
        {
          name: "Divine Grace — Healing Light",
          type: "Passive",
          description: [
            "Healing becomes 2d8 + Wisdom. Overflow: Shield 5 temp HP, Smite +1d6 radiant,",
            "or cleanse a minor condition (poisoned, frightened)."
          ].join(" ")
        }
      ],
      9: [
        {
          name: "Divine Grace — Healing Flame",
          type: "Passive",
          description: [
            "Healing becomes 3d8 + Wisdom. Overflow: Shield 8 temp HP, Smite +1d8 radiant,",
            "or resistance to one damage type until end of next turn."
          ].join(" ")
        }
      ],
      13: [
        {
          name: "Divine Grace — Healing Radiance",
          type: "Passive",
          description: [
            "Healing becomes 4d8 + Wisdom. Overflow: Shield 10 temp HP, Smite +1d10 radiant,",
            "or end a severe condition (stunned, blinded). Once per long rest, if you spend all Overflow charges,",
            "trigger Radiant Surge: heal half your max HP and deal 2d8 radiant to enemies within 10 ft (Con save halves)."
          ].join(" ")
        }
      ]
    },
    starterInventory: [
      { id: "map_fragment", name: "Map Fragment", type: "consumable", qty: 2 }
    ]
  },

  Wizard: {
    summary: "Book-learned arcane caster; researches spells and survives by wit or patronage.",
    name: "Wizard",
    hitDie: 6,
    primaryAbility: ["Intelligence"],
    savingThrows: ["Intelligence", "Wisdom"],
    armor: [],
    weapons: ["Daggers", "Darts", "Slings", "Quarterstaffs", "Light crossbows"],
    tools: [],
    baseAbilities: { STR: 8, DEX: 14, CON: 12, INT: 16, WIS: 12, CHA: 10 },
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
        { name: "Spellcasting", type: "Passive", description: "Prepare and cast arcane spells using Intelligence."  },
        { name: "Focus Identity", type: "Passive", description: "At 1st level, your arcane practice is anchored by a personal focus tied to your tradition. Choose your subclass’s focus identity at character creation and write a short description for it. Your focus serves as your spellcasting focus. If you are a Dirt Wizard, you gain proficiency in Survival. If you are a Necromancer, you gain proficiency in Medicine. If you are a Battlemage, you gain proficiency with your bonded weapon chosen at character creation." }
      ]
    },
    starterInventory: [
      { id: "map_fragment", name: "Map Fragment", type: "consumable", qty: 2 }
    ]
  }
  ,

  Warlock: {
    summary: "Bound to an otherworldly patron; wields compact, overwhelming magic through a pact focus.",
    name: "Warlock",
    hitDie: 8,
    primaryAbility: ["Charisma"],
    savingThrows: ["Wisdom", "Charisma"],
    armor: ["Light armor"],
    weapons: ["Simple weapons"],
    tools: [],
    baseAbilities: { STR: 8, DEX: 14, CON: 14, INT: 10, WIS: 10, CHA: 16 },
    features: {
      1: [
        { name: "Spellcasting", type: "Passive", description: "Channel patron power to cast Warlock spells using Charisma." }
      ]
    },
    pactOptions: ["Pact of the Blade", "Pact of the Tome"],
    starterInventory: [
      { id: "map_fragment", name: "Map Fragment", type: "consumable", qty: 2 }
    ]
  },

Paladin: {
    summary: "Solemn oathbearer who channels sacred power through steel and resolve.",
    name: "Paladin",
    hitDie: 10,
    primaryAbility: ["Strength", "Charisma"],
    savingThrows: ["Wisdom", "Charisma"],
    armor: ["All armor", "Shields"],
    weapons: ["Simple weapons", "Martial weapons"],
    tools: [],
    baseAbilities: { STR: 16, DEX: 10, CON: 14, INT: 8, WIS: 12, CHA: 14 },
    features: {
      1: [
        { name: "Lay on Hands", type: "Action", uses: "pool:5xLevel",
          description: "Heal yourself for up to your pool. Pool equals 5 × your level; replenishes on long rest." }
      ],
      5: [
        { name: "Extra Attack", type: "Passive",
          description: "When you take the Attack action, you can attack twice instead of once." }
      ]
    },
  }

};