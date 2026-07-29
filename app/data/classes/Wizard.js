// app/data/classes/Wizard.js
export default {
  id: "wizard",
  name: "Wizard",
  summary: "Scholarly spellcaster who reshapes reality with arcane study.",
  hitDie: 6,
  primaryAbility: ["Intelligence"],
  savingThrows: ["Intelligence", "Wisdom"],
  armor: [],
  weapons: ["Daggers", "Darts", "Slings", "Quarterstaffs", "Light crossbows"],
  tools: [],
  hp: {
    level1: { base: 6, addCon: true },
    perLevel: { base: 4, addCon: true }
  },
  spellcasting: {
    ability: "Intelligence",
    preparation: "prepared",
    ritualCasting: true
  },
  choices: [
    { id: "subclass", kind: "subclass", level: 3, required: true }
  ],
  features: {
    1: [
      {
        name: "Arcane Recovery",
        iconId: "arcane_recovery",
        type: "Special",
        uses: "longRest",
        description:
          "When you finish a Short Rest, you can recover expended spell slots once per Long Rest. The spell slots can have a combined level equal to no more than half your Wizard level (round up), and none of the recovered slots can be 6th level or higher.",
        effects: {
          resources: [{ id: "arcane_recovery", name: "Arcane Recovery", max: 1, recovery: "long_rest" }]
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
    6: [
      {
        name: "Arcane Focus",
        iconId: "arcane_focus",
        type: "Passive",
        description:
          "You have advantage on the first Concentration check you make each round.",
        effects: {
          modifiers: [{
            id: "arcane_focus_concentration",
            target: "self",
            stat: "save",
            ability: "con",
            mode: "advantage",
            tags: ["concentration"],
            oncePerRound: true
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
    10: [
      {
        name: "Jester’s Book of Shortcuts",
        iconId: "jesters_book_of_shortcuts",
        type: "Special",
        description:
          "At 10th level, you gain access to Jester’s Book of Shortcuts, a marginal spellbook containing unsafe arcane techniques. Choose one spell from the book’s list (False Life, Magic Missile, Burning Hands, Thunderwave). You may cast the chosen spell as a cantrip using its lowest-level effect. It cannot be upcast and does not scale with your character level. Like other cantrips, it is always prepared.",
        effects: {
          choiceRequirements: [{
            id: "jesters_book_spell",
            kind: "spell",
            count: 1,
            options: ["false_life_jester", "magic_missile_jester", "burning_hands_jester", "thunderwave_jester"]
          }],
          modifiers: [{ id: "jesters_book_spell_as_cantrip", target: "chosen_spell_as_cantrip", choiceId: "jesters_book_spell", fixedSpellLevel: 1, cannotUpcast: true, scalesWithCharacterLevel: false }]
        }
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
    "Dirt Wizard": {
      id: "dirt_wizard",
      summary: "Indomitable marginal scholar who clings to truth and logic beyond the reach of society.",
      features: {
        3: [
          { name: "Relentless", iconId: "dirt_wizard_relentless", type: "Passive",
            description: "Once per combat, the first time a spell you cast fails to affect any creature (attack miss or all targets succeed their save), you immediately regain the expended slot (up to 3rd level) and gain temporary HP equal to your INT modifier. In exploration, treat any roll of 9 or lower on Arcana or Investigation as a 10.",
            effects: {
              triggeredEffects: [{
                id: "dirt_wizard_relentless",
                trigger: "spell_affects_no_creatures",
                oncePerCombat: true,
                restoreSlotMaxLevel: 3,
                temporaryHpFormula: "intelligence_modifier"
              }],
              modifiers: [{ id: "relentless_arcana_investigation_floor", target: "ability_check", skills: ["arcana", "investigation"], floorD20: 10 }]
            } }
        ],
        7: [
          { name: "Grit of the Marginal", iconId: "grit_of_the_marginal", type: "Passive",
            description: "When you start your turn below half HP, gain temporary HP equal to twice your INT modifier.",
            effects: {
              triggeredEffects: [{
                id: "grit_of_the_marginal",
                trigger: "turn_start",
                sourceHpBelowFraction: 0.5,
                temporaryHpFormula: "2*intelligence_modifier"
              }]
            } }
        ],
        11: [
          { name: "Truth in Shards", iconId: "truth_in_shards", type: "Passive",
            description: "The first time each turn you deal damage with a spell, add +1d8 force damage. Your damaging spells ignore resistance to force damage.",
            effects: {
              damageRiders: [{
                id: "truth_in_shards_force",
                name: "Truth in Shards",
                trigger: "source_deals_damage",
                actionTags: ["spell"],
                oncePerTurn: true,
                damage: "1d8",
                damageType: "force"
              }],
              modifiers: [{ id: "truth_in_shards_ignore_force_resistance", target: "spell_damage", damageType: "force", ignoreResistance: true }]
            } }
        ],
        13: [
          { name: "Indomitability", iconId: "dirt_wizard_indomitability", type: "Special", uses: "longRest",
            description: "Once per long rest, when you would be reduced to 0 HP, instead drop to 1 HP and immediately regain your highest expended spell slot of 5th level or lower.",
            effects: {
              resources: [{ id: "dirt_wizard_indomitability", name: "Indomitability", max: 1, recovery: "long_rest" }],
              reactions: [{
                id: "dirt_wizard_indomitability",
                name: "Indomitability",
                trigger: "would_drop_to_zero",
                resourceId: "dirt_wizard_indomitability",
                leaveAtHp: 1,
                restoreSlotMaxLevel: 5
              }]
            } }
        ]
      }
    },
    "Necromancer": {
      id: "necromancer",
      summary: "High Chair of the Pale — the sanctioned, elite master of death, wielding seals and edicts with bureaucratic authority.",
      features: {
        3: [
          { name: "Seal of Mortality", iconId: "seal_of_mortality", type: "Passive",
            description: "Once per combat, the first time your spell deals necrotic damage, the target becomes sealed until the end of your next turn: your spells deal +1d6 necrotic to it and it cannot regain HP. In exploration, you gain proficiency in Medicine; if already proficient, you double your proficiency bonus.",
            effects: {
              expertise: [{ kind: "skill", id: "medicine" }],
              conditionRiders: [{
                id: "seal_of_mortality",
                name: "Seal of Mortality",
                trigger: "source_deals_damage",
                actionTags: ["spell"],
                damageTypes: ["necrotic"],
                oncePerCombat: true,
                condition: "healing_blocked",
                duration: { kind: "until_timing", timing: "turn_end" }
              }],
              damageRiders: [{
                id: "seal_of_mortality_damage",
                name: "Seal of Mortality",
                trigger: "source_deals_damage",
                actionTags: ["spell"],
                damageTypes: ["necrotic"],
                requiresConditionOnTarget: "healing_blocked",
                damage: "1d6",
                damageType: "necrotic"
              }]
            } }
        ],
        7: [
          { name: "Black Aegis", iconId: "black_aegis", type: "Passive",
            description: "You have resistance to necrotic damage. The first time on your turn that any creature takes necrotic damage from your spell, you regain HP equal to your INT modifier (min 1). This healing occurs once per turn, no matter how many creatures are affected. In addition, the first undead you target on your turn has disadvantage on the first saving throw it makes against your spell that turn.",
            effects: {
              resistances: ["necrotic"],
              healingRiders: [{
                id: "black_aegis_heal",
                name: "Black Aegis",
                trigger: "source_deals_damage",
                actionTags: ["spell"],
                damageTypes: ["necrotic"],
                target: "self",
                oncePerTurn: true,
                amountFormula: "intelligence_modifier"
              }],
              modifierRiders: [{
                id: "black_aegis_undead_save_disadvantage",
                name: "Black Aegis",
                trigger: "source_targets_undead",
                stat: "save",
                mode: "disadvantage",
                oncePerTurn: true
              }]
            } }
        ],
        11: [
          { name: "Mortmain (The Dead Hand)", iconId: "mortmain", type: "Passive",
            description: "Once per turn, when you deal necrotic damage to a creature, that creature is under Mortmain until the end of your next turn: it cannot take reactions, its speed is halved, and it cannot regain HP.",
            effects: {
              conditionRiders: [{
                id: "mortmain",
                name: "Mortmain",
                trigger: "source_deals_damage",
                damageTypes: ["necrotic"],
                oncePerTurn: true,
                condition: "mortmain",
                duration: { kind: "until_timing", timing: "turn_end" }
              }]
            } }
        ],
        13: [
          { name: "Final Edict", iconId: "final_edict", type: "Action", uses: "longRest",
            description: "As an action once per long rest, choose a point you can see within 60 ft. All creatures in a 20-ft-radius sphere centered there must make a CON save. On a fail: they take 8d6 necrotic damage, cannot regain HP for 1 minute, and are frightened of you until the end of your next turn. On a success: they take half damage and cannot regain HP until the end of your next turn. This ability is a magical effect and does not consume a spell slot.",
            effects: {
              resources: [{ id: "final_edict", name: "Final Edict", max: 1, recovery: "long_rest" }],
              actionOptions: [{
                id: "final_edict",
                name: "Final Edict",
                actionType: "action",
                resourceId: "final_edict",
                rangeFt: 60,
                targeting: { shape: "radius", radiusFt: 20 },
                save: { ability: "constitution", dcFrom: "spellSaveDC", onSuccess: "half" },
                damage: { dice: "8d6", type: "necrotic" },
                effects: [
                  { type: "condition", trigger: "failed_save", condition: "healing_blocked", duration: { kind: "rounds", rounds: 10, tick: "turn_end" } },
                  { type: "condition", trigger: "failed_save", condition: "frightened", duration: { kind: "until_timing", timing: "turn_end" } }
                ]
              }]
            } }
        ]
      }
    },
    "Battlemage": {
      id: "battlemage",
      summary: "Court-trained warcaster who unites steel and spell; a duelist whose blade is an arcane instrument.",
      features: {
        3: [
          { name: "Arcane Armament", iconId: "arcane_armament", type: "Passive",
            description: "You gain proficiency with all regular and martial weapons. Choose one weapon you are proficient with as your arcane armament; it remains your armament until you choose to change it after a long rest. You use INT for attack and damage rolls with your arcane armament, instead of STR or DEX. Whenever you cast a leveled spell, the next time you hit with your arcane armament before the end of your next turn it deals extra force damage equal to your proficiency bonus.",
            effects: {
              proficiencies: { weapons: ["Simple weapons", "Martial weapons"] },
              choiceRequirements: [{ id: "arcane_armament_weapon", kind: "weapon", count: 1 }],
              modifiers: [
                { id: "arcane_armament_attack_ability", target: "chosen_weapon_attack_ability", choiceId: "arcane_armament_weapon", ability: "intelligence" },
                { id: "arcane_armament_damage_ability", target: "chosen_weapon_damage_ability", choiceId: "arcane_armament_weapon", ability: "intelligence" }
              ],
              damageRiders: [{
                id: "arcane_armament_force",
                name: "Arcane Armament",
                trigger: "source_hits_with_attack_roll",
                actionTags: ["melee"],
                requiresPriorActionTag: "leveled_spell",
                consumeOnUse: true,
                damage: "proficiency_bonus",
                damageType: "force"
              }]
            } }
        ],
        5: [
          { name: "Bonded Accuracy +1", iconId: "bonded_accuracy_1", type: "Passive",
            description: "You gain a +1 bonus to attack rolls made with your arcane armament.",
            effects: { modifiers: [{ id: "bonded_accuracy_1", target: "arcane_armament_attack", stat: "attack_roll", amount: 1 }] } }
        ],
        7: [
          { name: "Spell Rhythm", iconId: "spell_rhythm", type: "Bonus Action", uses: "shortRest",
            description: "As a bonus action, once per short rest, you may enter a spell rhythm for one minute. In this state, a melee attack action is doubled by the casting of a cantrip or the casting of a cantrip is doubled by a free melee attack.",
            effects: {
              resources: [{ id: "spell_rhythm", name: "Spell Rhythm", max: 1, recovery: "short_rest" }],
              actionOptions: [{
                id: "spell_rhythm",
                name: "Spell Rhythm",
                actionType: "bonus_action",
                resourceId: "spell_rhythm",
                requiresTarget: false,
                activeEffectOnResolve: {
                  id: "spell_rhythm_active",
                  label: "Spell Rhythm",
                  duration: { kind: "rounds", rounds: 10, tick: "turn_end" },
                  spellRhythm: true
                }
              }]
            } }
        ],
        10: [
          { name: "Bonded Accuracy +2", iconId: "bonded_accuracy_2", type: "Passive",
            description: "Your bonus to attack rolls made with your arcane armament increases to +2.",
            effects: { modifiers: [{ id: "bonded_accuracy_2", target: "arcane_armament_attack", stat: "attack_roll", amount: 2 }] } }
        ],
        11: [
          { name: "Martial Sigils", iconId: "martial_sigils", type: "Passive",
            description: "While wielding your arcane armament, you gain +1 AC. Once per turn when you hit with a melee attack, you can choose to mark the target with a sigil, forcing it to make its next attack roll at disadvantage before the end of its next turn.",
            effects: {
              modifiers: [{ id: "martial_sigils_ac", target: "self", stat: "ac", amount: 1 }],
              conditionRiders: [{
                id: "martial_sigils_mark",
                name: "Martial Sigils",
                trigger: "source_hits_with_attack_roll",
                actionTags: ["melee"],
                target: "target",
                oncePerTurn: true,
                condition: "next_attack_disadvantage",
                duration: { kind: "rounds", rounds: 1, tick: "turn_end" }
              }]
            } }
        ],
        13: [
          { name: "Crescendo Duel", iconId: "crescendo_duel", type: "Bonus Action", uses: "longRest",
            description: "As a bonus action, once per long rest, you may enter a crescendo for one minute. While it lasts, when you hit with your arcane armament, add +2d8 force damage. In addition, once on each of your turns when you cast a spell, you may also make one melee attack with your arcane armament as a bonus action.",
            effects: {
              resources: [{ id: "crescendo_duel", name: "Crescendo Duel", max: 1, recovery: "long_rest" }],
              damageRiders: [{
                id: "crescendo_duel_force",
                name: "Crescendo Duel",
                trigger: "source_hits_with_attack_roll",
                actionTags: ["melee"],
                damage: "2d8",
                damageType: "force"
              }],
              triggeredEffects: [{
                id: "crescendo_duel_spell_followup",
                trigger: "source_casts_spell",
                limit: "once_per_turn",
                grantAction: { kind: "basic_melee_attack", actionType: "bonus_action" }
              }]
            } }
        ]
      }
    }
  }
};
