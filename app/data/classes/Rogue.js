import { DEVICE_RECIPE_LIST } from "../deviceRecipes.js";

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
  id: "rogue",
  name: "Rogue",
  summary: "Agile skirmisher; excels at stealth, skills, and precision strikes.",
  hitDie: 8,
  hp: {
    level1: { base: 8, addCon: true },
    perLevel: { base: 5, addCon: true }
  },
  primaryAbility: ["Dexterity"],
  savingThrows: ["Dexterity", "Intelligence"],
  armor: ["Light armor"],
  weapons: ["Simple weapons", "Hand crossbows", "Longswords", "Rapiers", "Shortswords"],
  tools: ["thieves_tools"],
  choices: [
    { id: "subclass", kind: "subclass", level: 3, required: true }
  ],
  features: {
    1: [
      {
        name: "Weapon Mastery",
        type: "Passive",
        description: "Choose two weapons whose mastery properties you can use.",
        effects: {
          weaponMastery: [{ count: 2 }]
        }
      },
      { name: "Thieves' Tools (Legacy Kit)", type: "Passive",
        description: "Your old, worn set of less‑than‑legal tools. When you pick a lock or disarm a trap, you have expertise (add double your proficiency bonus) on the check. Others can still attempt these tasks using improvised or found tools—this feature doesn’t gate the attempt; it just makes you notably better at it.",
        effects: {
          expertise: [{ kind: "tool", id: "thieves_tools" }]
        } }
    ],
    2: [
      {
        name: "Cunning Action",
        type: "Bonus Action",
        description: "You can take the Dash, Disengage, or Hide action as a bonus action on your turn.",
        effects: {
          actionOptions: [
            { id: "cunning_action_dash", name: "Cunning Action: Dash", actionType: "bonus_action", actionKind: "dash" },
            { id: "cunning_action_disengage", name: "Cunning Action: Disengage", actionType: "bonus_action", description: "Take the Disengage action as a bonus action." },
            { id: "cunning_action_hide", name: "Cunning Action: Hide", actionType: "bonus_action", description: "Take the Hide action as a bonus action." }
          ]
        }
      }
    ],
    3: [
      {
        name: "Roguish Archetype",
        type: "Passive",
        description: "You choose a Rogue subclass and gain its features at the listed levels.",
        effects: { narrativeTags: ["subclass_choice"] }
      }
    ],
    4: [
      {
        name: "Ability Score Improvement",
        type: "Passive",
        description:
          "Increase ability scores or take a feat (engine-defined advancement rule).",
        effects: { advancement: [{ type: "ability_score_improvement", choices: ["ability_score", "feat"] }] }
      }
    ],
    6: [
      {
        name: "Expertise",
        type: "Passive",
        description: "Choose two skill proficiencies. You gain double your proficiency bonus on ability checks that use those skills.",
        effects: {
          choiceRequirements: [{ id: "rogue_expertise_skills", kind: "skill", count: 2 }],
          expertise: [{ kind: "skill", id: "choice:rogue_expertise_skills" }]
        }
      }
    ],
    7: [
      {
        name: "Evasion",
        type: "Passive",
        description: "When you succeed on a Dexterity saving throw to take half damage, you instead take no damage. When you fail such a save, you take only half damage.",
        effects: {
          triggeredEffects: [{
            id: "evasion",
            trigger: "dex_save_for_half_damage",
            successDamage: "none",
            failureDamage: "half"
          }]
        }
      }
    ],
    8: [
      {
        name: "Ability Score Improvement",
        type: "Passive",
        description:
          "Increase ability scores or take a feat (engine-defined advancement rule).",
        effects: { advancement: [{ type: "ability_score_improvement", choices: ["ability_score", "feat"] }] }
      }
    ],
    11: [
      {
        name: "Reliable Talent",
        type: "Passive",
        description: "Whenever you make an ability check that uses a proficiency you have, treat a d20 roll of 9 or lower as a 10.",
        effects: {
          modifiers: [{ id: "reliable_talent", target: "proficient_ability_check", floorD20: 10 }]
        }
      }
    ],
    12: [
      {
        name: "Ability Score Improvement",
        type: "Passive",
        description:
          "Increase ability scores or take a feat (engine-defined advancement rule).",
        effects: { advancement: [{ type: "ability_score_improvement", choices: ["ability_score", "feat"] }] }
      }
    ]
  },

  subclasses: {
    "Assassin": {
      id: "assassin",
      summary: "Cold-blooded precision killer who excels at the opening strike. Save DC = 8 + proficiency bonus + Dexterity modifier.",
      features: {
        3: [
          {
            name: "Killer’s Patience",
            type: "Passive",
            description: "When you roll initiative, you may choose to act last in the initiative order instead of using your rolled result. If you do, you gain +10 ft of movement during the first round of combat.",
            effects: {
              modifiers: [{ id: "killers_patience_first_round_speed", target: "speed", value: 10, timing: "first_round_if_acts_last" }]
            }
          },
          { name: "Assassinate", type: "Passive",
            description: "You have advantage on attack rolls against creatures that have not acted yet. Your hits against surprised creatures are critical hits.",
            effects: {
              modifiers: [{
                id: "assassinate_unacted_advantage",
                target: "self",
                stat: "attack_roll",
                mode: "advantage",
                targetHasNotActedThisCombat: true
              }],
              triggeredEffects: [{
                id: "assassinate_surprise_critical",
                trigger: "source_hits_surprised_target",
                criticalHit: true
              }]
            } }
        ],
        7: [
          { name: "Lethal Ambush", type: "Passive",
            description: "On the first round of combat, your first weapon hit deals +2d6 Sneak Attack damage.",
            effects: {
              damageRiders: [{
                id: "lethal_ambush",
                name: "Lethal Ambush",
                trigger: "source_hits_with_attack_roll",
                actionTags: ["weapon"],
                onlyRound: 1,
                oncePerCombat: true,
                damage: "2d6",
                damageType: "same_as_action"
              }]
            } }
        ],
        11: [
          { name: "Assassinate Upgrade", type: "Passive",
            description: "When you hit a surprised creature, you deal double Sneak Attack dice (in addition to the critical hit).",
            effects: {
              damageRiders: [{
                id: "assassinate_upgrade",
                name: "Assassinate Upgrade",
                trigger: "source_hits_surprised_target",
                damage: "2d6",
                damageType: "same_as_action"
              }]
            } }
        ],
        13: [
          { name: "Umbral Guise", type: "Special", uses: "shortRest",
            description: "Once per short rest, when you Hide, you become invisible until the end of your next turn.",
            effects: {
              resources: [{ id: "umbral_guise", name: "Umbral Guise", max: 1, recovery: "short_rest" }],
              triggeredEffects: [{
                id: "umbral_guise",
                trigger: "source_uses_action",
                actionId: "hide",
                resourceId: "umbral_guise",
                condition: "invisible",
                duration: { kind: "until_timing", timing: "turn_end" }
              }]
            } }
        ]
      }
    },
    "Cutthroat": {
      id: "cutthroat",
      summary: "Dirty-fighting enforcer who terrifies and overwhelms foes.",
      features: {
        3: [
          { name: "Low Blow", type: "Bonus Action",
            description: "Target a creature within 30 ft. It must succeed on a WIS save against your subclass save DC or take psychic damage equal to your Charisma modifier and have disadvantage on its next attack before the end of its turn.",
            effects: {
              actionOptions: [{
                id: "low_blow",
                name: "Low Blow",
                actionType: "bonus_action",
                rangeFt: 30,
                requiresTarget: true,
                targetFilter: { team: "enemies" },
                save: { ability: "wisdom", dcFrom: "classSaveDC" },
                damage: { dice: "charisma_modifier", type: "psychic" },
                effects: [{
                  type: "condition",
                  trigger: "failed_save",
                  condition: "next_attack_disadvantage",
                  duration: { kind: "rounds", rounds: 1, tick: "turn_end" }
                }],
                description: "Deal psychic damage and impose disadvantage on the target's next attack if it fails a Wisdom save."
              }]
            } },
          { name: "Dark Presence", type: "Passive",
            description: "Your subclass save DC uses Charisma. Gain Expertise in one: Deception, Intimidation, or Persuasion.",
            effects: {
              choiceRequirements: [{ id: "dark_presence_expertise", kind: "skill", count: 1, options: ["deception", "intimidation", "persuasion"] }],
              expertise: [{ kind: "skill", id: "choice:dark_presence_expertise" }],
              modifiers: [{ id: "dark_presence_save_dc", target: "subclass_save_dc", ability: "charisma" }]
            } }
        ],
        7: [
          { name: "Secrets Exposed", type: "Bonus Action", uses: "longRest",
            description: "As a bonus action, size up a foe. The target makes a WIS save against your subclass save DC. On a failed save, for 1 minute, allies have advantage on the first attack they make each turn against that creature.",
            effects: {
              resources: [{ id: "secrets_exposed", name: "Secrets Exposed", max: 1, recovery: "long_rest" }],
              actionOptions: [{
                id: "secrets_exposed",
                name: "Secrets Exposed",
                actionType: "bonus_action",
                resourceId: "secrets_exposed",
                rangeFt: 30,
                requiresTarget: true,
                targetFilter: { team: "enemies" },
                save: { ability: "wisdom", dcFrom: "classSaveDC" },
                effects: [{
                  type: "condition",
                  trigger: "failed_save",
                  condition: "next_incoming_attack_advantage",
                  duration: { kind: "rounds", rounds: 10, tick: "turn_end" }
                }]
              }]
            } }
        ],
        11: [
          { name: "Exploit Weakness", type: "Special", uses: "longRest",
            description: "Choose a creature you can see; until the end of the combat, your Sneak Attacks against it deal extra psychic damage equal to your Charisma modifier, and it cannot benefit from advantage.",
            effects: {
              resources: [{ id: "exploit_weakness", name: "Exploit Weakness", max: 1, recovery: "long_rest" }],
              actionOptions: [{
                id: "exploit_weakness",
                name: "Exploit Weakness",
                actionType: "free",
                resourceId: "exploit_weakness",
                rangeFt: 30,
                requiresTarget: true,
                targetFilter: { team: "enemies" },
                mark: { id: "exploit_weakness", label: "Exploit Weakness", duration: null }
              }],
              damageRiders: [{
                id: "exploit_weakness_psychic",
                name: "Exploit Weakness",
                trigger: "source_hits_with_attack_roll",
                requiresMark: { id: "exploit_weakness", source: "self" },
                damage: "charisma_modifier",
                damageType: "psychic"
              }]
            } }
        ],
        13: [
          { name: "Ultraviolence", type: "Special", uses: "longRest",
            description: "You dig down into the most ferocious, violent and unbending aspect of yourself. Every successful weapon hit is immediately doubled by a second stab for free.",
            effects: {
              resources: [{ id: "ultraviolence", name: "Ultraviolence", max: 1, recovery: "long_rest" }],
              damageRiders: [{
                id: "ultraviolence",
                name: "Ultraviolence",
                trigger: "source_hits_with_attack_roll",
                actionTags: ["weapon"],
                damage: "same_as_action",
                damageType: "same_as_action",
                resourceId: "ultraviolence"
              }]
            } }
        ]
      }
    },
    "Saboteur": {
      id: "saboteur",
      summary: "Gadgeteer rogue who prepares devices and turns battlefields chaotic. Save DC = 8 + proficiency bonus + Intelligence modifier.",
      features: {
        3: [
          { name: "Quick Rigging I", type: "Bonus Action",
            description: "Once per combat, assemble and use a device as a bonus action from your known recipes. You begin play knowing one origin device of your choice.",
            effects: {
              resources: [{ id: "quick_rigging", name: "Quick Rigging", max: 1, recovery: "combat" }],
              actionOptions: [{ id: "quick_rigging", actionType: "bonus_action" }],
              choiceRequirements: [{
                id: "origin_device",
                kind: "device_recipe",
                count: 1,
                options: ["fire_granado", "acid_flask", "lightning_paper"]
              }]
            } },
          { name: "Bombmaker", type: "Special",
            description: "You gain a Cookbook with 2 recipes. After a long rest, choose 3 devices to prepare; they are created and ready to use.",
            effects: {
              choiceRequirements: [{ id: "saboteur_cookbook_recipes", kind: "device_recipe", count: 2 }],
              resources: [{ id: "prepared_devices", name: "Prepared Devices", max: 3, recovery: "long_rest" }]
            } }
        ],
        7: [
          { name: "Quick Rigging II", type: "Bonus Action",
            description: "Once per combat, you may assemble and use up to two devices this combat (one per use) as a bonus action.",
            effects: {
              resources: [{ id: "quick_rigging", name: "Quick Rigging", max: 2, recovery: "combat" }]
            } }
        ],
        11: [
          { name: "Master of Mixtures", type: "Passive",
            description: "Add 2 more recipes to your Cookbook. After a long rest, prepare 5 devices. Your devices deal +1d6 extra damage of their type.",
            effects: {
              choiceRequirements: [{ id: "saboteur_advanced_recipes", kind: "device_recipe", count: 2 }],
              resources: [{ id: "prepared_devices", name: "Prepared Devices", max: 5, recovery: "long_rest" }],
              damageRiders: [{
                id: "master_of_mixtures_damage",
                name: "Master of Mixtures",
                trigger: "source_deals_damage",
                actionTags: ["device"],
                damage: "1d6",
                damageType: "same_as_action"
              }]
            } }
        ],
        13: [
          { name: "Catastrophic Charge", type: "Special", uses: "longRest",
            description: "Once per long rest, throw an empowered device: 20-ft radius, double damage dice.",
            effects: {
              resources: [{ id: "catastrophic_charge", name: "Catastrophic Charge", max: 1, recovery: "long_rest" }],
              actionOptions: [{
                id: "catastrophic_charge",
                name: "Catastrophic Charge",
                actionType: "action",
                resourceId: "catastrophic_charge",
                rangeFt: 30,
                targeting: { shape: "radius", radiusFt: 20 },
                damage: { dice: "empowered_device_damage", type: "same_as_device" }
              }]
            } }
        ]
      },
      deviceRecipes: DEVICE_RECIPE_LIST.map((recipe) => recipe.id)
    }
  }
}
