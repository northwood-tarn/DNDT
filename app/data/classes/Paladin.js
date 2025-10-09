// app/data/classes/Paladin.js
export default {
  name: "Paladin",
  summary: "Holy warrior who blends martial prowess with divine power.",
  hitDie: 10,
  primaryAbility: ["Strength", "Charisma"],
  savingThrows: ["Wisdom", "Charisma"],
  armor: ["All armor", "Shields"],
  weapons: ["Simple weapons", "Martial weapons"],
  tools: [],
  hp: {
    level1Fixed: 10,
    perLevelFixed: 6,
    note: "Fixed hit points (no rolling). At 1st level: 10 + CON modifier. From 2nd level onward: +6 + CON modifier each level."
  },
  features: {
    5: [
      { feature: "Extra Attack", name: "Extra Attack", type: "Passive",
        description: "When you take the Attack action, you can make two attacks." }
    ],
    6: [
      {
        feature: "Aura Manifestation",
        name: "Aura Manifestation",
        type: "Passive",
        note: "Unlock aura system. You can maintain one aura mode at a time.",
        config: {
          type: "aura_core",
          stacking: "exclusive",
          switchPolicy: { inCombat: "oncePerTurn", outOfCombat: "free" },
          defaultRadiusFeet: 10
        }
      },
      {
        feature: "Aura of Protection",
        name: "Aura of Protection",
        type: "Passive",
        note: "Self: add CHA to saving throws. Enemies in your aura take a small penalty to saves vs your effects.",
        config: {
          type: "aura",
          mode: "protection",
          radiusFeet: 10,
          selfBuff: { saveBonusAll: "CHA_mod" },
          enemyDebuff: { savePenaltyVsYourEffects: -1 }
        }
      }
    ],
    7: [
      {
        feature: "Sanctified Presence",
        name: "Sanctified Presence",
        type: "Passive",
        condition: { subclass: "Sacred" },
        note: "Self: advantage on saves vs charm/fear. Enemies: disadvantage on saves vs your charm/fear effects.",
        config: {
          type: "aura",
          mode: "sanctified_presence",
          radiusFeet: 10,
          selfBuff: { advantageOnSaves: ["charm", "fear"] },
          enemyDebuff: { disadvantageOnSavesVsYourTags: ["charm", "fear"] }
        }
      },
      {
        feature: "Aura of Alacrity",
        name: "Aura of Alacrity",
        type: "Passive",
        condition: { subclass: "Glory" },
        note: "Self: +10 ft speed. Enemies: -10 ft speed while in your aura.",
        config: {
          type: "aura",
          mode: "alacrity",
          radiusFeet: 10,
          selfBuff: { speedBonus: 10 },
          enemyDebuff: { speedPenalty: 10 }
        }
      },
      {
        feature: "Aura of Pursuit",
        name: "Aura of Pursuit",
        type: "Passive",
        condition: { subclass: "Vengeance" },
        note: "Self: +10 ft speed when moving toward your Vow target. Enemies (not your Vow target): -2 to opportunity attack rolls against you.",
        config: {
          type: "aura",
          mode: "pursuit",
          radiusFeet: 10,
          selfBuff: { speedBonusTowardVowTarget: 10 },
          enemyDebuff: { aooPenaltyVsYou: -2, excludeTarget: "Vow" }
        }
      }
    ],
    10: [{
      feature: "Aura of Courage",
      name: "Aura of Courage",
      type: "Passive",
      note: "Self: immune to frightened. Enemies: disadvantage on saving throws against your fear effects.",
      config: {
        type: "aura",
        mode: "courage",
        radiusFeet: 10,
        selfBuff: { immuneTo: ["frightened"] },
        enemyDebuff: { disadvantageOnSavesVsYourTags: ["fear"] }
      }
    }]
  },
  subclasses: {
    "Oath of Vengeance": {
      summary: "Relentless hunter who brings retribution to the guilty.",
      features: {
        3: [
          { name: "Vow of Enmity", type: "Bonus Action", uses: "shortRest",
            description: "Choose a creature within 10 ft; for 1 minute, you have advantage on attack rolls against it." }
        ],
        7: [
          { name: "Chains of Vengeance", type: "Reaction", uses: "shortRest",
            description: "When your Vow target moves or attacks, you may force a STR save; on failure, it is restrained until the start of its next turn." }
        ],
        11: [
          { name: "Relentless Pursuit", type: "Passive",
            description: "Your movement increases by 10 ft and opportunity attacks against you are at disadvantage while moving toward your Vow target." }
        ],
        13: [
          { name: "Executioner’s Verdict", type: "Special", uses: "longRest",
            description: "Once per long rest, when you hit your Vow target, deal an extra 6d8 radiant damage." }
        ]
      }
    },
    "Oath of the Sacred": {
      summary: "Fusion of Devotion and Ancients—holy light tempered with verdant mercy.",
      features: {
        3: [
          { name: "Radiant Smite", type: "Passive",
            description: "The first time you hit with a melee attack each round, deal an extra 1d6 radiant damage." }
        ],
        7: [
          { name: "Sanctified Presence", type: "Passive",
            description: "You and hostile creatures within 10 ft have disadvantage on charm and fear effects you impose; hostile spell save DCs against your spells are at disadvantage." }
        ],
        11: [
          { name: "Nature’s Aegis", type: "Passive",
            description: "You gain resistance to necrotic and poison damage." }
        ],
        13: [
          { name: "Aura of Renewal", type: "Bonus Action", uses: "longRest",
            description: "For 1 minute, the first time each turn you hit a creature, you or an ally within 10 ft regains HP equal to your Charisma modifier." }
        ]
      }
    },
    "Oath of Glory": {
      summary: "Heroic exemplar whose prowess inspires daring feats.",
      features: {
        3: [
          { name: "Athletic Prowess", type: "Passive",
            description: "You have advantage on Athletics and Acrobatics checks; when you Dash, you can jump as part of the move." }
        ],
        7: [
          { name: "Aura of Alacrity", type: "Passive",
            description: "Your speed increases by 10 ft; enemies within 10 ft treat difficult terrain of your choice as normal for you." }
        ],
        11: [
          { name: "Glorious Challenge", type: "Bonus Action", uses: "shortRest",
            description: "Choose a creature within 30 ft; it has disadvantage on attacks against others while it can see you until the end of its next turn." }
        ],
        13: [
          { name: "Legend’s Surge", type: "Special", uses: "longRest",
            description: "Once per long rest, immediately take an additional action on your turn." }
        ]
      }
    }
  }
};
