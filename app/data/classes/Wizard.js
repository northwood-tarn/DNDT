// app/data/classes/Wizard.js
export default {
  name: "Wizard",
  summary: "Scholarly spellcaster who reshapes reality with arcane study.",
  hitDie: 6,
  primaryAbility: ["Intelligence"],
  savingThrows: ["Intelligence", "Wisdom"],
  armor: [],
  weapons: ["Daggers", "Darts", "Slings", "Quarterstaffs", "Light crossbows"],
  tools: [],
  // Fixed HP progression (no rolling): Level 1 uses max hit die; later levels use average.
  // Wizard: d6 → L1 = 6 + CON; L2+ = 4 + CON per level.
  leveling: {
    hp: {
      level1: { base: 6, perLevel: null, note: "Level 1 HP = 6 + CON" },
      later:  { perLevel: 4, note: "Each level after 1 adds 4 + CON" },
      // Helper to compute total HP at a given level with a given CON modifier.
      getTotal(conMod, level) {
        if (!Number.isInteger(level) || level <= 0) return 0;
        const l1 = 6 + conMod;
        if (level === 1) return l1;
        const per = 4 + conMod;
        return l1 + (level - 1) * per;
      }
    }
  },
  features: {
    // Keep your core wizard features (Spellcasting, Arcane Recovery, etc.) in your engine.
  },
  subclasses: {
    "Dirt Wizard": {
      summary: "Indomitable marginal scholar who clings to truth and logic beyond the reach of society.",
      features: {
        3: [
          { name: "Relentless", type: "Passive",
            description: "Once per combat, the first time a spell you cast fails to affect any creature (attack miss or all targets succeed their save), you immediately regain the expended slot (up to 3rd level) and gain temporary HP equal to your INT modifier. In exploration, treat any roll of 9 or lower on Arcana or Investigation as a 10." }
        ],
        7: [
          { name: "Grit of the Marginal", type: "Passive",
            description: "When you start your turn below half HP, gain temporary HP equal to twice your INT modifier." }
        ],
        11: [
          { name: "Truth in Shards", type: "Passive",
            description: "The first time each turn you deal damage with a spell, add +1d8 force damage. Your damaging spells ignore resistance to force damage." }
        ],
        13: [
          { name: "Indomitability", type: "Special", uses: "longRest",
            description: "Once per long rest, when you would be reduced to 0 HP, instead drop to 1 HP and immediately regain one expended spell slot of 5th level or lower." }
        ]
      }
    },
    "Necromancer": {
      summary: "High Chair of the Pale — the sanctioned, elite master of death, wielding seals and edicts with bureaucratic authority.",
      features: {
        3: [
          { name: "Seal of Mortality", type: "Passive",
            description: "Once per combat, the first time your spell deals necrotic damage, the target becomes sealed until the end of your next turn: your spells deal +1d6 necrotic to it and it cannot regain HP. In exploration, you gain proficiency in Medicine; if already proficient, you double your proficiency bonus." }
        ],
        7: [
          { name: "Black Aegis", type: "Passive",
            description: "You have resistance to necrotic damage. The first time on your turn that any creature takes necrotic damage from your spell, you regain HP equal to your INT modifier (min 1). This healing occurs once per turn, no matter how many creatures are affected. In addition, the first undead you target on your turn has disadvantage on the first saving throw it makes against your spell that turn." }
        ],
        11: [
          { name: "Mortmain (The Dead Hand)", type: "Passive",
            description: "Once per turn, when you deal necrotic damage to a creature, that creature is under Mortmain until the end of your next turn: it cannot take reactions, its speed is halved, and it cannot regain HP." }
        ],
        13: [
          { name: "Final Edict", type: "Action", uses: "longRest",
            description: "As an action once per long rest, choose a point you can see within 60 ft. All creatures in a 20-ft-radius sphere centered there must make a CON save. On a fail: they take 8d6 necrotic damage, cannot regain HP for 1 minute, and are frightened of you until the end of your next turn. On a success: they take half damage and cannot regain HP until the end of your next turn. This ability is a magical effect and does not consume a spell slot." }
        ]
      }
    },
    "Battlemage": {
      summary: "Court-trained warcaster who unites steel and spell; a duelist whose blade is an arcane instrument.",
      features: {
        3: [
          { name: "Arcane Armament", type: "Passive",
            description: "Choose one melee weapon you are proficient with as your arcane armament; it remains your armament until you choose to change it after a long rest. You use INT for attack and damage rolls with your arcane armament, instead of STR or DEX. Whenever you cast a leveled spell, the next time you hit with your arcane armament before the end of your next turn it deals extra force damage equal to your proficiency bonus." }
        ],
        5: [
          { name: "Bonded Accuracy +1", type: "Passive",
            description: "You gain a +1 bonus to attack rolls made with your arcane armament." }
        ],
        7: [
          { name: "Spell Rhythm", type: "Bonus Action", uses: "shortRest",
            description: "As a bonus action, once per short rest, you may enter a spell rhythm for one minute. In this state, a melee attack action is doubled by the casting of a cantrip or the casting of a cantrip is doubled by a free melee attack." }
        ],
        10: [
          { name: "Bonded Accuracy +2", type: "Passive",
            description: "Your bonus to attack rolls made with your arcane armament increases to +2." }
        ],
        11: [
          { name: "Martial Sigils", type: "Passive",
            description: "While wielding your arcane armament, you gain +1 AC. Once per turn when you hit with a melee attack, you can choose to mark the target with a sigil, forcing it to make its next attack roll at disadvantage before the end of its next turn." }
        ],
        13: [
          { name: "Crescendo Duel", type: "Bonus Action", uses: "longRest",
            description: "As a bonus action, once per long rest, you may enter a crescendo for one minute. While it lasts, when you hit with your arcane armament, add +2d8 force damage. In addition, once on each of your turns when you cast a spell, you may also make one melee attack with your arcane armament as a bonus action." }
        ]
      }
    }
  }
};
