// Canonical ring registry.
//
// Rings occupy either ring slot, never require attunement, and are world-unique:
// exactly one instance of each named ring may exist in a game, without exception.
// Equipment slots reference that instance by id and never create another copy.

const ringRecords = [
  ring("ring_of_protection", "Ring of Protection", "A plain, weighty band that turns aside the final inch of a blow.", {
    modifiers: { acBonus: 1 },
    mechanics: { kind: "passive_modifier", acBonus: 1 },
  }),
  ring("ring_of_the_bulwark", "Ring of the Bulwark", "The band grows cold when its wearer settles into a guarded stance.", {
    mechanics: { kind: "conditional_ac_bonus", amount: 1, while: "dodging", until: "start_of_wearer_next_turn" },
  }),
  resistanceRing("ring_of_warmth", "Ring of Warmth", "cold"),
  resistanceRing("ring_of_cinders", "Ring of Cinders", "fire"),
  resistanceRing("ring_of_grounding", "Ring of Grounding", "lightning"),
  ring("ring_of_the_antidote", "Ring of the Antidote", "A bitter green stone clouds in the presence of venom.", {
    modifiers: { resistances: ["poison"] },
    mechanics: {
      kind: "compound_passive",
      resistance: "poison",
      advantageOnSavingThrows: [{ condition: "poisoned" }],
    },
  }),
  resistanceRing("ring_of_the_still_mind", "Ring of the Still Mind", "psychic"),
  ring("ring_of_the_sprinter", "Ring of the Sprinter", "Fine grooves race endlessly around this restless silver band.", {
    mechanics: { kind: "grant_basic_action", action: "dash", cost: "bonus_action" },
  }),
  ring("ring_of_withdrawal", "Ring of Withdrawal", "Its dark inner edge seems always to recede from the eye.", {
    mechanics: { kind: "grant_basic_action", action: "disengage", cost: "bonus_action" },
  }),
  ring("ring_of_sure_footing", "Ring of Sure Footing", "The broad iron band steadies every step across treacherous ground.", {
    mechanics: { kind: "movement_rule", ignoreDifficultTerrain: true },
  }),
  ring("ring_of_the_leaper", "Ring of the Leaper", "A small crouched frog is stamped inside the band.", {
    mechanics: { kind: "movement_rule", jumpDistanceMultiplier: 3 },
  }),
  ring("ring_of_quick_rising", "Ring of Quick Rising", "The ring twists upright whenever it is laid on its side.", {
    mechanics: { kind: "movement_rule", standFromProneMovementFt: 5 },
  }),
  ring("ring_of_counterweight", "Ring of Counterweight", "A loose iron bead always settles against the direction of force.", {
    mechanics: {
      kind: "roll_advantage",
      rolls: ["ability_check", "saving_throw"],
      when: ["resist_forced_movement", "resist_prone"],
    },
  }),
  ring("ring_of_the_investigator", "Ring of the Investigator", "A tiny lens turns within the ring's square-cut setting.", {
    modifiers: { skillAdvantages: ["investigation"] },
    mechanics: { kind: "skill_advantage", skills: ["investigation"] },
  }),
  ring("ring_of_readiness", "Ring of Readiness", "Its split band tightens a heartbeat before danger breaks.", {
    modifiers: { initiativeBonus: 2 },
    mechanics: { kind: "passive_modifier", initiativeBonus: 2 },
  }),
  ring("ring_of_resolve", "Ring of Resolve", "The black stone remains warm while its wearer holds their ground.", {
    modifiers: { saveAdvantages: [{ condition: "frightened" }] },
    mechanics: { kind: "saving_throw_advantage", when: "resist_frightened" },
  }),
  ring("ring_of_the_crooked_step", "Ring of the Crooked Step", "No matter how it is worn, the band appears slightly out of line.", {
    mechanics: {
      kind: "triggered_movement",
      trigger: "melee_attack_misses_wearer",
      cost: "reaction",
      distanceFt: 5,
      avoidsOpportunityAttackFromTriggeringAttacker: true,
    },
  }),
  ring("ring_of_the_last_footstep", "Ring of the Last Footstep", "A second, shadow-dark band follows just behind the first.", {
    mechanics: {
      kind: "opportunity_attack_substitution",
      trigger: "first_opportunity_attack_provoked_by_wearer_each_combat",
      target: "wearer_shadow",
      outcome: "automatic_miss",
      attackerExpendsReaction: true,
      usesPerCombat: 1,
      reset: "combat_start",
    },
  }),
];

export const rings = Object.freeze(ringRecords.map((record) => Object.freeze(record)));

const ringById = new Map(rings.map((record) => [record.id, record]));

export function getRingById(id) {
  if (!id) return null;
  return ringById.get(id) || null;
}

function ring(id, name, inspectText, rules) {
  return {
    id,
    type: "equipment",
    equipmentKind: "ring",
    name,
    inspectText,
    description: mechanicalDescription(name),
    stackable: false,
    unique: true,
    worldUnique: true,
    maxStackSize: 1,
    allowedSlots: ["ring1", "ring2"],
    requiresAttunement: false,
    magical: true,
    icon: {
      src: `combat_ui_v2/assets/icons/rings/${id}.png`,
      width: 80,
      height: 80,
    },
    modifiers: rules.modifiers || {},
    mechanics: rules.mechanics,
  };
}

function resistanceRing(id, name, damageType) {
  return ring(id, name, `A weathered band that dulls the bite of ${damageType}.`, {
    modifiers: { resistances: [damageType] },
    mechanics: { kind: "damage_resistance", damageType },
  });
}

function mechanicalDescription(name) {
  const descriptions = {
    "Ring of Protection": "You gain a +1 bonus to AC while wearing this ring.",
    "Ring of the Bulwark": "After you take the Dodge action, you gain +1 AC until the start of your next turn.",
    "Ring of Warmth": "You have resistance to cold damage while wearing this ring.",
    "Ring of Cinders": "You have resistance to fire damage while wearing this ring.",
    "Ring of Grounding": "You have resistance to lightning damage while wearing this ring.",
    "Ring of the Antidote": "You have resistance to poison damage and advantage on saving throws made to avoid or end the Poisoned condition.",
    "Ring of the Still Mind": "You have resistance to psychic damage while wearing this ring.",
    "Ring of the Sprinter": "You can take the Dash action as a Bonus Action.",
    "Ring of Withdrawal": "You can take the Disengage action as a Bonus Action.",
    "Ring of Sure Footing": "Moving through difficult terrain costs you no additional movement.",
    "Ring of the Leaper": "Your jump distance is tripled, but you cannot jump farther than your remaining movement allows.",
    "Ring of Quick Rising": "Standing from Prone costs you 5 feet of movement instead of half your Speed.",
    "Ring of Counterweight": "You have advantage on ability checks and saving throws made to resist being knocked Prone or moved against your will.",
    "Ring of the Investigator": "You have advantage on Intelligence (Investigation) checks.",
    "Ring of Readiness": "You gain a +2 bonus to Initiative rolls.",
    "Ring of Resolve": "You have advantage on saving throws made to avoid or end the Frightened condition.",
    "Ring of the Crooked Step": "When a melee attack misses you, you can use your Reaction to move up to 5 feet. This movement doesn't provoke an Opportunity Attack from the attacker that missed you.",
    "Ring of the Last Footstep": "The first time in each combat that your movement provokes an Opportunity Attack, the attack targets your shadow and automatically misses. The attacker still expends its Reaction.",
  };
  return descriptions[name];
}
