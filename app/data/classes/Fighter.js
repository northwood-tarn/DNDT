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
  name: "Fighter",
  summary: "Armored frontline warrior; durable and adaptable.",
  hitDie: 10,
  // Fixed HP progression (no rolling): Level 1 = max hit die + CON; subsequent levels = fixed average + CON
  hp: {
    level1: { base: 10, addCon: true },
    perLevel: { base: 6, addCon: true }
  },
  primaryAbility: ["Strength", "Dexterity"],
  savingThrows: ["Strength", "Constitution"],
  armor: ["All armor", "Shields"],
  weapons: ["Simple weapons", "Martial weapons"],
  tools: [],
  features: {
    1: [
      {
        name: "Second Wind",
        type: "Bonus Action",
        uses: "shortRest",
        description: "Regain 1d10 + your level HP."
      }
    ],
    2: [
      {
        name: "Action Surge",
        type: "Special",
        uses: "shortRest",
        description: "Take one additional action on your turn."
      }
    ],
    5: [
      {
        name: "Extra Attack",
        type: "Passive",
        description: "When you take the Attack action, you can make two attacks."
      }
    ]
  },
  subclasses: {
    "Champion": {
      summary: "Steadfast paragon who turns steady blows into heroic finishes.",
      features: {
        3: [
          { name: "Press the Attack", type: "Special", uses: "shortRest",
            description: "Once per short rest, if your attack leaves a creature at or below 10% of its max HP, the creature is slain." }
        ],
        7: [
          { name: "Second Wind Upgrade", type: "Passive",
            description: "When you use Second Wind, you also gain advantage on your next attack before the end of your turn." }
        ],
        11: [
          { name: "Unyielding Stance", type: "Special",
            description: "Once per combat, when you would be reduced to 0 HP, you stay at 1 HP instead." }
        ]
      }
    },
    "Duelist": {
      summary: "Swift, precise fencer who punishes openings and avoids harm.",
      features: {
        3: [
          { name: "Flourish", type: "Passive",
            description: "Once per turn when you hit with a melee attack, you gain +2 AC until the start of your next turn." }
        ],
        7: [
          { name: "Evasive Step", type: "Passive",
            description: "When an adjacent enemy misses you with a melee attack, you may move 5 ft without provoking." }
        ],
        11: [
          { name: "Deadly Precision", type: "Passive",
            description: "Your critical hits with finesse weapons roll one additional damage die." }
        ]
      }
    },
    "Berserker": {
      summary: "Primal fury in human form: devastates foes in surging rages.",
      features: {
        3: [
          { name: "Rage", type: "Bonus Action", uses: "longRest:3",
            description: "Enter a 1-minute rage: advantage on STR checks/saves, +2 melee damage with STR, resistance to bludgeoning/piercing/slashing. Ends early if you don’t attack or take damage on your turn." },
          { name: "Reckless Attack", type: "Special",
            description: "On your turn, you can gain advantage on STR melee attacks; attacks against you have advantage until your next turn." },
          { name: "Ferocious Swing", type: "Special",
            description: "While raging, once per turn you may make a sweeping strike, making one attack roll that targets all adjacent enemies." }
        ],
        7: [
          { name: "Primal Roar", type: "Bonus Action", uses: "shortRest",
            description: "While raging, unleash a roar. Creatures of your choice within 10 ft must succeed on a WIS save or be frightened until the end of your next turn." }
        ],
        11: [
          { name: "Savage Momentum", type: "Special",
            description: "Once per rage, when you reduce a creature to 0 HP, immediately make one bonus-action melee attack against another target." }
        ]
      }
    }
  }
};
