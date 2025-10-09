// app/data/classes/Warlock.js
export default {
  name: "Warlock",
  summary: "Pact-bound caster who channels otherworldly patrons.",
  hitDie: 8,
  primaryAbility: ["Charisma"],
  savingThrows: ["Wisdom", "Charisma"],
  armor: ["Light armor"],
  weapons: ["Simple weapons"],
  tools: [],
  hp: {
    1: "8 + Constitution modifier",
    perLevel: "5 + Constitution modifier"
  },
  features: {
    4: [{
      name: "Spiral of Retribution",
      type: "Reaction",
      uses: "longRest:1",
      description: "After you have been hit 3+ times since your last turn, lash out with patron power as a reaction, dealing force damage that scales with proficiency and additional hits."
    }],
    5: [{
      name: "Extra Attack (Pact of the Blade)",
      type: "Passive",
      condition: { pact: "Blade" },
      description: "When you take the Attack action with your pact weapon, you can make two attacks."
    }],
    11: [{
      name: "Mystic Arcanum",
      type: "Special",
      uses: "longRest:1",
      description: "Choose one 6th-level spell as an Arcanum. Cast it once per long rest without expending a slot."
    }]
  },
  subclasses: {
    "The Fiend": {
      summary: "Infernal pact warlock who turns hellfire into relentless offense.",
      features: {
        3: [
          { name: "Hellish Rebuke", type: "Reaction",
            description: "To avoid pop-up spam, this triggers automatically: the first time you are hit in a combat, the attacker takes 2d10 fire damage (DEX save for half). This consumes your reaction on that round." }
        ],
        7: [
          { name: "Infernal Resilience", type: "Passive",
            description: "You gain resistance to fire damage." },
          { name: "Hellish Rebuke — Escalation", type: "Passive",
            description: "Starting at 7th level, Hellish Rebuke can trigger automatically the first two times you are hit in a combat (still consumes your reaction on that round)." },
          { name: "Patron's Spear", type: "Special", uses: "longRest",
            description: "Once per long rest, when you hit with an attack or spell, your patron erupts through you: deal +5d10 fire damage. Using this ends any concentration you are maintaining." }
        ],
        11: [
          { name: "Hurl Through Hell", type: "Special", uses: "longRest",
            description: "When you hit a creature with an attack, you can banish it to hellish vistas until the end of your next turn (no save). When it returns, it takes 8d10 psychic damage and is frightened of you until the end of your next turn." }
        ]
      }
    },
    "The Undead": {
      summary: "Deathless patron grants fear and necrotic resilience, making you a terror on the field.",
      features: {
        3: [
          { name: "Form of Dread", type: "Bonus Action", uses: "shortRest",
            description: "Transform for 1 minute: gain 1d10 + Warlock level temporary HP; immune to being frightened; the first time each turn you hit a creature with an attack or spell, it must succeed on a WIS save or be frightened of you until the end of your next turn." }
        ],
        7: [
          { name: "Grave Tether", type: "Passive",
            description: "Once per turn, the first time you deal necrotic damage on your turn, regain HP equal to your Charisma modifier. You also gain resistance to necrotic damage." },
          { name: "Patron's Spear", type: "Special", uses: "longRest",
            description: "Once per long rest, when you hit with an attack or spell, your patron erupts through you: deal +5d10 necrotic damage. Using this ends any concentration you are maintaining." }
        ],
        11: [
          { name: "Aura of the Grave (Hybrid Aura)", type: "Passive",
            description: "Radius 10 ft. Self: resistance to nonmagical bludgeoning, piercing, and slashing damage. Enemies: any enemy that starts its turn in the aura must succeed on a WIS save or become frightened until the beginning of its next turn; if already frightened, it also takes 1d6 necrotic damage at the start of its turn." }
        ],
        13: [
          { name: "Deathless Form", type: "Action", uses: "longRest",
            description: "For 1 minute: gain resistance to all damage except radiant; gain a fly speed of 30 ft; once per turn when you hit with an attack or spell, deal an extra +2d8 necrotic damage." }
        ]
      }
    },
    "The Lantern": {
      summary: "Pact with a dying star—wield fading radiance, sustain yourself with light, and end battles in a blazing nova.",
      features: {
        3: [
          { name: "Starfire Boon", type: "Passive",
            description: "The first time each turn you deal damage with a Warlock spell or cantrip, add radiant damage equal to your Charisma modifier." },
          { name: "Channel Radiance", type: "Bonus Action", uses: "shortRest",
            description: "Once per short rest, blaze for one round: your next attack or spell deals +2d8 radiant damage and you shed bright light in a 20‑ft radius." }
        ],
        7: [
          { name: "Radiant Aegis", type: "Passive",
            description: "You gain resistance to necrotic damage. When you take necrotic damage, the attacker takes radiant damage equal to your Charisma modifier." },
          { name: "Patron's Spear", type: "Special", uses: "longRest",
            description: "Once per long rest, when you hit with an attack or spell, your patron erupts through you: deal +5d10 radiant damage. Using this ends any concentration you are maintaining." }
        ],
        11: [
          { name: "Aura of the Last Light", type: "Bonus Action",
            description: "Once per combat, ignite your aura (10‑ft radius) for the rest of the combat. Self: at the start of your turn, gain 5 temporary HP. Enemies: have disadvantage on saving throws against your radiant damage." }
        ],
        13: [
          { name: "Nova of Ash", type: "Action", uses: "longRest",
            description: "Unleash a dying star’s flare: creatures of your choice within 20 ft make CON saves; on a failure take 8d8 radiant + 8d8 fire damage (half on success). After this effect, if your Aura of the Last Light is active, it ends immediately and cannot be reignited this combat." }
        ]
      }
    }
  }
};
