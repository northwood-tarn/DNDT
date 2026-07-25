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

const DRAGONBORN_BREATH_VARIANTS = {
  black: { damageType: "acid", effects: [{ type: "modifier", trigger: "failed_save", stat: "ac", amount: -1, duration: "turn_start" }] },
  blue: { damageType: "lightning", effects: [{ type: "condition", trigger: "failed_save", condition: "reactions_blocked", duration: "turn_start" }] },
  brass: { damageType: "fire", effects: [{ type: "condition", trigger: "failed_save", condition: "burning", duration: "turn_start", ongoingEffects: [{ type: "damage", trigger: "turn_start", damage: "proficiency_bonus", damageType: "fire" }] }] },
  bronze: { damageType: "lightning", effects: [{ type: "condition", trigger: "failed_save", condition: "reactions_blocked", duration: "turn_start" }] },
  copper: { damageType: "acid", effects: [{ type: "modifier", trigger: "failed_save", stat: "ac", amount: -1, duration: "turn_start" }] },
  gold: { damageType: "fire", effects: [{ type: "condition", trigger: "failed_save", condition: "burning", duration: "turn_start", ongoingEffects: [{ type: "damage", trigger: "turn_start", damage: "proficiency_bonus", damageType: "fire" }] }] },
  green: { damageType: "poison", effects: [{ type: "condition", trigger: "failed_save", condition: "next_attack_disadvantage", duration: "turn_start" }] },
  red: { damageType: "fire", effects: [{ type: "condition", trigger: "failed_save", condition: "burning", duration: "turn_start", ongoingEffects: [{ type: "damage", trigger: "turn_start", damage: "proficiency_bonus", damageType: "fire" }] }] },
  silver: { damageType: "cold", effects: [{ type: "modifier", trigger: "failed_save", stat: "speed", amount: -2, duration: "turn_start" }] },
  white: { damageType: "cold", effects: [{ type: "modifier", trigger: "failed_save", stat: "speed", amount: -2, duration: "turn_start" }] }
};

