// app/data/species.js

export const SPECIES_SOURCES = {
  PHB_2024_REFERENCE: "2024_phb_reference",
  DNDT_HOMEBREW: "dndt_homebrew"
};

export const SPECIES_SIZES = ["Small", "Medium"];

function feature({ id, name, minLevel = 1, effect = "feature", description, grantsSpellId = null, choices = [], effects = {} }) {
  const normalizedEffects = { ...effects };
  if (grantsSpellId) {
    normalizedEffects.spells = [...(normalizedEffects.spells || []), { id: grantsSpellId, mode: "known" }];
  }
  if (effect === "skill_choice") {
    normalizedEffects.choiceRequirements = [
      ...(normalizedEffects.choiceRequirements || []),
      { id: `${id}_skill`, kind: "skill", count: 1, options: choices }
    ];
  }
  if (effect === "feat_choice") {
    normalizedEffects.choiceRequirements = [
      ...(normalizedEffects.choiceRequirements || []),
      { id: `${id}_feat`, kind: "origin_feat", count: 1 }
    ];
  }
  if (effect === "hp_bonus_per_level") {
    normalizedEffects.hitPointBonuses = [
      ...(normalizedEffects.hitPointBonuses || []),
      { perLevel: 1 }
    ];
  }
  return { id, name, minLevel, effect, description, grantsSpellId, choices, effects: normalizedEffects };
}

function lineage({ id, name, resistances = [], features = [] }) {
  return { id, name, resistances, features };
}

function species({ id, name, size = "Medium", speed = 30, senses = [], resistances = [], features = [], lineages = {} }) {
  return {
    id,
    name,
    source: SPECIES_SOURCES.PHB_2024_REFERENCE,
    category: "species",
    size,
    speed,
    senses,
    resistances,
    features,
    lineages
  };
}

