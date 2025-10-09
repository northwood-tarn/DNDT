// app/data/classes/Cleric.js
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
    // Keep core Cleric features (Spellcasting, Channel Divinity, etc.) in your engine.
  },
  subclasses: {
    "Grave Domain": {
      summary: "Guardian against profane undeath; punishes necromancy and guides souls.",
      features: {
        3: [
          { name: "Grave’s Rebuke (Channel Divinity)", type: "Action", uses: "channelDivinity",
            description: "Force one creature within 30 ft that dealt necrotic damage since your last turn to make a CON save; on failure it takes 4d8 radiant damage and its next necrotic damage is halved; on success it takes half damage and no halving rider." }
        ],
        7: [
          { name: "Sentinel at Death’s Door", type: "Reaction", uses: "shortRest",
            description: "When you or an enemy within 30 ft would be critically hit, you cancel the critical (it becomes a normal hit)." }
        ],
        11: [
          { name: "Keeper of Souls", type: "Passive",
            description: "When a creature you can see dies, you or an ally of your choice within 30 ft regains HP equal to your Wisdom modifier (once per round)." }
        ],
        13: [
          { name: "Reaper’s Shroud", type: "Bonus Action", uses: "longRest",
            description: "For 1 minute, your radiant and necrotic spells deal +1d8 damage, and you gain resistance to necrotic." }
        ]
      }
    },
    "Lantern Keeper Domain": {
      summary: "Bearer of sacred light; turns darkness into a weapon and shield.",
      features: {
        3: [
          { name: "Radiance of the Dawn (Channel Divinity)", type: "Action", uses: "channelDivinity",
            description: "Dispel magical darkness within 30 ft and deal 2d10 + level radiant damage (CON save half) to hostile creatures within 30 ft." }
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
            description: "Create a 15‑ft radius aura of bright light for 1 minute; you and allies inside have advantage on saves vs. fear and charm; enemies that start in the aura take radiant damage equal to your Wisdom modifier." }
        ]
      }
    },
    "War Domain": {
      summary: "Battle-minded priest who channels divine force through martial prowess.",
      features: {
        3: [
          { name: "Warpriest (Channel Divinity)", type: "Bonus Action", uses: "channelDivinity",
            description: "Spend a Channel Divinity use to make one weapon attack as a bonus action this turn." }
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
          { name: "Avatar of War", type: "Bonus Action", uses: "longRest",
            description: "For 1 minute, you have resistance to nonmagical weapon damage and your Divine Strike bonus becomes 2d8." }
        ]
      }
    }
  }
};
