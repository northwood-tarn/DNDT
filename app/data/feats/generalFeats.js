import { generalFeat } from "./builders.js";

export const GENERAL_FEATS_BY_ID = {
  ability_score_improvement: generalFeat({
    id: "ability_score_improvement",
    name: "Ability Score Improvement",
    description: "Increase one ability score by 2, or two ability scores by 1, to a maximum of 20.",
    choices: [{ id: "abilities", kind: "ability_score", count: 2, options: ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"], amount: 1, scoreCap: 20, allowDuplicate: true }],
    tags: ["ability", "choice"]
  }),

  actor: generalFeat({
    id: "actor",
    name: "Actor",
    requirements: { ability: "charisma", minimumScore: 13 },
    description: "Improve Charisma and gain narrative leverage around disguise, performance, and mimicry.",
    effects: {
      abilityScoreBonuses: [{ ability: "charisma", amount: 1, cap: 20 }],
      modifiers: [{ id: "actor_disguise", target: "ability_check", skills: ["deception", "performance"], mode: "advantage", condition: "disguised" }],
      narrativeTags: ["mimicry", "disguise_expert"]
    },
    tags: ["ability", "social", "narrative"]
  }),

  athlete: generalFeat({
    id: "athlete",
    name: "Athlete",
    requirements: { anyAbility: ["strength", "dexterity"], minimumScore: 13 },
    description: "Improve Strength or Dexterity; climb and recover from being Prone more efficiently.",
    choices: [{ id: "ability", kind: "ability_score", count: 1, options: ["strength", "dexterity"], amount: 1, scoreCap: 20 }],
    effects: {
      modifiers: [{ id: "athlete_climb", target: "movement", stat: "climb_speed", amount: 1 }],
      narrativeTags: ["athletic_movement"]
    },
    tags: ["ability", "movement"]
  }),

  durable: generalFeat({
    id: "durable",
    name: "Durable",
    description: "Improve Constitution, gain Advantage on Death Saves, and spend a Hit Die as a Bonus Action.",
    effects: {
      abilityScoreBonuses: [{ ability: "constitution", amount: 1, cap: 20 }],
      modifiers: [{ id: "durable_death_saves", target: "saving_throw", stat: "save", ability: "death", mode: "advantage" }],
      actionOptions: [{ id: "durable_recovery", name: "Durable Recovery", actionType: "bonus_action", healing: "hit_die" }]
    },
    tags: ["ability", "survival", "healing"]
  }),

  elemental_adept: generalFeat({
    id: "elemental_adept",
    name: "Elemental Adept",
    requirements: { feature: "spellcasting" },
    description: "Improve a spellcasting ability and specialize in one elemental spell damage type.",
    choices: [
      { id: "ability", kind: "ability_score", count: 1, options: ["intelligence", "wisdom", "charisma"], amount: 1, scoreCap: 20 },
      { id: "damage_type", kind: "damage_type", count: 1, options: ["acid", "cold", "fire", "lightning", "thunder"] }
    ],
    effects: {
      featureHooks: [{ id: "elemental_adept_spell_damage", timing: "spell_damage_roll", ignoreResistanceFromChoice: "damage_type", minimumDieResult: 2 }]
    },
    tags: ["ability", "spellcasting", "damage"]
  }),

  heavily_armored: generalFeat({
    id: "heavily_armored",
    name: "Heavily Armored",
    requirements: { armorTraining: "medium" },
    description: "Improve Strength or Constitution and gain Heavy armor training.",
    choices: [{ id: "ability", kind: "ability_score", count: 1, options: ["strength", "constitution"], amount: 1, scoreCap: 20 }],
    effects: { proficiencies: { armor: ["heavy"] } },
    tags: ["ability", "armor"]
  }),

  heavy_armor_master: generalFeat({
    id: "heavy_armor_master",
    name: "Heavy Armor Master",
    requirements: { armorTraining: "heavy" },
    description: "Improve Strength or Constitution and reduce incoming weapon impact while wearing Heavy armor.",
    choices: [{ id: "ability", kind: "ability_score", count: 1, options: ["strength", "constitution"], amount: 1, scoreCap: 20 }],
    effects: {
      featureHooks: [{
        id: "heavy_armor_master_reduction",
        timing: "damage_reduction",
        amount: "proficiency_bonus",
        damageTypes: ["bludgeoning", "piercing", "slashing"],
        condition: { equippedArmorType: "heavy" }
      }]
    },
    tags: ["ability", "armor", "damage_reduction"]
  }),

  great_weapon_master: generalFeat({
    id: "great_weapon_master",
    name: "Great Weapon Master",
    requirements: { ability: "strength", minimumScore: 13 },
    description: "Improve Strength. On the first Heavy melee weapon attack of each turn, add your Proficiency Bonus to damage. If your previous turn reduced an enemy to 0 HP, add double your Proficiency Bonus instead.",
    effects: {
      abilityScoreBonuses: [{ ability: "strength", amount: 1, cap: 20 }],
      featureHooks: [{
        id: "great_weapon_master_heavy_damage",
        timing: "weapon_damage_roll",
        amount: "proficiency_bonus",
        amountMultiplierWhen: { turnFlag: "droppedEnemyOnPreviousTurn", multiplier: 2 },
        tags: ["weapon", "melee", "heavy"],
        trigger: { frequency: "first_attack_per_turn" }
      }]
    },
    tags: ["ability", "weapon", "damage"]
  }),

  inspiring_leader: generalFeat({
    id: "inspiring_leader",
    name: "Inspiring Leader",
    requirements: { anyAbility: ["wisdom", "charisma"], minimumScore: 13 },
    description: "Improve Wisdom or Charisma and grant temporary HP after a rest.",
    choices: [{ id: "ability", kind: "ability_score", count: 1, options: ["wisdom", "charisma"], amount: 1, scoreCap: 20 }],
    effects: {
      actionOptions: [{ id: "inspiring_leader", name: "Inspiring Leader", actionType: "rest", temporaryHpFormula: "level + chosen_ability_modifier", targetCount: 6 }]
    },
    tags: ["ability", "support", "temporary_hp"]
  }),

  keen_mind: generalFeat({
    id: "keen_mind",
    name: "Keen Mind",
    requirements: { ability: "intelligence", minimumScore: 13 },
    description: "Improve Intelligence, gain or improve a knowledge skill, and take the Study action as a Bonus Action.",
    choices: [{ id: "skill", kind: "skill_expertise", count: 1, options: ["arcana", "history", "investigation", "nature", "religion"] }],
    effects: {
      abilityScoreBonuses: [{ ability: "intelligence", amount: 1, cap: 20 }],
      actionOptions: [{ id: "keen_mind_study", name: "Study", actionType: "bonus_action", actionKind: "study" }]
    },
    tags: ["ability", "skill", "bonus_action"]
  }),

  lightly_armored: generalFeat({
    id: "lightly_armored",
    name: "Lightly Armored",
    description: "Improve Strength or Dexterity and gain Light armor and Shield training.",
    choices: [{ id: "ability", kind: "ability_score", count: 1, options: ["strength", "dexterity"], amount: 1, scoreCap: 20 }],
    effects: { proficiencies: { armor: ["light", "shield"] } },
    tags: ["ability", "armor"]
  }),

  mage_slayer: generalFeat({
    id: "mage_slayer",
    name: "Mage Slayer",
    description: "Improve Strength or Dexterity, pressure concentration, and once per rest convert a failed mental save into a success.",
    choices: [{ id: "ability", kind: "ability_score", count: 1, options: ["strength", "dexterity"], amount: 1, scoreCap: 20 }],
    effects: {
      resources: [{ id: "mage_slayer_guard", name: "Mage Slayer Guard", max: 1, recovery: "short_rest" }],
      featureHooks: [
        { id: "mage_slayer_concentration_pressure", timing: "damage_concentration_save", mode: "disadvantage" },
        { id: "mage_slayer_mental_save_success", timing: "failed_save", abilities: ["intelligence", "wisdom", "charisma"], outcome: "success", resourceId: "mage_slayer_guard" }
      ]
    },
    tags: ["ability", "save", "spellcaster_counter"]
  }),

  martial_weapon_training: generalFeat({
    id: "martial_weapon_training",
    name: "Martial Weapon Training",
    description: "Improve Strength or Dexterity and gain Martial weapon proficiency.",
    choices: [{ id: "ability", kind: "ability_score", count: 1, options: ["strength", "dexterity"], amount: 1, scoreCap: 20 }],
    effects: { proficiencies: { weapons: ["martial"] } },
    tags: ["ability", "weapon"]
  }),

  moderately_armored: generalFeat({
    id: "moderately_armored",
    name: "Moderately Armored",
    requirements: { armorTraining: "light" },
    description: "Improve Strength or Dexterity and gain Medium armor training.",
    choices: [{ id: "ability", kind: "ability_score", count: 1, options: ["strength", "dexterity"], amount: 1, scoreCap: 20 }],
    effects: { proficiencies: { armor: ["medium"] } },
    tags: ["ability", "armor"]
  }),

  medium_armor_master: generalFeat({
    id: "medium_armor_master",
    name: "Medium Armor Master",
    requirements: { armorTraining: "medium" },
    description: "Improve Strength or Dexterity and wear Medium armor more effectively.",
    choices: [{ id: "ability", kind: "ability_score", count: 1, options: ["strength", "dexterity"], amount: 1, scoreCap: 20 }],
    effects: {
      featureHooks: [{
        id: "medium_armor_master_dex_cap",
        timing: "armor_class",
        armorType: "medium",
        dexCapOverride: 3
      }]
    },
    tags: ["ability", "armor"]
  }),

  observant: generalFeat({
    id: "observant",
    name: "Observant",
    requirements: { anyAbility: ["intelligence", "wisdom"], minimumScore: 13 },
    description: "Improve Intelligence or Wisdom, gain or improve an observation skill, and take Search as a Bonus Action.",
    choices: [
      { id: "ability", kind: "ability_score", count: 1, options: ["intelligence", "wisdom"], amount: 1, scoreCap: 20 },
      { id: "skill", kind: "skill_expertise", count: 1, options: ["insight", "investigation", "perception"] }
    ],
    effects: {
      actionOptions: [{ id: "observant_search", name: "Search", actionType: "bonus_action", actionKind: "search" }]
    },
    tags: ["ability", "skill", "bonus_action"]
  }),

  resilient: generalFeat({
    id: "resilient",
    name: "Resilient",
    description: "Improve one ability and gain saving throw proficiency with that ability.",
    choices: [{ id: "ability", kind: "saving_throw_ability", count: 1, options: ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"], amount: 1, scoreCap: 20 }],
    tags: ["ability", "saving_throw"]
  }),

  piercer: generalFeat({
    id: "piercer",
    name: "Piercer",
    requirements: { anyAbility: ["strength", "dexterity"], minimumScore: 13 },
    description: "Improve Strength or Dexterity, reroll piercing damage once per turn, and add one extra die on piercing critical hits.",
    choices: [{ id: "ability", kind: "ability_score", count: 1, options: ["strength", "dexterity"], amount: 1, scoreCap: 20 }],
    effects: {
      featureHooks: [{
        id: "piercer_damage_reroll",
        timing: "weapon_damage_roll",
        trigger: { damageTypes: ["piercing"], frequency: "once_per_turn" },
        roll: { rerollLowestDie: true, keep: "highest_total" }
      }, {
        id: "piercer_critical_die",
        timing: "weapon_damage_roll",
        trigger: { damageTypes: ["piercing"], criticalOnly: true },
        extraCriticalDice: 1
      }]
    },
    tags: ["ability", "weapon", "damage"]
  }),

  sharpshooter: generalFeat({
    id: "sharpshooter",
    name: "Sharpshooter",
    requirements: { ability: "dexterity", minimumScore: 13 },
    description: "Improve Dexterity and improve ranged attacks through cover, close quarters, and long distance.",
    effects: {
      abilityScoreBonuses: [{ ability: "dexterity", amount: 1, cap: 20 }],
      modifiers: [
        { id: "sharpshooter_ignore_cover", target: "attack_roll", stat: "cover_penalty", amount: 0, tags: ["ranged"] },
        { id: "sharpshooter_close_range", target: "attack_roll", stat: "incoming_disadvantage_cancel", amount: 1, tags: ["ranged"] }
      ]
    },
    tags: ["ability", "ranged"]
  }),

  skill_expert: generalFeat({
    id: "skill_expert",
    name: "Skill Expert",
    description: "Improve one ability, gain one skill proficiency, and gain Expertise in one proficient skill.",
    choices: [
      { id: "ability", kind: "ability_score", count: 1, options: ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"], amount: 1, scoreCap: 20 },
      { id: "skill", kind: "skill", count: 1, pool: "skills" },
      { id: "expertise", kind: "skill_expertise", count: 1, pool: "skills", requireProficiency: true }
    ],
    tags: ["ability", "skill", "expertise"]
  }),

  skulker: generalFeat({
    id: "skulker",
    name: "Skulker",
    requirements: { ability: "dexterity", minimumScore: 13 },
    description: "Improve Dexterity, gain short-range Blindsight, and improve combat hiding.",
    effects: {
      abilityScoreBonuses: [{ ability: "dexterity", amount: 1, cap: 20 }],
      senses: [{ type: "blindsight", rangeFt: 10 }],
      modifiers: [{ id: "skulker_combat_hide", target: "ability_check", stat: "ability_check", skill: "stealth", mode: "advantage", condition: "hide_action_combat" }],
      narrativeTags: ["hidden_attack_concealment"]
    },
    tags: ["ability", "stealth", "sense"]
  }),

  speedy: generalFeat({
    id: "speedy",
    name: "Speedy",
    requirements: { anyAbility: ["dexterity", "constitution"], minimumScore: 13 },
    description: "Improve Dexterity or Constitution, increase Speed, and move more safely.",
    choices: [{ id: "ability", kind: "ability_score", count: 1, options: ["dexterity", "constitution"], amount: 1, scoreCap: 20 }],
    effects: {
      modifiers: [
        { id: "speedy_speed", target: "self", stat: "speed", amountFt: 10, amount: 2 }
      ],
      narrativeTags: ["dash_ignores_difficult_terrain", "opportunity_attacks_disadvantage"]
    },
    tags: ["ability", "movement"]
  }),

  spell_sniper: generalFeat({
    id: "spell_sniper",
    name: "Spell Sniper",
    requirements: { feature: "spellcasting" },
    description: "Improve a spellcasting ability and sharpen spell attacks.",
    choices: [{ id: "ability", kind: "ability_score", count: 1, options: ["intelligence", "wisdom", "charisma"], amount: 1, scoreCap: 20 }],
    effects: {
      modifiers: [
        { id: "spell_sniper_ignore_cover", target: "attack_roll", stat: "cover_penalty", amount: 0, tags: ["spell", "attackRoll"] },
        { id: "spell_sniper_close_range", target: "attack_roll", stat: "incoming_disadvantage_cancel", amount: 1, tags: ["spell", "attackRoll"] },
        { id: "spell_sniper_range", target: "spell", stat: "range_ft", amount: 60, tags: ["spell", "attackRoll"] }
      ]
    },
    tags: ["ability", "spellcasting", "ranged"]
  }),

  telekinetic: generalFeat({
    id: "telekinetic",
    name: "Telekinetic",
    description: "Improve a spellcasting ability, learn Mage Hand, and gain a bonus-action telekinetic shove.",
    choices: [{ id: "ability", kind: "ability_score", count: 1, options: ["intelligence", "wisdom", "charisma"], amount: 1, scoreCap: 20 }],
    effects: {
      spellGrants: [{ spellId: "mage_hand", level: 0 }],
      actionOptions: [{ id: "telekinetic_shove", name: "Telekinetic Shove", actionType: "bonus_action", rangeFt: 30, save: { ability: "strength", dcFrom: "spellSaveDC", onSave: "negates" }, effects: [{ type: "push", distanceFt: 5 }] }],
      narrativeTags: ["invisible_mage_hand"]
    },
    tags: ["ability", "spell", "forced_movement"]
  }),

  fey_touched: generalFeat({
    id: "fey_touched",
    name: "Fey Touched",
    description: "Improve a spellcasting ability and freely choose two fey-touched spell grants: Misty Step and one 1st-level Divination or Enchantment spell. Each grant can be cast once per Long Rest without a spell slot.",
    choices: [
      { id: "ability", kind: "ability_score", count: 1, options: ["intelligence", "wisdom", "charisma"], amount: 1, scoreCap: 20 },
      { id: "step", kind: "spell", count: 1, options: ["misty_step"] },
      { id: "spell", kind: "spell", count: 1, filter: { level: 1, schools: ["Divination", "Enchantment"] } }
    ],
    effects: {
      freeCastChoices: [
        { choiceId: "step", resourcePrefix: "fey_touched" },
        { choiceId: "spell", resourcePrefix: "fey_touched" }
      ]
    },
    tags: ["ability", "spell", "choice"]
  }),

  ritual_caster: generalFeat({
    id: "ritual_caster",
    name: "Ritual Caster",
    requirements: { anyAbility: ["intelligence", "wisdom", "charisma"], minimumScore: 13 },
    description: "Improve a spellcasting ability and freely learn two ritual spells.",
    choices: [
      { id: "ability", kind: "ability_score", count: 1, options: ["intelligence", "wisdom", "charisma"], amount: 1, scoreCap: 20 },
      { id: "spells", kind: "spell_list", count: 2, filter: { ritual: true, maxLevel: 1 } }
    ],
    tags: ["ability", "spell", "ritual", "choice"]
  }),

  shadow_touched: generalFeat({
    id: "shadow_touched",
    name: "Shadow Touched",
    description: "Improve a spellcasting ability and freely choose one 1st-level Illusion or Necromancy spell. The grant can be cast once per Long Rest without a spell slot.",
    choices: [
      { id: "ability", kind: "ability_score", count: 1, options: ["intelligence", "wisdom", "charisma"], amount: 1, scoreCap: 20 },
      { id: "spell", kind: "spell", count: 1, filter: { level: 1, schools: ["Illusion", "Necromancy"] } }
    ],
    effects: {
      freeCastChoices: [{ choiceId: "spell", resourcePrefix: "shadow_touched" }]
    },
    tags: ["ability", "spell", "choice"]
  }),

  telepathic: generalFeat({
    id: "telepathic",
    name: "Telepathic",
    description: "Improve a spellcasting ability, gain narrative telepathy, and freely choose one 2nd-level Divination or Enchantment spell. The grant can be cast once per Long Rest without a spell slot.",
    choices: [
      { id: "ability", kind: "ability_score", count: 1, options: ["intelligence", "wisdom", "charisma"], amount: 1, scoreCap: 20 },
      { id: "spell", kind: "spell", count: 1, filter: { level: 2, schools: ["Divination", "Enchantment"] } }
    ],
    effects: {
      narrativeTags: ["telepathy"],
      freeCastChoices: [{ choiceId: "spell", resourcePrefix: "telepathic" }]
    },
    tags: ["ability", "conversation", "telepathy"]
  })
};
