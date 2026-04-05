// Class file structure:
// Each class file exports a default object representing a character class with the following keys:
// - name: String representing the class name.
// - summary: Brief description of the class role and characteristics.
// - hitDie: Number indicating the class hit die value.
// - primaryAbility: Array of primary ability names (e.g., ["Strength", "Dexterity"]).
// - savingThrows: Array of saving throw ability names the class is proficient in.
// - armor: Array of armor types the class can use.
// - weapons: Array of weapon types the class can use.
// - tools: Array of tool proficiencies.
// - features: Object keyed by character level, each value is an array of feature objects.
//   Each feature object includes:
//     - name: Feature name.
//     - type: Feature type (e.g., "Passive", "Bonus Action").
//     - uses: (Optional) Usage limitation (e.g., "shortRest", "longRest:3").
//     - description: Text describing the feature's effect.
// - subclasses: Object keyed by subclass name, each containing:
//     - summary: Brief description of the subclass.
//     - features: Same structure as the main features key, keyed by level with arrays of feature objects.

export default {
  name: "Rogue",
  summary: "Agile skirmisher; excels at stealth, skills, and precision strikes.",
  hitDie: 8,
  hp: {
    level1: { base: 8, addCon: true },
    perLevel: { base: 5, addCon: true }
  },
  primaryAbility: ["Dexterity"],
  savingThrows: ["Dexterity", "Intelligence"],
  armor: ["Light armor"],
  weapons: ["Simple weapons", "Hand crossbows", "Longswords", "Rapiers", "Shortswords"],
  // tools: ["Thieves' tools"],
  features: {
    1: [
      { name: "Thieves' Tools (Legacy Kit)", type: "Passive",
        description: "Your old, worn set of less‑than‑legal tools. When you pick a lock or disarm a trap, you have expertise (add double your proficiency bonus) on the check. Others can still attempt these tasks using improvised or found tools—this feature doesn’t gate the attempt; it just makes you notably better at it." }
    ],
    2: [
      {
        name: "Cunning Action",
        type: "Bonus Action",
        description: "You can take the Dash, Disengage, or Hide action as a bonus action on your turn."
      }
    ],
    3: [
      {
        name: "Roguish Archetype",
        type: "Passive",
        description: "You choose a Rogue subclass and gain its features at the listed levels."
      }
    ],
    4: [
      {
        name: "Ability Score Improvement",
        type: "Passive",
        description:
          "Increase ability scores or take a feat (engine-defined advancement rule)."
      }
    ],
    6: [
      {
        name: "Expertise",
        type: "Passive",
        description: "Choose two skill proficiencies. You gain double your proficiency bonus on ability checks that use those skills."
      }
    ],
    7: [
      {
        name: "Evasion",
        type: "Passive",
        description: "When you succeed on a Dexterity saving throw to take half damage, you instead take no damage. When you fail such a save, you take only half damage."
      }
    ],
    8: [
      {
        name: "Ability Score Improvement",
        type: "Passive",
        description:
          "Increase ability scores or take a feat (engine-defined advancement rule)."
      }
    ],
    11: [
      {
        name: "Reliable Talent",
        type: "Passive",
        description: "Whenever you make an ability check that uses a proficiency you have, treat a d20 roll of 9 or lower as a 10."
      }
    ],
    12: [
      {
        name: "Ability Score Improvement",
        type: "Passive",
        description:
          "Increase ability scores or take a feat (engine-defined advancement rule)."
      }
    ]
  },

  subclasses: {
    "Assassin": {
      summary: "Cold-blooded precision killer who excels at the opening strike. Save DC = 8 + proficiency bonus + Dexterity modifier.",
      features: {
        1: [
          {
            name: "Killer’s Patience",
            type: "Passive",
            description: "When you roll initiative, you may choose to act last in the initiative order instead of using your rolled result. If you do, you gain +10 ft of movement during the first round of combat."
          }
        ],        
        3: [
          { name: "Assassinate", type: "Passive",
            description: "You have advantage on attack rolls against creatures that have not acted yet. Your hits against surprised creatures are critical hits." }
        ],
        7: [
          { name: "Lethal Ambush", type: "Passive",
            description: "On the first round of combat, your first weapon hit deals +2d6 Sneak Attack damage." }
        ],
        11: [
          { name: "Assassinate Upgrade", type: "Passive",
            description: "When you hit a surprised creature, you deal double Sneak Attack dice (in addition to the critical hit)." }
        ],
        13: [
          { name: "Umbral Guise", type: "Special", uses: "shortRest",
            description: "Once per short rest, when you Hide, you become invisible until the end of your next turn." }
        ]
      }
    },
    "Cutthroat": {
      summary: "Dirty-fighting enforcer who terrifies and overwhelms foes.",
      features: {
        1: [
          { name: "Low Blow", type: "Bonus Action",
            description: "Target a creature within 30 ft. It must succeed on a WIS save against your subclass save DC or take psychic damage equal to your Charisma modifier and have disadvantage on its next attack before the end of its turn." }
        ],
        3: [
          { name: "Dark Presence", type: "Passive",
            description: "Your subclass save DC uses Charisma. Gain Expertise in one: Deception, Intimidation, or Persuasion." }
        ],
        7: [
          { name: "Secrets Exposed", type: "Bonus Action", uses: "longRest",
            description: "As a bonus action, size up a foe. Make a contested check (your Charisma vs target’s Wisdom [Insight]) or the target makes a WIS save against your subclass save DC (your choice when you use this). On a success, for 1 minute, allies have advantage on the first attack they make each turn against that creature." }
        ],
        11: [
          { name: "Exploit Weakness", type: "Special", uses: "longRest",
            description: "Choose a creature you can see; until the end of the combat, your Sneak Attacks against it deal extra psychic damage equal to your Charisma modifier, and it cannot benefit from advantage." }
        ],
        13: [
          { name: "Ultraviolence", type: "Special", uses: "longRest",
            description: "You dig down into the most ferocious, violent and unbending aspect of yourself. Every successful weapon hit is immediately doubled by a second stab for free." }
        ]
      }
    },
    "Saboteur": {
      summary: "Gadgeteer rogue who prepares devices and turns battlefields chaotic. Save DC = 8 + proficiency bonus + Intelligence modifier.",
      features: {
        1: [
          { name: "Quick Rigging I", type: "Bonus Action",
            description: "Once per combat, assemble and use a device as a bonus action from your known recipes. You begin play knowing one origin device of your choice." }
        ],
        3: [
          { name: "Bombmaker", type: "Special",
            description: "You gain a Cookbook with 2 recipes. After a long rest, choose 3 devices to prepare; they are created and ready to use." }
        ],
        7: [
          { name: "Quick Rigging II", type: "Bonus Action",
            description: "Once per combat, you may assemble and use up to two devices this combat (one per use) as a bonus action." }
        ],
        11: [
          { name: "Master of Mixtures", type: "Passive",
            description: "Add 2 more recipes to your Cookbook. After a long rest, prepare 5 devices. Your devices deal +1d6 extra damage of their type." }
        ],
        13: [
          { name: "Catastrophic Charge", type: "Special", uses: "longRest",
            description: "Once per long rest, throw an empowered device: 20-ft radius, double damage dice." }
        ]
      },
      cookbookExamples: [
        { name: "Fire Granado", use: "Action", text: "Thrown 20 ft; 5-ft radius explosion, 2d6 fire (DEX save half)." },
        { name: "Acid Flask", use: "Action", text: "Thrown 20 ft; on hit 2d6 acid, target’s AC −1 until end of next turn." },
        { name: "Lightning Paper", use: "Bonus Action", text: "Apply to weapon; for 2 rounds, attacks deal +1d6 lightning." }
      ]
    }
  }
}