export const SPECIES = {
  aasimar: species({
    id: "aasimar",
    name: "Aasimar",
    senses: [{ type: "darkvision", rangeFt: 60 }],
    resistances: ["radiant", "necrotic"],
    features: [
      feature({
        id: "healing_hands",
        name: "Healing Hands",
        description: "As an action, restore HP equal to your Proficiency Bonus.",
        effects: {
          resources: [{ id: "healing_hands", name: "Healing Hands", max: 1, recovery: "long_rest" }],
          actionOptions: [{ id: "healing_hands", actionType: "action", healingFormula: "proficiency_bonus" }]
        }
      }),
      feature({ id: "light_bearer", name: "Light Bearer", description: "You know the Light cantrip.", grantsSpellId: "light" }),
      feature({
        id: "celestial_revelation",
        name: "Celestial Revelation",
        minLevel: 3,
        description: "As a Bonus Action, transform for 1 minute.",
        effects: {
          resources: [{ id: "celestial_revelation", name: "Celestial Revelation", max: 1, recovery: "long_rest" }],
          actionOptions: [{ id: "celestial_revelation", actionType: "bonus_action", duration: { kind: "rounds", rounds: 10 } }],
          narrativeTags: ["celestial_revelation"]
        }
      })
    ]
  }),

  dragonborn: species({
    id: "dragonborn",
    name: "Dragonborn",
    features: [
      feature({
        id: "breath_weapon",
        name: "Breath Weapon",
        description: "Replace one attack with a line or cone of draconic energy.",
        effects: {
          resources: [{ id: "breath_weapon", name: "Breath Weapon", max: "proficiency_bonus", recovery: "long_rest" }],
          actionOptions: [{ id: "breath_weapon", actionType: "attack_replacement", save: { ability: "dexterity" } }]
        }
      }),
      feature({
        id: "draconic_flight",
        name: "Draconic Flight",
        minLevel: 5,
        description: "Bonus Action: gain a flying speed for 10 minutes.",
        effects: {
          resources: [{ id: "draconic_flight", name: "Draconic Flight", max: 1, recovery: "long_rest" }],
          actionOptions: [{ id: "draconic_flight", actionType: "bonus_action", duration: { kind: "minutes", minutes: 10 } }],
          narrativeTags: ["flight"]
        }
      })
    ],
    lineages: {
      black: lineage({ id: "black", name: "Black", resistances: ["acid"] }),
      blue: lineage({ id: "blue", name: "Blue", resistances: ["lightning"] }),
      brass: lineage({ id: "brass", name: "Brass", resistances: ["fire"] }),
      bronze: lineage({ id: "bronze", name: "Bronze", resistances: ["lightning"] }),
      copper: lineage({ id: "copper", name: "Copper", resistances: ["acid"] }),
      gold: lineage({ id: "gold", name: "Gold", resistances: ["fire"] }),
      green: lineage({ id: "green", name: "Green", resistances: ["poison"] }),
      red: lineage({ id: "red", name: "Red", resistances: ["fire"] }),
      silver: lineage({ id: "silver", name: "Silver", resistances: ["cold"] }),
      white: lineage({ id: "white", name: "White", resistances: ["cold"] })
    }
  }),

  dwarf: species({
    id: "dwarf",
    name: "Dwarf",
    senses: [{ type: "darkvision", rangeFt: 120 }],
    resistances: ["poison"],
    features: [
      feature({
        id: "dwarven_resilience",
        name: "Dwarven Resilience",
        description: "Advantage on saves to avoid or end Poisoned.",
        effects: { modifiers: [{ id: "dwarven_resilience", target: "saving_throw", condition: "poisoned", mode: "advantage" }] }
      }),
      feature({ id: "dwarven_toughness", name: "Dwarven Toughness", effect: "hp_bonus_per_level", description: "HP maximum increases by 1 per level." }),
      feature({
        id: "stonecunning",
        name: "Stonecunning",
        description: "Bonus Action: see invisible creatures and objects within 60 feet for 10 minutes. Narrative scenes may also recognize this as stone-sense.",
        effects: {
          resources: [{ id: "stonecunning", name: "Stonecunning", max: 1, recovery: "long_rest" }],
          actionOptions: [{
            id: "stonecunning",
            actionType: "bonus_action",
            applyEffect: { kind: "sense", sense: "see_invisible", rangeFt: 60, durationSeconds: 600 }
          }],
          narrativeTags: ["stone_sense"]
        }
      })
    ]
  }),

  elf: species({
    id: "elf",
    name: "Elf",
    senses: [{ type: "darkvision", rangeFt: 60 }],
    features: [
      feature({ id: "keen_senses", name: "Keen Senses", effect: "skill_choice", description: "Gain Insight, Perception, or Survival proficiency.", choices: ["insight", "perception", "survival"] }),
      feature({
        id: "fey_ancestry",
        name: "Fey Ancestry",
        description: "Advantage on saves to avoid or end Charmed.",
        effects: { modifiers: [{ id: "fey_ancestry", target: "saving_throw", condition: "charmed", mode: "advantage" }] }
      }),
      feature({
        id: "trance",
        name: "Trance",
        description: "You do not need sleep and complete a Long Rest in 4 hours.",
        effects: { narrativeOnly: true }
      })
    ],
    lineages: {
      high: lineage({ id: "high", name: "High", features: [feature({ id: "high_elf_magic_1", name: "High Elf Magic", description: "You know Prestidigitation.", grantsSpellId: "prestidigitation" })] }),
      wood: lineage({ id: "wood", name: "Wood" }),
      drow: lineage({ id: "drow", name: "Drow" })
    }
  }),

  gnome: species({
    id: "gnome",
    name: "Gnome",
    size: "Small",
    senses: [{ type: "darkvision", rangeFt: 60 }],
    features: [feature({
      id: "gnomish_cunning",
      name: "Gnomish Cunning",
      description: "Advantage on Intelligence, Wisdom, and Charisma saving throws.",
      effects: { modifiers: [{ id: "gnomish_cunning", target: "saving_throw", abilities: ["intelligence", "wisdom", "charisma"], mode: "advantage" }] }
    })],
    lineages: {
      forest: lineage({ id: "forest", name: "Forest", features: [feature({ id: "forest_gnome_magic_1", name: "Forest Gnome Magic", description: "You know Minor Illusion.", grantsSpellId: "minor_illusion" })] }),
      rock: lineage({ id: "rock", name: "Rock", features: [feature({ id: "rock_gnome_magic_1", name: "Rock Gnome Magic", description: "You know Mending.", grantsSpellId: "mending" })] })
    }
  }),

  goliath: species({
    id: "goliath",
    name: "Goliath",
    speed: 35,
    features: [
      feature({
        id: "powerful_build",
        name: "Powerful Build",
        description: "Count as one size larger for carrying capacity.",
        effects: { narrativeOnly: true }
      }),
      feature({
        id: "large_form",
        name: "Large Form",
        minLevel: 5,
        description: "Bonus Action: gain Large benefits for 10 minutes.",
        effects: {
          resources: [{ id: "large_form", name: "Large Form", max: "proficiency_bonus", recovery: "long_rest" }],
          actionOptions: [{ id: "large_form", actionType: "bonus_action", duration: { kind: "minutes", minutes: 10 } }],
          narrativeTags: ["large_form"]
        }
      })
    ],
    lineages: {
      cloud: lineage({ id: "cloud", name: "Cloud", features: [feature({
        id: "clouds_jaunt",
        name: "Cloud's Jaunt",
        description: "Bonus Action: magically teleport up to 30 feet to an unoccupied space you can see.",
        effects: {
          resources: [{ id: "clouds_jaunt", name: "Cloud's Jaunt", max: "proficiency_bonus", recovery: "long_rest" }],
          actionOptions: [{ id: "clouds_jaunt", actionType: "bonus_action", teleportFt: 30, requiresSight: true, target: "unoccupied_space" }]
        }
      })] }),
      fire: lineage({ id: "fire", name: "Fire", features: [feature({
        id: "fires_burn",
        name: "Fire's Burn",
        description: "When you hit a target with an attack roll and deal damage, you can deal an extra 1d10 fire damage to that target.",
        effects: {
          resources: [{ id: "fires_burn", name: "Fire's Burn", max: "proficiency_bonus", recovery: "long_rest" }],
          actionOptions: [{ id: "fires_burn", actionType: "attack_rider", trigger: "source_hits_with_attack_roll", preselect: true, consumeOnHitOnly: true, damage: "1d10", damageType: "fire" }]
        }
      })] }),
      frost: lineage({ id: "frost", name: "Frost", features: [feature({
        id: "frosts_chill",
        name: "Frost's Chill",
        description: "When you hit a target with an attack roll and deal damage, you can deal an extra 1d6 cold damage and reduce its speed by 10 feet until the start of your next turn.",
        effects: {
          resources: [{ id: "frosts_chill", name: "Frost's Chill", max: "proficiency_bonus", recovery: "long_rest" }],
          actionOptions: [{ id: "frosts_chill", actionType: "attack_rider", trigger: "source_hits_with_attack_roll", preselect: true, consumeOnHitOnly: true, damage: "1d6", damageType: "cold", applyEffect: { kind: "speed_penalty", amountFt: 10, until: "start_of_source_next_turn" } }]
        }
      })] }),
      hill: lineage({ id: "hill", name: "Hill", features: [feature({
        id: "hills_tumble",
        name: "Hill's Tumble",
        description: "When you hit a Large or smaller creature with an attack roll and deal damage, you can give that target the Prone condition.",
        effects: {
          resources: [{ id: "hills_tumble", name: "Hill's Tumble", max: "proficiency_bonus", recovery: "long_rest" }],
          actionOptions: [{ id: "hills_tumble", actionType: "attack_rider", trigger: "source_hits_with_attack_roll", preselect: true, consumeOnHitOnly: true, sizeMax: "Large", applyEffect: { kind: "condition", condition: "prone" } }]
        }
      })] }),
      stone: lineage({ id: "stone", name: "Stone", features: [feature({
        id: "stones_endurance",
        name: "Stone's Endurance",
        description: "Reaction when you take damage: reduce it by 1d12 + Constitution modifier. If massive damage would kill you outright, you fall unconscious instead.",
        effects: {
          resources: [{ id: "stones_endurance", name: "Stone's Endurance", max: "proficiency_bonus", recovery: "long_rest" }],
          triggeredEffects: [{ id: "stones_endurance", trigger: "takes_damage", reaction: true, reactionMode: "automatic", priority: 60, damageReduction: "1d12 + constitution_modifier", preventMassiveDamageDeath: true, massiveDamageOutcome: "unconscious" }]
        }
      })] }),
      storm: lineage({ id: "storm", name: "Storm", features: [feature({
        id: "storms_thunder",
        name: "Storm's Thunder",
        description: "Reaction when you take damage from a creature within 60 feet: deal 1d8 thunder damage to that creature.",
        effects: {
          resources: [{ id: "storms_thunder", name: "Storm's Thunder", max: "proficiency_bonus", recovery: "long_rest" }],
          triggeredEffects: [{ id: "storms_thunder", trigger: "takes_damage_from_creature", reaction: true, reactionMode: "automatic", priority: 41, rangeFt: 60, damage: "1d8", damageType: "thunder", target: "damage_source" }]
        }
      })] })
    }
  }),

  halfling: species({
    id: "halfling",
    name: "Halfling",
    size: "Small",
    features: [
      feature({
        id: "lucky",
        name: "Lucky",
        description: "Reroll a 1 on a d20 Test.",
        effects: { modifiers: [{ id: "halfling_lucky", target: "d20_test", trigger: "roll_1", mode: "reroll" }] }
      }),
      feature({
        id: "brave",
        name: "Brave",
        description: "Advantage on saves against Frightened.",
        effects: { modifiers: [{ id: "brave", target: "saving_throw", condition: "frightened", mode: "advantage" }] }
      }),
      feature({
        id: "halfling_nimbleness",
        name: "Halfling Nimbleness",
        description: "You have advantage on checks and saves to avoid or end Grappled or Restrained.",
        effects: { modifiers: [{ id: "halfling_nimbleness", target: "d20_test", conditions: ["grappled", "restrained"], mode: "advantage" }] }
      }),
      feature({
        id: "naturally_stealthy",
        name: "Naturally Stealthy",
        description: "You gain half cover while standing directly behind a friendly creature.",
        effects: { modifiers: [{ id: "naturally_stealthy", target: "cover", condition: "behind_friendly_creature", cover: "half" }] }
      })
    ],
    lineages: { lightfoot: lineage({ id: "lightfoot", name: "Lightfoot" }), stout: lineage({ id: "stout", name: "Stout" }) }
  }),

  human: species({
    id: "human",
    name: "Human",
    features: [
      feature({
        id: "resourceful",
        name: "Resourceful",
        description: "Once per Long Rest, add 1d4 to a d20 Test.",
        effects: {
          resources: [{ id: "resourceful", name: "Resourceful", max: 1, recovery: "long_rest" }],
          modifiers: [{ id: "resourceful_d20_bonus", target: "d20_test", formula: "1d4", timing: "after_roll_before_outcome" }]
        }
      }),
      feature({ id: "skillful", name: "Skillful", effect: "skill_choice", description: "Gain proficiency in one skill of your choice." }),
      feature({ id: "versatile", name: "Versatile", effect: "feat_choice", description: "Gain one Origin feat of your choice." })
    ]
  }),

  orc: species({
    id: "orc",
    name: "Orc",
    senses: [{ type: "darkvision", rangeFt: 60 }],
    features: [
      feature({
        id: "adrenaline_rush",
        name: "Adrenaline Rush",
        description: "Bonus Action Dash and gain temporary HP equal to PB.",
        effects: {
          resources: [{ id: "adrenaline_rush", name: "Adrenaline Rush", max: "proficiency_bonus", recovery: "long_rest" }],
          actionOptions: [{ id: "adrenaline_rush", actionType: "bonus_action", grantsDash: true, temporaryHpFormula: "proficiency_bonus" }]
        }
      }),
      feature({
        id: "relentless_endurance",
        name: "Relentless Endurance",
        description: "When reduced to 0 HP, drop to 1 instead once per Long Rest.",
        effects: {
          resources: [{ id: "relentless_endurance", name: "Relentless Endurance", max: 1, recovery: "long_rest" }],
          triggeredEffects: [{ id: "relentless_endurance", trigger: "would_drop_to_0_hp", outcome: "drop_to_1_hp" }]
        }
      })
    ]
  }),

  tiefling: species({
    id: "tiefling",
    name: "Tiefling",
    senses: [{ type: "darkvision", rangeFt: 60 }],
    features: [feature({ id: "otherworldly_presence", name: "Otherworldly Presence", description: "You know Thaumaturgy.", grantsSpellId: "thaumaturgy" })],
    lineages: {
      abyssal: lineage({ id: "abyssal", name: "Abyssal", resistances: ["poison"], features: [feature({ id: "abyssal_legacy_1", name: "Abyssal Legacy", description: "You know Poison Spray.", grantsSpellId: "poison_spray" })] }),
      chthonic: lineage({ id: "chthonic", name: "Chthonic", resistances: ["necrotic"], features: [feature({ id: "chthonic_legacy_1", name: "Chthonic Legacy", description: "You know Chill Touch.", grantsSpellId: "chill_touch" })] }),
      infernal: lineage({ id: "infernal", name: "Infernal", resistances: ["fire"], features: [feature({ id: "infernal_legacy_1", name: "Infernal Legacy", description: "You know Fire Bolt.", grantsSpellId: "fire_bolt" })] })
    }
  })
};

export const SPECIES_LIST = Object.values(SPECIES);

export function getSpeciesById(id) {
  return SPECIES[id] || null;
}

export default SPECIES;
