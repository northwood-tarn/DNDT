export default {
  id: "cleric",
  name: "Cleric",
  summary: "Devout spellcaster who channels divine power for healing, protection, and radiant wrath.",
  hitDie: 8,
  hp: {
    level1: { base: 8, addCon: true },
    perLevel: { base: 5, addCon: true }
  },
  primaryAbility: ["Wisdom"],
  savingThrows: ["Wisdom", "Charisma"],
  armor: ["Light armor", "Medium armor", "Shields"],
  weapons: ["Simple weapons"],
  tools: [],
  spellcasting: {
    ability: "Wisdom",
    preparation: "prepared",
    ritualCasting: true
  },
  choices: [
    { id: "subclass", kind: "subclass", level: 3, required: true }
  ],
  features: {
    2: [
      {
        name: "Turn Undead (Channel Divinity)",
        iconId: "turn_undead",
        type: "Action",
        uses: "channelDivinity",
        description:
          "Present your holy symbol to unleash divine force. Each undead of your choice within range makes a WIS save. On a failed save, it is Turned for 1 minute (or until it takes damage). A Turned creature must spend its turns moving away from you by the safest available route and can’t willingly move closer. It can’t take reactions. It can take only the Dash action or try to escape from an effect that prevents it from moving. If it can’t move, it can take the Dodge action. (Engine: applies any setting-specific undead tier resistances.)",
        effects: {
          resources: [{ id: "channel_divinity", name: "Channel Divinity", max: 2, recovery: "long_rest" }],
          actionOptions: [{
            id: "turn_undead",
            name: "Turn Undead",
            actionType: "action",
            resourceId: "channel_divinity",
            rangeFt: 30,
            targeting: { mode: "nearby_actors" },
            targetFilter: { team: "enemies", creatureTypes: ["undead"] },
            save: { ability: "wisdom", dcFrom: "spellSaveDC" },
            effects: [{
              type: "condition",
              trigger: "failed_save",
              condition: "turned",
              duration: { rounds: 10, tick: "turn_end" }
            }],
            description: "Spend Channel Divinity to turn nearby undead."
          }]
        }
      },
      {
        name: "Harness Divine Power (Channel Divinity)",
        iconId: "harness_divine_power",
        type: "Action",
        uses: "channelDivinity",
        description:
          "Spend a Channel Divinity use to restore your highest expended eligible spell slot. The slot can be no higher than half your Proficiency Bonus, rounded up.",
        effects: {
          actionOptions: [{
            id: "harness_divine_power",
            name: "Harness Divine Power",
            actionType: "action",
            resourceId: "channel_divinity",
            restoresResource: "spell_slot",
            resourceRestore: { resourceId: "spell_slot", amount: 1, maxLevelFormula: "half_proficiency_bonus_rounded_up" },
            amount: 1,
            description: "Spend Channel Divinity to restore your highest expended eligible spell slot."
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
        name: "Sear Undead (Channel Divinity)",
        iconId: "sear_undead",
        type: "Action",
        uses: "channelDivinity",
        description:
          "As an alternative Channel Divinity option, you brand undead with radiant judgment. Each undead of your choice within range makes a WIS save. On a failed save, it takes radiant damage based on its undead tier: Profane 3d8, Bound 2d8, Sovereign 1d8; on a successful save, it takes half damage. This damage increases for each rank by 1d8 at cleric level 8 and again at cleric level 13 (engine-defined).",
        effects: {
          actionOptions: [{
            id: "sear_undead",
            name: "Sear Undead",
            actionType: "action",
            resourceId: "channel_divinity",
            rangeFt: 30,
            targeting: { mode: "nearby_actors" },
            targetFilter: { team: "enemies", creatureTypes: ["undead"] },
            save: { ability: "wisdom", dcFrom: "spellSaveDC", onSuccess: "half" },
            damageByTargetProperty: {
              property: "undeadRank",
              default: "1d8",
              values: { profane: "3d8", bound: "2d8", sovereign: "1d8" },
              scaling: [{ minLevel: 8, addDice: 1 }, { minLevel: 13, addDice: 1 }]
            },
            damageType: "radiant",
            description: "Spend Channel Divinity to damage nearby undead."
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
    12: [
      {
        name: "Ability Score Improvement",
        iconId: "ability_score_improvement",
        type: "Passive",
        description:
          "Increase ability scores or take a feat (engine-defined advancement rule).",
        effects: { advancement: [{ type: "ability_score_improvement", choices: ["ability_score", "feat"] }] }
      }
    ],
  },
  subclasses: {
    "Grave Domain": {
      id: "grave_domain",
      summary: "Guardian against profane undeath; punishes necromancy and guides souls.",
      features: {
        3: [
          { name: "Grave’s Rebuke (Channel Divinity)", iconId: "graves_rebuke", type: "Action", uses: "channelDivinity",
            description: "Force one creature within 30 ft that dealt necrotic damage since your last turn to make a CON save; on failure it takes 4d8 radiant damage, all critical hits are suppressed until the end of your next turn, and its next necrotic damage is halved; on success it takes half damage and no riders.",
            effects: {
              actionOptions: [{
                id: "graves_rebuke",
                name: "Grave's Rebuke",
                actionType: "action",
                resourceId: "channel_divinity",
                rangeFt: 30,
                requiresTarget: true,
                targetFilter: { team: "enemies" },
                save: { ability: "constitution", dcFrom: "spellSaveDC", onSuccess: "half" },
                damage: { dice: "4d8", type: "radiant" },
                effects: [{
                  type: "condition",
                  trigger: "failed_save",
                  condition: "grave_rebuked",
                  duration: { kind: "until_timing", timing: "turn_end" }
                }],
                description: "Spend Channel Divinity to rebuke one enemy within 30 ft."
              }]
            } }
        ],
        7: [
          { name: "Sentinel at Death’s Door", iconId: "sentinel_at_deaths_door", type: "Reaction", uses: "shortRest",
            description: "When an ally within 30 ft would be critically hit, you cancel the critical (it becomes a normal hit).",
            effects: {
              resources: [{ id: "sentinel_at_deaths_door", name: "Sentinel at Death's Door", max: 1, recovery: "short_rest" }],
              reactions: [{
                id: "sentinel_at_deaths_door",
                name: "Sentinel at Death's Door",
                trigger: "ally_would_take_critical_hit",
                resourceId: "sentinel_at_deaths_door",
                rangeFt: 30,
                suppressCritical: true
              }]
            } }
        ],
        11: [
          { name: "Keeper of Souls", iconId: "keeper_of_souls", type: "Bonus Action",
            description: "When an enemy dies within 30 ft of you dies, you can elect regain HP equal to your Wisdom modifier (once per round). You can’t benefit from healing spells until the start of your next turn.",
            effects: {
              triggeredEffects: [{
                id: "keeper_of_souls",
                trigger: "enemy_dies_nearby",
                rangeFt: 30,
                limit: "once_per_round",
                healingFormula: "wisdom_modifier",
                selfCondition: { condition: "healing_blocked", duration: { kind: "until_timing", timing: "turn_start" } }
              }]
            } }
        ],
        13: [
          { name: "Reaper’s Shroud", iconId: "reapers_shroud", type: "Bonus Action", uses: "longRest",
            description: "For 1 minute, your radiant and necrotic spells deal +1d8 damage, and you gain resistance to necrotic.",
            effects: {
              resources: [{ id: "reapers_shroud", name: "Reaper's Shroud", max: 1, recovery: "long_rest" }],
              actionOptions: [{
                id: "reapers_shroud",
                name: "Reaper's Shroud",
                actionType: "bonus_action",
                resourceId: "reapers_shroud",
                requiresTarget: false,
                effects: [{ type: "modifier", trigger: "failed_save", target: "self", stat: "damage_reduction", damageType: "necrotic", die: "0", duration: { kind: "rounds", rounds: 10, tick: "turn_end" } }]
              }],
              damageRiders: [{
                id: "reapers_shroud_damage",
                name: "Reaper's Shroud",
                trigger: "source_deals_damage",
                actionTags: ["spell"],
                damageTypes: ["radiant", "necrotic"],
                damage: "1d8",
                damageType: "same_as_action"
              }]
            } }
        ]
      }
    },
    "Lantern Domain": {
      id: "lantern_domain",
      summary: "Bearer of sacred light; turns darkness into a weapon and shield.",
      features: {
        3: [
          { name: "Radiance of the Dawn (Channel Divinity)", iconId: "radiance_of_the_dawn", type: "Action", uses: "channelDivinity",
            description: "Dispel magical darkness within 30 ft and deal 2d10 + level radiant damage (CON save half) to hostile creatures within 30 ft. Your speed becomes 0 until the end of your next turn.",
            effects: {
              actionOptions: [{
                id: "radiance_of_the_dawn",
                name: "Radiance of the Dawn",
                actionType: "action",
                resourceId: "channel_divinity",
                rangeFt: 30,
                targeting: { mode: "nearby_actors" },
                targetFilter: { team: "enemies" },
                save: { ability: "constitution", dcFrom: "spellSaveDC", onSuccess: "half" },
                damage: { dice: "2d10+level", type: "radiant" },
                description: "Spend Channel Divinity to damage nearby hostile creatures with radiant light."
              }]
            } }
        ],
        7: [
          { name: "Lantern’s Pulse", iconId: "lanterns_pulse", type: "Bonus Action", uses: "shortRest",
            description: "Emit a 10‑ft pulse of light; enemies in the area must make a CON save or be blinded until the start of your next turn.",
            effects: {
              resources: [{ id: "lantern_pulse", name: "Lantern's Pulse", max: 1, recovery: "short_rest" }],
              actionOptions: [{
                id: "lantern_pulse",
                iconId: "lanterns_pulse",
                name: "Lantern's Pulse",
                actionType: "bonus_action",
                resourceId: "lantern_pulse",
                rangeFt: 10,
                targeting: { mode: "nearby_actors" },
                targetFilter: { team: "enemies" },
                save: { ability: "constitution", dcFrom: "spellSaveDC" },
                effects: [{
                  type: "condition",
                  trigger: "failed_save",
                  condition: "blinded",
                  duration: { kind: "rounds", rounds: 1, tick: "turn_end" }
                }],
                description: "Enemies within 10 ft make a Constitution save or become Blinded until the start of your next turn."
              }]
            } }
        ],
        11: [
          { name: "Judging Flame", iconId: "judging_flame", type: "Passive",
            description: "The first time each turn your spell deals radiant damage, add your Wisdom modifier to that damage.",
            effects: {
              damageRiders: [{
                id: "lantern_judging_flame",
                name: "Judging Flame",
                trigger: "source_deals_damage",
                actionTags: ["spell"],
                damageTypes: ["radiant"],
                oncePerTurn: true,
                damage: "wisdom_modifier",
                damageType: "radiant"
              }]
            } }
        ],
        13: [
          { name: "Halo of Daybreak", iconId: "halo_of_daybreak", type: "Action", uses: "longRest",
            description: "Create a 15-ft radius aura of bright light for 1 minute; you and allies inside have advantage on saves vs. fear and charm; enemies that start in the aura take radiant damage equal to your Wisdom modifier. Enemies in the aura have advantage on attack rolls against you.",
            effects: {
              resources: [{ id: "halo_of_daybreak", name: "Halo of Daybreak", max: 1, recovery: "long_rest" }],
              actionOptions: [{
                id: "halo_of_daybreak",
                name: "Halo of Daybreak",
                actionType: "action",
                resourceId: "halo_of_daybreak",
                requiresTarget: false,
                createsCombatObject: {
                  id: "halo_of_daybreak",
                  name: "Halo of Daybreak",
                  shape: "radius",
                  radiusFt: 15,
                  followsSource: true,
                  duration: { kind: "rounds", rounds: 10, tick: "turn_end" },
                  logSummary: "15-ft aura for 10 rounds: allies gain advantage on saves against fear and charm; enemies take radiant damage equal to your Wisdom modifier at the start of their turns and gain advantage on attacks against you.",
                  effects: [
                    {
                      id: "halo_fear_charm_save_advantage",
                      type: "modifier",
                      trigger: "passive",
                      stat: "save",
                      mode: "advantage",
                      affects: "allies",
                      tags: ["fear", "charm"]
                    },
                    {
                      id: "halo_enemy_start_damage",
                      type: "damage",
                      trigger: "turn_start",
                      affects: "enemies",
                      damage: "wisdom_modifier",
                      damageType: "radiant"
                    },
                    {
                      id: "halo_enemy_attack_advantage_vs_source",
                      type: "modifier",
                      trigger: "passive",
                      stat: "attack_roll",
                      mode: "advantage",
                      affects: "enemies",
                      targetSourceActorOnly: true
                    }
                  ]
                }
              }]
            } }
        ]
      }
    },
    "War Domain": {
      id: "war_domain",
      summary: "Battle-minded priest who channels divine force through martial prowess.",
      features: {
        3: [
          { name: "Warpriest (Channel Divinity)", iconId: "warpriest", type: "Bonus Action", uses: "channelDivinity",
            description: "Spend a Channel Divinity use to make one weapon attack as a bonus action this turn. Until the end of your next turn, you can’t cast spells of 1st level or higher.",
            effects: {
              actionOptions: [{
                id: "warpriest",
                name: "Warpriest",
                actionType: "bonus_action",
                actionKind: "basic_weapon_attack",
                resourceId: "channel_divinity",
                requiresTarget: true,
                rangeFt: 5,
                targetFilter: { team: "enemies" },
                description: "Spend Channel Divinity to make one weapon attack as a bonus action this turn."
              }]
            } }
        ],
        7: [
          { name: "Guided Strike", iconId: "guided_strike", type: "Reaction", uses: "shortRest",
            description: "When you miss with an attack, add +5 to the roll after seeing the result.",
            effects: {
              resources: [{ id: "guided_strike", name: "Guided Strike", max: 1, recovery: "short_rest" }],
              reactions: [{
                id: "guided_strike",
                name: "Guided Strike",
                trigger: "source_misses_attack",
                resourceId: "guided_strike",
                attackRollBonus: 5,
                retryHitCheck: true
              }]
            } }
        ],
        11: [
          { name: "Divine Strike", iconId: "divine_strike", type: "Passive",
            description: "Once per turn when you hit with a weapon attack, deal an extra 1d8 radiant or force damage.",
            effects: {
              damageRiders: [{
                id: "war_domain_divine_strike",
                name: "Divine Strike",
                trigger: "source_hits_with_attack_roll",
                actionTags: ["weapon"],
                oncePerTurn: true,
                damage: "1d8",
                damageType: "radiant"
              }]
            } }
        ],
        13: [
          { name: "Relentless Advance", iconId: "relentless_advance", type: "Bonus Action", uses: "longRest",
            description: "For 1 minute, you have advantage on melee attack rolls. You can’t take the Dodge action, and opportunity attacks against you have advantage.",
            effects: {
              resources: [{ id: "relentless_advance", name: "Relentless Advance", max: 1, recovery: "long_rest" }],
              actionOptions: [{
                id: "relentless_advance",
                name: "Relentless Advance",
                actionType: "bonus_action",
                resourceId: "relentless_advance",
                requiresTarget: false,
                effects: [
                  { type: "modifier", trigger: "failed_save", target: "self", stat: "attack_roll", mode: "advantage", duration: { kind: "rounds", rounds: 10, tick: "turn_end" } },
                  { type: "modifier", trigger: "failed_save", target: "self", stat: "incoming_attack_roll", mode: "advantage", duration: { kind: "rounds", rounds: 10, tick: "turn_end" } }
                ]
              }]
            } }
        ]
      }
    }
  }
};