export const SPECIES = {
  aasimar: species({
    id: "aasimar",
    name: "Aasimar",
    senses: [{ type: "darkvision", rangeFt: 60 }],
    resistances: ["radiant", "necrotic"],
    features: [
      feature({
        id: "lanterna_savant",
        name: "Lanterna Savant",
        description: "You are particularly skilled at ekeing out the last drops of lanterna oil. Your maximum of oil at full is 110 instead of 100.",
        effects: {
          modifiers: [{ id: "lanterna_savant", stat: "lanterna_oil_capacity", amount: 10 }]
        }
      }),
      feature({
        id: "healing_hands",
        name: "Healing Hands",
        description: "As an action, restore HP equal to your Proficiency Bonus.",
        effects: {
          resources: [{ id: "healing_hands", name: "Healing Hands", max: 1, recovery: "long_rest" }],
          actionOptions: [{ id: "healing_hands", actionType: "action", healingFormula: "proficiency_bonus" }]
        }
      }),
      feature({
        id: "celestial_revelation",
        name: "Celestial Revelation",
        minLevel: 3,
        description: "As a Bonus Action, gain temporary HP equal to your level and +1 to all saving throws for 1 minute.",
        effects: {
          resources: [{ id: "celestial_revelation", name: "Celestial Revelation", max: 1, recovery: "long_rest" }],
          actionOptions: [{
            id: "celestial_revelation",
            actionType: "bonus_action",
            requiresTarget: false,
            duration: { kind: "rounds", rounds: 10, tick: "turn_end" },
            temporaryHpFormula: "level",
            description: "Gain temporary HP equal to your level and +1 to all saving throws for 1 minute.",
            activeEffectOnResolve: { id: "celestial_revelation_active", type: "modifier", stat: "save", amount: 1, duration: { rounds: 10, tick: "turn_end" } }
          }],
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
          actionOptions: [{
            id: "breath_weapon",
            actionType: "action",
            requiresTarget: true,
            rangeFt: 15,
            targeting: { shape: "cone", lengthSquares: 3, lengthFt: 15 },
            targetFilter: { team: "enemies" },
            save: { ability: "dexterity", dcFrom: "ability", abilityScore: "constitution", onSuccess: "half" },
            damage: "2d10",
            damageScaling: [{ minLevel: 5, add: "1d10" }],
            variantsByLineage: DRAGONBORN_BREATH_VARIANTS
          }]
        }
      }),
      feature({
        id: "awakened_breath",
        name: "Awakened Breath",
        minLevel: 5,
        description: "Your Breath Weapon deals an extra 1d10 damage. Creatures that fail the save suffer a rider based on your draconic ancestry until the start of your next turn.",
        effects: {
          narrativeTags: ["awakened_breath"]
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
        effects: { modifiers: [{ id: "dwarven_resilience", stat: "save", conditionId: "poisoned", mode: "advantage" }] }
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
            activeEffectOnResolve: { id: "stonecunning_sight", senses: [{ type: "see_invisible", rangeFt: 60 }], duration: { rounds: 10, tick: "turn_end" }, narrativeTag: "stone_sense" }
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
        effects: { modifiers: [{ id: "fey_ancestry", stat: "save", conditionId: "charmed", mode: "advantage" }] }
      }),
      feature({
        id: "trance",
        name: "Trance",
        description: "You do not need sleep and complete a Long Rest in 4 hours.",
        effects: { narrativeOnly: true }
      })
    ],
    lineages: {
      high: lineage({ id: "high", name: "High", features: [feature({ id: "high_elf_magic_1", name: "High Elf Magic", description: "You know Minor Magic.", grantsSpellId: "minor_magic" })] }),
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
      effects: { modifiers: [{ id: "gnomish_cunning", stat: "save", abilities: ["intelligence", "wisdom", "charisma"], mode: "advantage" }] }
    })],
    lineages: {
      forest: lineage({ id: "forest", name: "Forest" }),
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
          actionOptions: [{
            id: "large_form",
            actionType: "bonus_action",
            requiresTarget: false,
            duration: { rounds: 10, tick: "turn_end" },
            temporaryHpFormula: "proficiency_bonus",
            activeEffectOnResolve: { id: "large_form_active", type: "modifier", stat: "speed", amount: 2, duration: { rounds: 10, tick: "turn_end" } }
          }],
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
          damageRiders: [{ id: "fires_burn", trigger: "source_deals_damage", resourceId: "fires_burn", damage: "1d10", damageType: "fire", actionTypes: ["weapon_attack", "melee_attack", "spell_attack", "compound_weapon_attack"] }]
        }
      })] }),
      frost: lineage({ id: "frost", name: "Frost", features: [feature({
        id: "frosts_chill",
        name: "Frost's Chill",
        description: "When you hit a target with an attack roll and deal damage, you can deal an extra 1d6 cold damage and reduce its speed by 10 feet until the start of your next turn.",
        effects: {
          resources: [{ id: "frosts_chill", name: "Frost's Chill", max: "proficiency_bonus", recovery: "long_rest" }],
          damageRiders: [{
            id: "frosts_chill",
            trigger: "source_deals_damage",
            resourceId: "frosts_chill",
            damage: "1d6",
            damageType: "cold",
            actionTypes: ["weapon_attack", "melee_attack", "spell_attack", "compound_weapon_attack"],
            effects: [{ type: "modifier", trigger: "hit", stat: "speed", amount: -2, duration: "turn_start" }]
          }]
        }
      })] }),
      hill: lineage({ id: "hill", name: "Hill", features: [feature({
        id: "hills_tumble",
        name: "Hill's Tumble",
        description: "When you hit a Large or smaller creature with an attack roll and deal damage, you can give that target the Prone condition.",
        effects: {
          resources: [{ id: "hills_tumble", name: "Hill's Tumble", max: "proficiency_bonus", recovery: "long_rest" }],
          damageRiders: [{
            id: "hills_tumble",
            trigger: "source_deals_damage",
            resourceId: "hills_tumble",
            damage: "0",
            actionTypes: ["weapon_attack", "melee_attack", "spell_attack", "compound_weapon_attack"],
            effects: [{ type: "condition", trigger: "hit", condition: "prone", duration: null }]
          }]
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
        effects: { d20Rerolls: [{ id: "halfling_lucky", naturalRolls: [1] }] }
      }),
      feature({
        id: "brave",
        name: "Brave",
        description: "Advantage on saves against Frightened.",
        effects: { modifiers: [{ id: "brave", stat: "save", conditionId: "frightened", mode: "advantage" }] }
      }),
      feature({
        id: "halfling_nimbleness",
        name: "Halfling Nimbleness",
        description: "You have advantage on checks and saves to avoid or end Grappled or Restrained.",
        effects: { modifiers: [{ id: "halfling_nimbleness", stat: "d20_test", conditionIds: ["grappled", "restrained"], mode: "advantage" }] }
      }),
      feature({
        id: "naturally_stealthy",
        name: "Naturally Stealthy",
        description: "You gain half cover while standing directly behind a friendly creature.",
        effects: { narrativeTags: ["naturally_stealthy"] }
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
        description: "Once per combat, when your attack misses by 4 or less, reroll the d20 and use the higher result.",
        effects: {
          resources: [{ id: "resourceful", name: "Resourceful", max: 1, recovery: "long_rest" }]
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
          actionOptions: [{ id: "adrenaline_rush", actionType: "bonus_action", requiresTarget: false, grantsDash: true, temporaryHpFormula: "proficiency_bonus" }]
        }
      }),
      feature({
        id: "relentless_endurance",
        name: "Relentless Endurance",
        description: "When reduced to 0 HP, drop to 1 instead once per Long Rest.",
        effects: {
          resources: [{ id: "relentless_endurance", name: "Relentless Endurance", max: 1, recovery: "long_rest" }],
          triggeredEffects: [{ id: "relentless_endurance", trigger: "would_drop_to_0_hp", reaction: true, reactionMode: "automatic", priority: 100, outcome: "drop_to_1_hp" }]
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
