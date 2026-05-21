export const conditions = [
  {
    id: "blinded",
    name: "Blinded",
    category: "standard",
    summary: "Cannot see; attacks suffer, attacks against it improve, and sight checks fail.",
    mechanics: {
      cannotSee: true,
      outgoingAttackDisadvantage: true,
      incomingAttackAdvantage: true,
      autoFailAbilityChecks: ["sight"],
    },
    effects: [
      "Automatically fails ability checks that require sight.",
      "Attack rolls against the creature have advantage.",
      "The creature's attack rolls have disadvantage.",
    ],
  },
  {
    id: "charmed",
    name: "Charmed",
    category: "standard",
    summary: "Cannot harm the charmer; the charmer has social advantage against it.",
    mechanics: {
      cannotAttackSource: true,
      sourceSocialChecksAdvantage: true,
    },
    effects: [
      "Cannot attack the charmer or target the charmer with harmful abilities or magical effects.",
      "The charmer has advantage on ability checks to interact socially with the creature.",
    ],
  },
  {
    id: "deafened",
    name: "Deafened",
    category: "standard",
    summary: "Cannot hear; hearing checks fail.",
    mechanics: {
      autoFailAbilityChecks: ["hearing"],
    },
    effects: [
      "Cannot hear.",
      "Automatically fails ability checks that require hearing.",
    ],
  },
  {
    id: "frightened",
    name: "Frightened",
    category: "standard",
    summary: "Disadvantaged while the fear source is visible; cannot willingly move closer to it.",
    mechanics: {
      sourceLineOfSightAbilityCheckDisadvantage: true,
      sourceLineOfSightAttackDisadvantage: true,
      cannotMoveCloserToSource: true,
    },
    effects: [
      "Has disadvantage on ability checks and attack rolls while the source of fear is within line of sight.",
      "Cannot willingly move closer to the source of fear.",
    ],
  },
  {
    id: "grappled",
    name: "Grappled",
    category: "standard",
    summary: "Speed is 0 until the grapple ends.",
    mechanics: {
      speedZero: true,
      blocksSpeedBonuses: true,
      endsIfSourceIncapacitated: true,
      endsIfSourceReachBroken: true,
    },
    effects: [
      "Speed becomes 0 and cannot benefit from bonuses to speed.",
      "Ends if the grappler is incapacitated.",
      "Ends if an effect removes the grappled creature from the grappler's reach.",
    ],
  },
  {
    id: "incapacitated",
    name: "Incapacitated",
    category: "standard",
    summary: "Cannot take actions, bonus actions, or reactions.",
    mechanics: {
      blocksActions: true,
      blocksBonusActions: true,
      blocksReactions: true,
    },
    effects: [
      "Cannot take actions or reactions.",
    ],
  },
  {
    id: "invisible",
    name: "Invisible",
    category: "standard",
    summary: "Cannot be seen; attacks against it suffer and its attacks improve.",
    mechanics: {
      heavilyObscuredForHiding: true,
      cannotBeSeen: true,
      incomingAttackDisadvantage: true,
      outgoingAttackAdvantage: true,
    },
    effects: [
      "Cannot be seen without special senses or magic.",
      "Counts as heavily obscured for hiding.",
      "Attack rolls against the creature have disadvantage.",
      "The creature's attack rolls have advantage.",
    ],
  },
  {
    id: "paralyzed",
    name: "Paralyzed",
    category: "standard",
    summary: "Incapacitated, cannot move or speak, fails STR/DEX saves, and nearby hits crit.",
    mechanics: {
      includes: ["incapacitated"],
      blocksActions: true,
      blocksBonusActions: true,
      blocksReactions: true,
      speedZero: true,
      cannotMove: true,
      cannotSpeak: true,
      autoFailSaves: ["str", "dex"],
      incomingAttackAdvantage: true,
      meleeHitWithin5ftCritical: true,
    },
    effects: [
      "Incapacitated.",
      "Cannot move or speak.",
      "Automatically fails Strength and Dexterity saving throws.",
      "Attack rolls against the creature have advantage.",
      "A hit from an attacker within 5 feet is a critical hit.",
    ],
  },
  {
    id: "petrified",
    name: "Petrified",
    category: "standard",
    summary: "Stone-like, incapacitated, unaware, resistant to damage, and fails STR/DEX saves.",
    mechanics: {
      includes: ["incapacitated"],
      blocksActions: true,
      blocksBonusActions: true,
      blocksReactions: true,
      speedZero: true,
      cannotMove: true,
      cannotSpeak: true,
      unaware: true,
      incomingAttackAdvantage: true,
      autoFailSaves: ["str", "dex"],
      resistance: ["all"],
      immune: ["poison"],
      diseaseSuspended: true,
    },
    effects: [
      "Transformed into a solid inanimate substance.",
      "Incapacitated, cannot move or speak, and is unaware of surroundings.",
      "Attack rolls against the creature have advantage.",
      "Automatically fails Strength and Dexterity saving throws.",
      "Has resistance to all damage.",
      "Is immune to poison and disease, though existing poison or disease is suspended.",
    ],
  },
  {
    id: "poisoned",
    name: "Poisoned",
    category: "standard",
    summary: "Attacks and ability checks have disadvantage.",
    mechanics: {
      outgoingAttackDisadvantage: true,
      abilityCheckDisadvantage: true,
    },
    effects: [
      "Has disadvantage on attack rolls and ability checks.",
    ],
  },
  {
    id: "prone",
    name: "Prone",
    category: "standard",
    summary: "Can crawl or stand; attacks suffer; adjacent attackers gain advantage and ranged attackers suffer.",
    mechanics: {
      crawlOnly: true,
      standOnMove: true,
      outgoingAttackDisadvantage: true,
      adjacentIncomingAttackAdvantage: true,
      distantIncomingAttackDisadvantage: true,
    },
    effects: [
      "Can crawl unless it stands up.",
      "Has disadvantage on attack rolls.",
      "Attack rolls against the creature have advantage if the attacker is within 5 feet.",
      "Attack rolls against the creature have disadvantage if the attacker is farther than 5 feet away.",
    ],
  },
  {
    id: "restrained",
    name: "Restrained",
    category: "standard",
    summary: "Speed is 0; attacks against it improve; its attacks and DEX saves suffer.",
    mechanics: {
      speedZero: true,
      blocksSpeedBonuses: true,
      incomingAttackAdvantage: true,
      outgoingAttackDisadvantage: true,
      dexSaveDisadvantage: true,
    },
    effects: [
      "Speed becomes 0 and cannot benefit from bonuses to speed.",
      "Attack rolls against the creature have advantage.",
      "The creature's attack rolls have disadvantage.",
      "The creature has disadvantage on Dexterity saving throws.",
    ],
  },
  {
    id: "stunned",
    name: "Stunned",
    category: "standard",
    summary: "Incapacitated, cannot move, barely speaks, fails STR/DEX saves, and is easier to hit.",
    mechanics: {
      includes: ["incapacitated"],
      blocksActions: true,
      blocksBonusActions: true,
      blocksReactions: true,
      speedZero: true,
      cannotMove: true,
      limitedSpeech: true,
      autoFailSaves: ["str", "dex"],
      incomingAttackAdvantage: true,
    },
    effects: [
      "Incapacitated.",
      "Cannot move.",
      "Can speak only falteringly.",
      "Automatically fails Strength and Dexterity saving throws.",
      "Attack rolls against the creature have advantage.",
    ],
  },
  {
    id: "turned",
    name: "Turned",
    category: "standard",
    summary: "Must flee the source, cannot move closer, and cannot take reactions.",
    mechanics: {
      cannotMoveCloserToSource: true,
      blocksReactions: true,
      mustDashAwayFromSource: true,
      dodgeIfCannotMoveAway: true,
    },
    effects: [
      "Must spend its turns moving away from the source by the safest available route.",
      "Cannot willingly move closer to the source.",
      "Cannot take reactions.",
      "Can take only Dash or try to escape an effect that prevents movement; if it cannot move, it Dodges.",
    ],
  },
  {
    id: "grave_rebuked",
    name: "Grave Rebuked",
    category: "feature",
    summary: "Critical hits are suppressed and necrotic damage is resisted briefly.",
    mechanics: {
      suppressIncomingCriticalHits: true,
      resistance: ["necrotic"],
    },
    effects: [
      "Critical hits against the creature become normal hits.",
      "The creature has resistance to necrotic damage while the condition lasts.",
    ],
  },
  {
    id: "healing_blocked",
    name: "Healing Blocked",
    category: "combat_special",
    summary: "Cannot regain hit points while the effect lasts.",
    mechanics: {
      blocksHealing: true,
    },
    effects: [
      "Cannot regain hit points while the effect lasts.",
    ],
  },
  {
    id: "mortmain",
    name: "Mortmain",
    category: "combat_special",
    summary: "Cannot take reactions, moves sluggishly, and cannot regain hit points.",
    mechanics: {
      blocksReactions: true,
      speedMultiplier: 0.5,
      blocksHealing: true,
    },
    effects: [
      "Cannot take reactions.",
      "Speed is halved while the effect lasts.",
      "Cannot regain hit points while the effect lasts.",
    ],
  },
  {
    id: "unconscious",
    name: "Unconscious",
    category: "standard",
    summary: "Incapacitated, unaware, falls prone, fails STR/DEX saves, and nearby hits crit.",
    mechanics: {
      includes: ["incapacitated", "prone"],
      blocksActions: true,
      blocksBonusActions: true,
      blocksReactions: true,
      speedZero: true,
      cannotMove: true,
      cannotSpeak: true,
      unaware: true,
      dropsHeldItems: true,
      fallsProneOnApply: true,
      autoFailSaves: ["str", "dex"],
      incomingAttackAdvantage: true,
      meleeHitWithin5ftCritical: true,
    },
    effects: [
      "Incapacitated, cannot move or speak, and is unaware of surroundings.",
      "Drops whatever it is holding and falls prone.",
      "Automatically fails Strength and Dexterity saving throws.",
      "Attack rolls against the creature have advantage.",
      "A hit from an attacker within 5 feet is a critical hit.",
    ],
  },
  {
    id: "banished",
    name: "Banished",
    category: "combat_special",
    summary: "Removed from normal combat interaction until the effect ends.",
    mechanics: {
      blocksActions: true,
      blocksBonusActions: true,
      blocksReactions: true,
      speedZero: true,
      cannotMove: true,
      untargetable: true,
      invulnerable: true,
    },
    effects: [
      "Cannot act, move, or be targeted while the effect lasts.",
    ],
  },
  {
    id: "wracked_by_pain",
    name: "Wracked by Pain",
    category: "combat_special",
    summary: "Attacks and ability checks have disadvantage while pain persists.",
    mechanics: {
      outgoingAttackDisadvantage: true,
      abilityCheckDisadvantage: true,
    },
    effects: [
      "Has disadvantage on attack rolls and ability checks.",
    ],
  },
  {
    id: "expeditious_retreat",
    name: "Expeditious Retreat",
    category: "combat_special",
    summary: "Can Dash using a bonus action while the spell lasts.",
    mechanics: {
      grantsBonusDash: true,
    },
    effects: [
      "Can take the Dash action using a bonus action.",
    ],
  },
  {
    id: "sanctuary",
    name: "Sanctuary",
    category: "combat_special",
    summary: "Attackers must pass a Wisdom save before targeting this actor.",
    mechanics: {
      incomingTargetSaveGate: true,
      incomingTargetSaveAbility: "wis",
      endsOnOffense: true,
    },
    effects: [
      "A creature must pass a Wisdom save before targeting this actor with an attack.",
      "Ends if this actor makes an attack or casts an offensive spell.",
    ],
  },
  {
    id: "hexed",
    name: "Hexed",
    category: "combat_special",
    summary: "Marked by a caster for attack-hit damage riders.",
    mechanics: {},
    effects: [
      "The source spell can add damage when its caster hits this creature with an attack roll.",
    ],
  },
  {
    id: "burning",
    name: "Burning",
    category: "combat_special",
    summary: "Marked as burning by an ongoing fire effect.",
    mechanics: {},
    effects: [
      "The source effect defines any ongoing fire damage and removal rules.",
    ],
  },
  {
    id: "stable",
    name: "Stable",
    category: "combat_special",
    summary: "No longer actively dying.",
    mechanics: {},
    effects: [
      "The creature is no longer making death saves or worsening from untreated wounds.",
    ],
  },
  {
    id: "armor_of_agathys",
    name: "Armor of Agathys",
    category: "combat_special",
    summary: "Protective frost that retaliates while temporary hit points remain.",
    mechanics: {},
    effects: [
      "While the granted temporary hit points remain, melee attackers take retaliatory cold damage.",
    ],
  },
  {
    id: "reactions_blocked",
    name: "Reactions Blocked",
    category: "combat_transient",
    summary: "Cannot take reactions while the effect lasts.",
    mechanics: {
      blocksReactions: true,
    },
    effects: [
      "Cannot take reactions.",
    ],
  },
  {
    id: "opportunity_attacks_blocked",
    name: "Opportunity Attacks Blocked",
    category: "combat_transient",
    summary: "Cannot make Opportunity Attacks while the effect lasts.",
    mechanics: {
      blocksOpportunityAttacks: true,
    },
    effects: [
      "Cannot make Opportunity Attacks.",
    ],
  },
  {
    id: "dodging",
    name: "Dodging",
    category: "combat_transient",
    summary: "Attacks against this actor have disadvantage until the start of its next turn.",
    mechanics: {
      incomingAttackDisadvantage: true,
      duration: "turn_start",
    },
    effects: [
      "Attack rolls against the creature have disadvantage until the start of its next turn.",
    ],
  },
  {
    id: "surprised",
    name: "Surprised",
    category: "combat_transient",
    summary: "Used by surprise-aware features during the opening exchange of combat.",
    mechanics: {},
    effects: [
      "Feature hooks may treat hits against this creature as surprise hits.",
    ],
  },
  {
    id: "next_attack_disadvantage",
    name: "Next attack disadvantage",
    category: "combat_transient",
    summary: "The next attack made by this actor has disadvantage, then the condition is consumed.",
    mechanics: {
      outgoingAttackDisadvantage: true,
      consumeOn: "outgoing_attack",
    },
    effects: [
      "The next attack roll made by this creature has disadvantage.",
      "The condition is consumed after that attack roll.",
    ],
  },
  {
    id: "next_incoming_attack_advantage",
    name: "Next incoming attack advantage",
    category: "combat_transient",
    summary: "The next attack against this actor has advantage, then the condition is consumed.",
    mechanics: {
      incomingAttackAdvantage: true,
      consumeOn: "incoming_attack",
    },
    effects: [
      "The next attack roll against this creature has advantage.",
      "The condition is consumed after that attack roll.",
    ],
  },
];

export const conditionsById = Object.fromEntries(conditions.map((condition) => [condition.id, condition]));

export const conditionRules = Object.fromEntries(
  conditions.map((condition) => [
    condition.id,
    {
      name: condition.name,
      ...(condition.mechanics || {}),
    },
  ])
);

export function getCondition(conditionId) {
  return conditionsById[conditionId] || null;
}

export function getConditionRules(conditionId) {
  return conditionRules[conditionId] || {};
}

export function getConditionName(conditionId) {
  return getCondition(conditionId)?.name || conditionId.split("_").join(" ");
}

export function hasCondition(actor, conditionId) {
  return Array.isArray(actor?.conditions) && actor.conditions.some((condition) =>
    typeof condition === "string"
      ? condition === conditionId
      : condition.id === conditionId || condition.name === conditionId
  );
}
