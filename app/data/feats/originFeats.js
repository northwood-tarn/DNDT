import { FEAT_SOURCES } from "./constants.js";
import { originFeat } from "./builders.js";

export const ORIGIN_FEATS_BY_ID = {
  alert: originFeat({
    id: "alert",
    name: "Alert",
    description: "You have Advantage on Initiative rolls, and friendly combatants gain +1 to Initiative while you are in the fight.",
    effects: {
      featureHooks: [{
        id: "alert_initiative_advantage",
        timing: "initiative_roll",
        roll: { mode: "advantage" }
      }, {
        id: "alert_friendly_initiative_bonus",
        timing: "initiative_roll",
        target: "friendly_combatants",
        bonus: 1
      }]
    },
    tags: ["initiative"]
  }),

  healer: originFeat({
    id: "healer",
    name: "Healer",
    description: "Help a creature spend a Hit Die to recover extra HP, and reroll 1s when you restore HP.",
    effects: {
      featureHooks: [
        { id: "battle_medic", timing: "action" },
        { id: "healing_reroll_ones", timing: "healing_roll" }
      ]
    },
    tags: ["healing"]
  }),

  lucky: originFeat({
    id: "lucky",
    name: "Lucky",
    description: "After each Long Rest, gain Luck Points equal to your Proficiency Bonus. Once per combat, when you fail your own attack roll or saving throw by less than 5, spend 1 Luck Point to roll one extra d20 and use the higher result. Luck can also appear as a conversation option when relevant.",
    effects: {
      resources: [{ id: "luck_points", name: "Luck Points", max: "proficiency_bonus", recovery: "long_rest" }],
      featureHooks: [{
        id: "lucky_combat_near_miss_reroll",
        timing: "after_attack_or_save_roll",
        trigger: { rollTypes: ["attack", "save"], failedByLessThan: 5, frequency: "once_per_combat", actorOnly: true },
        cost: { resourceId: "luck_points", amount: 1 },
        roll: { extraD20: 1, keep: "highest" }
      }, {
        id: "lucky_dialogue_option",
        timing: "conversation_option",
        cost: { resourceId: "luck_points", amount: 1 }
      }]
    },
    tags: ["d20", "resource", "conversation"]
  }),

  magic_initiate_cleric: originFeat({
    id: "magic_initiate_cleric",
    name: "Magic Initiate (Cleric)",
    source: FEAT_SOURCES.DNDT_HOMEBREW,
    description: "You know Guidance and Sacred Flame, and you can cast Cure Wounds once per Long Rest without a slot.",
    effects: {
      spellGrants: [
        { spellId: "guidance", level: 0 },
        { spellId: "sacred_flame", level: 0 },
        { spellId: "cure_wounds", level: 1, freeCastResourceId: "magic_initiate_cleric_cure_wounds" }
      ],
      resources: [{ id: "magic_initiate_cleric_cure_wounds", name: "Cure Wounds Free Cast", max: 1, recovery: "long_rest" }]
    },
    tags: ["spellcasting", "legacy_variant"]
  }),

  magic_initiate_wizard: originFeat({
    id: "magic_initiate_wizard",
    name: "Magic Initiate (Wizard)",
    source: FEAT_SOURCES.DNDT_HOMEBREW,
    description: "You know Mage Hand and Fire Bolt, and you can cast Magic Missile once per Long Rest without a slot.",
    effects: {
      spellGrants: [
        { spellId: "mage_hand", level: 0 },
        { spellId: "fire_bolt", level: 0 },
        { spellId: "magic_missile", level: 1, freeCastResourceId: "magic_initiate_wizard_magic_missile" }
      ],
      resources: [{ id: "magic_initiate_wizard_magic_missile", name: "Magic Missile Free Cast", max: 1, recovery: "long_rest" }]
    },
    tags: ["spellcasting", "legacy_variant"]
  }),

  magic_initiate_warlock: originFeat({
    id: "magic_initiate_warlock",
    name: "Magic Initiate (Warlock)",
    source: FEAT_SOURCES.DNDT_HOMEBREW,
    description: "You know Eldritch Grasp and Dread Whisper, and you can cast Hex once per Long Rest without a slot.",
    effects: {
      spellGrants: [
        { spellId: "eldritch_grasp", level: 0 },
        { spellId: "dread_whisper", level: 0 },
        { spellId: "hex", level: 1, freeCastResourceId: "magic_initiate_warlock_hex" }
      ],
      resources: [{ id: "magic_initiate_warlock_hex", name: "Hex Free Cast", max: 1, recovery: "long_rest" }]
    },
    tags: ["spellcasting", "legacy_variant"]
  }),

  savage_attacker: originFeat({
    id: "savage_attacker",
    name: "Savage Attacker",
    description: "Once per turn when you hit with a weapon, roll the weapon's damage twice and use the higher result.",
    effects: {
      featureHooks: [{
        id: "savage_attacker_weapon_damage",
        timing: "weapon_damage_roll",
        trigger: { actionTags: ["weapon"], frequency: "once_per_turn" },
        roll: { repetitions: 2, keep: "highest" }
      }]
    },
    tags: ["weapon", "damage"]
  }),

  skilled: originFeat({
    id: "skilled",
    name: "Skilled",
    description: "Gain proficiency in any combination of three skills or tools of your choice.",
    choices: [{ id: "proficiencies", kind: "skill_or_tool", count: 3, pools: ["skills", "tools"] }],
    tags: ["skill", "tool", "choice"]
  }),

  tough: originFeat({
    id: "tough",
    name: "Tough",
    description: "Your Hit Point maximum increases by 2 per character level.",
    effects: {
      hitPointBonusPerLevel: 2
    },
    tags: ["hp"]
  }),

  silver_tongue: originFeat({
    id: "silver_tongue",
    name: "Silver Tongue",
    source: FEAT_SOURCES.DNDT_HOMEBREW,
    description: "Your words carry weight; gain Persuasion proficiency and a small bonus to parley.",
    effects: {
      proficiencies: { skills: ["persuasion"] },
      modifiers: [{ id: "parley", amount: 2 }]
    },
    tags: ["skill", "social"]
  })
};
