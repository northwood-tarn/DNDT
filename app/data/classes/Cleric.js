export default {
  name: "Cleric",
  summary: "Devout spellcaster who channels divine power for healing, protection, and radiant wrath.",
  hitDie: 8,
  hpAtFirstLevel: "8 + Constitution modifier",
  hpPerLevel: "5 + Constitution modifier",
  primaryAbility: ["Wisdom"],
  savingThrows: ["Wisdom", "Charisma"],
  armor: ["Light armor", "Medium armor", "Shields"],
  weapons: ["Simple weapons"],
  tools: [],
  features: {
    2: [
      {
        name: "Turn Undead (Channel Divinity)",
        type: "Action",
        uses: "channelDivinity",
        description:
          "Present your holy symbol to unleash divine force. Each undead of your choice within range makes a WIS save. On a failed save, it is Turned for 1 minute (or until it takes damage). A Turned creature must spend its turns moving away from you by the safest available route and can’t willingly move closer. It can’t take reactions. It can take only the Dash action or try to escape from an effect that prevents it from moving. If it can’t move, it can take the Dodge action. (Engine: applies any setting-specific undead tier resistances.)"
      },
      {
        name: "Harness Divine Power (Channel Divinity)",
        type: "Action",
        uses: "channelDivinity",
        description:
          "Spend a Channel Divinity use to restore divine spell power (engine-defined). Typically restores an expended spell slot up to a level allowed by your Cleric level."
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
    5: [
      {
        name: "Sear Undead (Channel Divinity)",
        type: "Action",
        uses: "channelDivinity",
        description:
          "As an alternative Channel Divinity option, you brand undead with radiant judgment. Each undead of your choice within range makes a WIS save. On a failed save, it takes radiant damage based on its undead tier: Profane 3d8, Bound 2d8, Sovereign 1d8; on a successful save, it takes half damage. This damage increases for each rank by 1d8 at cleric level 8 and again at cleric level 13 (engine-defined)."
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
    12: [
      {
        name: "Ability Score Improvement",
        type: "Passive",
        description:
          "Increase ability scores or take a feat (engine-defined advancement rule)."
      }
    ],
  },
  subclasses: {
    "Grave Domain": {
      summary: "Guardian against profane undeath; punishes necromancy and guides souls.",
      features: {
        3: [
          { name: "Grave’s Rebuke (Channel Divinity)", type: "Action", uses: "channelDivinity",
            description: "Force one creature within 30 ft that dealt necrotic damage since your last turn to make a CON save; on failure it takes 4d8 radiant damage, all critical hits are suppressed until the end of your next turn, and its next necrotic damage is halved; on success it takes half damage and no riders." }
        ],
        7: [
          { name: "Sentinel at Death’s Door", type: "Reaction", uses: "shortRest",
            description: "When an ally within 30 ft would be critically hit, you cancel the critical (it becomes a normal hit)." }
        ],
        11: [
          { name: "Keeper of Souls", type: "Bonus Action",
            description: "When an enemy dies within 30 ft of you dies, you can elect regain HP equal to your Wisdom modifier (once per round). You can’t benefit from healing spells until the start of your next turn." }
        ],
        13: [
          { name: "Reaper’s Shroud", type: "Bonus Action", uses: "longRest",
            description: "For 1 minute, your radiant and necrotic spells deal +1d8 damage, and you gain resistance to necrotic." }
        ]
      }
    },
    "Lantern Domain": {
      summary: "Bearer of sacred light; turns darkness into a weapon and shield.",
      features: {
        3: [
          { name: "Radiance of the Dawn (Channel Divinity)", type: "Action", uses: "channelDivinity",
            description: "Dispel magical darkness within 30 ft and deal 2d10 + level radiant damage (CON save half) to hostile creatures within 30 ft. Your speed becomes 0 until the end of your next turn." }
        ],
        7: [
          { name: "Lantern’s Pulse", type: "Bonus Action", uses: "shortRest",
            description: "Emit a 10‑ft pulse of light; enemies in the area must make a CON save or be blinded until the start of your next turn." }
        ],
        11: [
          { name: "Judging Flame", type: "Passive",
            description: "The first time each turn your spell deals radiant damage, add your Wisdom modifier to that damage." }
        ],
        13: [
          { name: "Halo of Daybreak", type: "Action", uses: "longRest",
            description: "Create a 15‑ft radius aura of bright light for 1 minute; you and allies inside have advantage on saves vs. fear and charm; enemies that start in the aura take radiant damage equal to your Wisdom modifier. Enemies in the aura have advantage on attack rolls against you." }
        ]
      }
    },
    "War Domain": {
      summary: "Battle-minded priest who channels divine force through martial prowess.",
      features: {
        3: [
          { name: "Warpriest (Channel Divinity)", type: "Bonus Action", uses: "channelDivinity",
            description: "Spend a Channel Divinity use to make one weapon attack as a bonus action this turn. Until the end of your next turn, you can’t cast spells of 1st level or higher." }
        ],
        7: [
          { name: "Guided Strike", type: "Reaction", uses: "shortRest",
            description: "When you miss with an attack, add +5 to the roll after seeing the result." }
        ],
        11: [
          { name: "Divine Strike", type: "Passive",
            description: "Once per turn when you hit with a weapon attack, deal an extra 1d8 radiant or force damage." }
        ],
        13: [
          { name: "Relentless Advance", type: "Bonus Action", uses: "longRest",
            description: "For 1 minute, you have advantage on melee attack rolls. You can’t take the Dodge action, and opportunity attacks against you have advantage." }
        ]
      }
    }
  }
};
