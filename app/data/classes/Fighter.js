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
  id: "fighter",
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
  choices: [
    { id: "subclass", kind: "subclass", level: 3, required: true }
  ],
  features: {
    1: [
      {
        name: "Weapon Mastery",
        iconId: "weapon_mastery",
        type: "Passive",
        description: "Choose three weapons whose mastery properties you can use.",
        effects: {
          weaponMastery: [{ count: 3 }]
        }
      },
      {
        name: "Second Wind",
        iconId: "second_wind",
        type: "Bonus Action",
        uses: "shortRest",
        description: "Regain 1d10 + your level HP.",
        effects: {
          resources: [{ id: "second_wind", name: "Second Wind", max: 1, recovery: "short_rest" }],
          actionOptions: [{ id: "second_wind", iconId: "second_wind", actionType: "bonus_action", healingFormula: "1d10 + level" }]
        }
      }
    ],
    2: [
      {
        name: "Action Surge",
        iconId: "action_surge",
        type: "Special",
        uses: "shortRest",
        description: "Take one additional action on your turn.",
        effects: {
          resources: [{ id: "action_surge", name: "Action Surge", max: 1, recovery: "short_rest" }],
          actionOptions: [{
            id: "action_surge",
            iconId: "action_surge",
            name: "Action Surge",
            actionType: "free",
            resourceId: "action_surge",
            economyGrant: { actions: 1 },
            description: "Regain one action on your turn."
          }]
        }
      }
    ],
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
      {
        name: "Extra Attack",
        iconId: "extra_attack_plus_1",
        type: "Passive",
        description: "When you take the Attack action, you can make two attacks.",
        effects: { attackAction: [{ attacks: 2 }] }
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
    11: [
      {
        name: "Extra Attack (2)",
        iconId: "extra_attack_plus_2",
        type: "Passive",
        description: "When you take the Attack action, you can make three attacks.",
        effects: { attackAction: [{ attacks: 3 }] }
      }
    ],
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
    "Champion": {
      id: "champion",
      summary: "Steadfast paragon who turns steady blows into heroic finishes.",
      features: {
        3: [
          {
            name: "Execute",
            iconId: "champion_execute",
            type: "Special",
            uses: "shortRest",
            description: "When you hit a creature that is below 25% of its max HP, add +2d8 damage.",
            effects: {
              resources: [{ id: "champion_execute", name: "Execute", max: 1, recovery: "short_rest" }],
              damageRiders: [{
                id: "champion_execute",
                name: "Execute",
                trigger: "source_hits_with_attack_roll",
                actionTags: ["weapon"],
                targetHpBelowFraction: 0.25,
                oncePerTurn: true,
                resourceId: "champion_execute",
                damage: "2d8",
                damageType: "same_as_action"
              }]
            }
          }
        ],
        7: [
          { name: "Second Wind Upgrade", iconId: "second_wind", type: "Passive",
            description: "When you use Second Wind, you also gain advantage on your next attack before the end of your turn.",
            effects: {
              triggeredEffects: [{
                id: "champion_second_wind_upgrade",
                trigger: "source_uses_action",
                actionId: "second_wind",
                applyEffect: {
                  type: "modifier",
                  stat: "attack_roll",
                  mode: "advantage",
                  duration: { kind: "until_timing", timing: "turn_end" },
                  consumeOn: "outgoing_attack"
                }
              }]
            } }
        ],
        11: [
          { name: "Unyielding Stance", iconId: "unyielding_stance", type: "Special",
            description: "Once per combat, when you would be reduced to 0 HP, you stay at 1 HP instead.",
            effects: {
              reactions: [{
                id: "unyielding_stance",
                name: "Unyielding Stance",
                trigger: "would_drop_to_zero",
                resourceId: "unyielding_stance",
                leaveAtHp: 1,
                resource: { id: "unyielding_stance", name: "Unyielding Stance", max: 1, recovery: "combat" }
              }],
              resources: [{ id: "unyielding_stance", name: "Unyielding Stance", max: 1, recovery: "combat" }]
            } }
        ]
      }
    },
    "Duelist": {
      id: "duelist",
      summary: "Swift, precise fencer who punishes openings and avoids harm.",
      features: {
        3: [
          { name: "Flourish", iconId: "duelist_flourish", type: "Passive",
            description: "Once per turn when you hit with a melee attack, you gain +2 AC until the start of your next turn.",
            effects: {
              modifierRiders: [{
                id: "duelist_flourish",
                name: "Flourish",
                trigger: "source_hits_with_attack_roll",
                actionTags: ["melee"],
                target: "self",
                oncePerTurn: true,
                stat: "ac",
                amount: 2,
                duration: { kind: "until_timing", timing: "turn_start" }
              }]
            } }
        ],
        7: [
          { name: "Evasive Step", iconId: "duelist_evasive_step", type: "Passive",
            description: "When an adjacent enemy misses you with a melee attack, you may make one basic melee weapon attack against it.",
            effects: {
              reactions: [{
                id: "duelist_evasive_step",
                name: "Evasive Step",
                trigger: "missed_by_melee_attack",
                meleeOnly: true,
                rangeFt: 5,
                target: "attacker",
                actionKind: "basic_melee_attack"
              }]
            } }
        ],
        11: [
          { name: "Deadly Precision", iconId: "duelist_deadly_precision", type: "Passive",
            description: "Your critical hits with finesse weapons roll one additional damage die.",
            effects: {
              damageRiders: [{
                id: "duelist_deadly_precision",
                name: "Deadly Precision",
                trigger: "source_hits_with_attack_roll",
                actionTags: ["melee"],
                criticalOnly: true,
                damage: "1d8",
                damageType: "same_as_action"
              }]
            } }
        ]
      }
    },
    "Berserker": {
      id: "berserker",
      summary: "Primal fury in human form: devastates foes in surging rages.",
      features: {
        3: [
          { name: "Rage", iconId: "rage", type: "Bonus Action", uses: "longRest:3",
            description: "Enter a 1-minute rage: advantage on STR checks/saves, +2 melee damage with STR, resistance to bludgeoning/piercing/slashing. Ends early if you don’t attack or take damage on your turn.",
            effects: {
              resources: [{ id: "rage", name: "Rage", max: 3, recovery: "long_rest" }],
              actionOptions: [{
                id: "rage",
                iconId: "rage",
                name: "Rage",
                actionType: "bonus_action",
                resourceId: "rage",
                requiresTarget: false,
                effects: [
                  { type: "modifier", trigger: "failed_save", target: "self", stat: "save", ability: "str", mode: "advantage", duration: { kind: "rounds", rounds: 10, tick: "turn_end" } },
                  { type: "modifier", trigger: "failed_save", target: "self", stat: "damage_reduction", damageType: "bludgeoning", multiplier: 0.5, duration: { kind: "rounds", rounds: 10, tick: "turn_end" } },
                  { type: "modifier", trigger: "failed_save", target: "self", stat: "damage_reduction", damageType: "piercing", multiplier: 0.5, duration: { kind: "rounds", rounds: 10, tick: "turn_end" } },
                  { type: "modifier", trigger: "failed_save", target: "self", stat: "damage_reduction", damageType: "slashing", multiplier: 0.5, duration: { kind: "rounds", rounds: 10, tick: "turn_end" } }
                ]
              }],
              damageRiders: [{
                id: "rage_melee_damage",
                name: "Rage",
                trigger: "source_hits_with_attack_roll",
                actionTags: ["melee"],
                damage: "2",
                damageType: "same_as_action"
              }]
            } },
          { name: "Reckless Attack", iconId: "reckless_attack", type: "Special",
            description: "On your turn, you can gain advantage on STR melee attacks; attacks against you have advantage until your next turn.",
            effects: {
              actionOptions: [{
                id: "reckless_attack",
                iconId: "reckless_attack",
                name: "Reckless Attack",
                actionType: "free",
                requiresTarget: false,
                effects: [
                  { type: "modifier", trigger: "failed_save", target: "self", stat: "attack_roll", mode: "advantage", duration: { kind: "until_timing", timing: "turn_start" } },
                  { type: "modifier", trigger: "failed_save", target: "self", stat: "incoming_attack_roll", mode: "advantage", duration: { kind: "until_timing", timing: "turn_start" } }
                ]
              }]
            } },
          { name: "Execute", iconId: "berserker_execute", type: "Action", uses: "longRest:1",
            description: "While raging, once per turn when you hit, deal +1d6 damage to that target. If you had advantage on the attack, +1d6 more.",
            effects: {
              resources: [{ id: "berserker_execute", name: "Execute", max: 1, recovery: "long_rest" }],
              damageRiders: [{
                id: "berserker_execute",
                name: "Execute",
                trigger: "source_hits_with_attack_roll",
                actionTags: ["melee"],
                oncePerTurn: true,
                resourceId: "berserker_execute",
                damage: "1d6",
                damageType: "same_as_action"
              }]
            } }
        ],
        7: [
          { name: "Primal Roar", iconId: "primal_roar", type: "Bonus Action", uses: "shortRest:1",
            description: "While raging, unleash a roar. Creatures of your choice within 10 ft must succeed on a WIS save or be frightened until the end of your next turn.",
            effects: {
              resources: [{ id: "primal_roar", name: "Primal Roar", max: 1, recovery: "short_rest" }],
              actionOptions: [{
                id: "primal_roar",
                iconId: "primal_roar",
                name: "Primal Roar",
                actionType: "bonus_action",
                resourceId: "primal_roar",
                rangeFt: 10,
                targeting: { mode: "nearby_actors" },
                targetFilter: { team: "enemies" },
                save: { ability: "wisdom", dcFrom: "classSaveDC" },
                effects: [{
                  type: "condition",
                  trigger: "failed_save",
                  condition: "frightened",
                  duration: { kind: "rounds", rounds: 1, tick: "turn_end" }
                }],
                description: "Frighten nearby enemies on a failed Wisdom save."
              }]
            } }
        ],
        11: [
          { name: "Savage Momentum", iconId: "savage_momentum", type: "Special",
            description: "Once per rage, when you reduce a creature to 0 HP, immediately make one bonus-action melee attack against another target.",
            effects: {
              triggeredEffects: [{
                id: "savage_momentum",
                trigger: "source_reduces_target_to_zero",
                limit: "once_per_rage",
                grantAction: { kind: "basic_melee_attack", actionType: "bonus_action", target: "another_enemy" }
              }]
            } }
        ]
      }
    }
  }
};
