// app/data/classes/Paladin.js
export default {
  id: "paladin",
  name: "Paladin",
  summary: "Holy warrior who blends martial prowess with divine power.",
  hitDie: 10,
  primaryAbility: ["Strength", "Charisma"],
  savingThrows: ["Wisdom", "Charisma"],
  armor: ["All armor", "Shields"],
  weapons: ["Simple weapons", "Martial weapons"],
  tools: [],
  hp: {
    level1: { base: 10, addCon: true },
    perLevel: { base: 6, addCon: true }
  },
  spellcasting: {
    ability: "Charisma",
    preparation: "prepared",
    startsAtLevel: 1
  },
  choices: [
    { id: "subclass", kind: "subclass", level: 3, required: true }
  ],
  features: {
    1: [
      {
        name: "Weapon Mastery",
        iconId: "weapon_mastery",
        type: "Passive",
        description: "Choose two weapons whose mastery properties you can use.",
        effects: {
          weaponMastery: [{ count: 2 }]
        }
      }
    ],
    2: [{
      name: "Paladin's Smite",
      iconId: "divine_smite",
      type: "Special",
      description: "Divine Smite is always prepared. Once per Long Rest, you can cast it without expending a spell slot.",
      effects: {
        spells: [{ id: "divine_smite", mode: "prepared" }],
        resources: [{ id: "paladins_smite_free", name: "Paladin's Smite", max: 1, recovery: "long_rest" }]
      }
    }],
    4: [
      {
        name: "Ability Score Improvement",
        iconId: "ability_score_improvement",
        type: "Passive",
        description:
          "Increase ability scores or take a feat (engine-defined advancement rule).",
        effects: { advancement: [{ type: "ability_score_improvement", choices: ["ability_score", "feat"] }] }
      }
    ],
    5: [
      { name: "Extra Attack", iconId: "extra_attack_plus_1", type: "Passive",
        description: "When you take the Attack action, you can make two attacks.",
        effects: { attackAction: [{ attacks: 2 }] } }
    ],
    6: [
      {
        name: "Aura Manifestation",
        type: "Passive",
        note: "Unlock aura system. You can maintain one aura mode at a time.",
        effects: { narrativeTags: ["aura_core"] }
      },
      {
        name: "Aura of Protection",
        iconId: "aura_of_protection",
        type: "Passive",
        note: "You and allies in your aura add your Charisma modifier to saving throws.",
        effects: {
          auras: [{
            id: "aura_of_protection",
            name: "Aura of Protection",
            radiusFt: 10,
            affects: "self_and_allies",
            effects: [{
              id: "aura_of_protection_save_bonus",
              type: "modifier",
              stat: "save",
              amountFormula: "charisma_modifier"
            }]
          }]
        }
      }
    ],
    8: [
      {
        name: "Ability Score Improvement",
        iconId: "ability_score_improvement",
        type: "Passive",
        description:
          "Increase ability scores or take a feat (engine-defined advancement rule).",
        effects: { advancement: [{ type: "ability_score_improvement", choices: ["ability_score", "feat"] }] }
      }
    ],
    10: [{
      name: "Aura of Courage",
      iconId: "aura_of_courage",
      type: "Passive",
      note: "You and allies in your aura cannot be frightened.",
      effects: {
        auras: [{
          id: "aura_of_courage",
          name: "Aura of Courage",
          radiusFt: 10,
          affects: "self_and_allies",
          effects: [{
            id: "aura_of_courage_frightened_prevention",
            type: "condition_prevention",
            conditions: ["frightened"]
          }]
        }]
      }
    }],

    11: [{
      name: "Greater Radiant Smite",
      iconId: "greater_radiant_smite",
      type: "Passive",
      description: "Whenever you hit with a melee weapon or an Unarmed Strike, the attack deals an extra 1d8 radiant damage.",
      effects: {
        damageRiders: [{
          id: "greater_radiant_smite",
          name: "Greater Radiant Smite",
          trigger: "source_hits_with_attack_roll",
          actionTags: ["melee"],
          requiresAnyActionTag: ["weapon", "unarmed"],
          damage: "1d8",
          damageType: "radiant"
        }]
      }
    }],

    12: [
      {
        name: "Ability Score Improvement",
        iconId: "ability_score_improvement",
        type: "Passive",
        description:
          "Increase ability scores or take a feat (engine-defined advancement rule).",
        effects: { advancement: [{ type: "ability_score_improvement", choices: ["ability_score", "feat"] }] }
      }
    ]
  },
  subclasses: {
    "Oath of Vengeance": {
      id: "oath_of_vengeance",
      summary: "Relentless hunter who brings retribution to the guilty.",
      features: {
        3: [
          { name: "Vow of Enmity", iconId: "vow_of_enmity", type: "Bonus Action", uses: "shortRest",
            description: "Choose a creature within 10 ft; for 1 minute, you have advantage on attack rolls against it.",
            effects: {
              resources: [{ id: "vow_of_enmity", name: "Vow of Enmity", max: 1, recovery: "short_rest" }],
              actionOptions: [{
                id: "vow_of_enmity",
                name: "Vow of Enmity",
                actionType: "bonus_action",
                resourceId: "vow_of_enmity",
                rangeFt: 10,
                requiresTarget: true,
                targetFilter: { team: "enemies" },
                mark: {
                  id: "vow_of_enmity",
                  label: "Vow of Enmity",
                  duration: { kind: "rounds", rounds: 10, tick: "turn_end" }
                },
                description: "Mark one nearby enemy as your sworn target."
              }],
              modifiers: [{
                id: "vow_of_enmity_attack_advantage",
                target: "self",
                stat: "attack_roll",
                mode: "advantage",
                requiresMark: { id: "vow_of_enmity", source: "self" }
              }]
            } }
        ],
        7: [
          { name: "Chains of Vengeance", iconId: "chains_of_vengeance", type: "Passive",
            description: "Once per round, after your Vow target moves at least 5 feet, it must make a Strength save against your Paladin save DC. On a failure, spectral chains bind it, reducing its Speed to 0 until the start of its next turn.",
            effects: {
              triggeredEffects: [{
                id: "chains_of_vengeance",
                trigger: "marked_target_moves",
                requiresMark: { id: "vow_of_enmity", source: "self" },
                minimumMovementFt: 5,
                limit: "once_per_round",
                save: { ability: "strength", dcFrom: "classSaveDC", onSave: "negates" },
                onFailure: { condition: "chained", duration: { kind: "until_timing", timing: "turn_start" } }
              }]
            } }
        ],
        11: [
          { name: "Relentless Pursuit", iconId: "relentless_pursuit", type: "Passive",
            description: "Your movement increases by 10 ft and opportunity attacks against you are at disadvantage while moving toward your Vow target.",
            effects: {
              modifiers: [
                { id: "relentless_pursuit_speed", target: "self", stat: "speed", amountFt: 10, requiresMark: { id: "vow_of_enmity", source: "self" } },
                { id: "relentless_pursuit_aoo", target: "self", stat: "incoming_attack_roll", mode: "disadvantage", requiresMovementTowardMark: { id: "vow_of_enmity", source: "self" } }
              ]
            } }
        ],
        13: [
          { name: "Executioner’s Verdict", iconId: "executioners_verdict", type: "Special", uses: "longRest",
            description: "Once per long rest, when you hit your Vow target, deal an extra 6d8 radiant damage.",
            effects: {
              resources: [{ id: "executioners_verdict", name: "Executioner's Verdict", max: 1, recovery: "long_rest" }],
              damageRiders: [{
                id: "executioners_verdict",
                name: "Executioner's Verdict",
                trigger: "source_hits_with_attack_roll",
                requiresMark: { id: "vow_of_enmity", source: "self" },
                resourceId: "executioners_verdict",
                damage: "6d8",
                damageType: "radiant"
              }]
            } }
        ]
      }
    },
    "Oath of the Sacred": {
      id: "oath_of_the_sacred",
      summary: "Fusion of Devotion and Ancients—holy light tempered with verdant mercy.",
      features: {
        3: [
          { name: "Radiant Smite", iconId: "radiant_smite", type: "Passive",
            description: "The first time you hit with a melee attack each round, deal an extra 1d6 radiant damage.",
            effects: {
              damageRiders: [{
                id: "radiant_smite",
                name: "Radiant Smite",
                trigger: "source_hits_with_attack_roll",
                actionTags: ["melee"],
                oncePerTurn: true,
                damage: "1d6",
                damageType: "radiant"
              }]
            } }
        ],
        7: [
          { name: "Sanctified Presence", iconId: "sanctified_presence", type: "Passive",
            description: "You and allies within 10 ft have advantage on saves against charm and fear; hostile creatures within 10 ft have disadvantage on saves against charm and fear effects you impose.",
            effects: {
              auras: [
                {
                  id: "sanctified_presence_allies",
                  name: "Sanctified Presence",
                  radiusFt: 10,
                  affects: "self_and_allies",
                  effects: [{
                    id: "sanctified_presence_ally_saves",
                    type: "modifier",
                    stat: "save",
                    mode: "advantage",
                    tags: ["charm", "fear"]
                  }]
                },
                {
                  id: "sanctified_presence_enemies",
                  name: "Sanctified Presence",
                  radiusFt: 10,
                  affects: "enemies",
                  effects: [{
                    id: "sanctified_presence_enemy_saves",
                    type: "modifier",
                    stat: "save",
                    mode: "disadvantage",
                    sourceActorOnly: true,
                    tags: ["charm", "fear"]
                  }]
                }
              ]
            } }
        ],
        11: [
          { name: "Nature’s Aegis", iconId: "natures_aegis", type: "Passive",
            description: "You gain resistance to necrotic and poison damage.",
            effects: { resistances: ["necrotic", "poison"] } }
        ],
        13: [
          { name: "Aura of Renewal", iconId: "aura_of_renewal", type: "Bonus Action", uses: "longRest",
            description: "For 1 minute, the first time each turn you hit a creature, you or an ally within 10 ft regains HP equal to your Charisma modifier.",
            effects: {
              healingRiders: [{
                id: "aura_of_renewal_heal",
                name: "Aura of Renewal",
                trigger: "source_hits_with_attack_roll",
                oncePerTurn: true,
                rangeFt: 10,
                amountFormula: "charisma_modifier"
              }]
            } }
        ]
      }
    },
    "Oath of Glory": {
      id: "oath_of_glory",
      summary: "Heroic exemplar whose prowess inspires daring feats.",
      features: {
        3: [
          { name: "Athletic Prowess", iconId: "athletic_prowess", type: "Passive",
            description: "You have advantage on Athletics and Acrobatics checks; when you Dash, you can jump as part of the move.",
            effects: {
              modifiers: [
                { id: "athletic_prowess_athletics", target: "ability_check", skill: "athletics", mode: "advantage" },
                { id: "athletic_prowess_acrobatics", target: "ability_check", skill: "acrobatics", mode: "advantage" }
              ],
              narrativeTags: ["dash_jump"]
            } }
        ],
        7: [
          { name: "Aura of Alacrity", iconId: "aura_of_alacrity", type: "Passive",
            description: "Your speed increases by 10 ft; enemies within 10 ft lose 10 ft of speed.",
            effects: {
              auras: [
                {
                  id: "aura_of_alacrity_self",
                  name: "Aura of Alacrity",
                  radiusFt: 10,
                  affects: "self",
                  effects: [{ id: "aura_of_alacrity_self_speed", type: "modifier", stat: "speed", amountFt: 10 }]
                },
                {
                  id: "aura_of_alacrity_enemies",
                  name: "Aura of Alacrity",
                  radiusFt: 10,
                  affects: "enemies",
                  effects: [{ id: "aura_of_alacrity_enemy_speed", type: "modifier", stat: "speed", amountFt: -10 }]
                }
              ]
            } }
        ],
        11: [
          { name: "Glorious Challenge", iconId: "glorious_challenge", type: "Bonus Action", uses: "shortRest",
            description: "Choose a creature within 30 ft; it has disadvantage on attacks against others while it can see you until the end of its next turn.",
            effects: {
              resources: [{ id: "glorious_challenge", name: "Glorious Challenge", max: 1, recovery: "short_rest" }],
              actionOptions: [{
                id: "glorious_challenge",
                name: "Glorious Challenge",
                actionType: "bonus_action",
                resourceId: "glorious_challenge",
                rangeFt: 30,
                requiresTarget: true,
                targetFilter: { team: "enemies" },
                effects: [{
                  type: "modifier",
                  trigger: "failed_save",
                  target: "target",
                  stat: "attack_roll",
                  mode: "disadvantage",
                  duration: { kind: "until_timing", timing: "turn_end" }
                }]
              }]
            } }
        ],
        13: [
          { name: "Legend’s Surge", iconId: "legends_surge", type: "Special", uses: "longRest",
            description: "Once per long rest, immediately take an additional action on your turn.",
            effects: {
              resources: [{ id: "legends_surge", name: "Legend's Surge", max: 1, recovery: "long_rest" }],
              actionOptions: [{
                id: "legends_surge",
                name: "Legend's Surge",
                actionType: "free",
                resourceId: "legends_surge",
                requiresTarget: false,
                economyGrant: { actions: 1 }
              }]
            } }
        ]
      }
    }
  }
};
