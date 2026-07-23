// Canonical footwear registry.
//
// Footwear occupies the boots equipment slot. Icon data will be added after
// the artwork is approved; item mechanics remain independent of presentation.

const footwearRecords = [
  footwearItem("standard_boots", "Standard Boots", "Practical armour-neutral boots.", {
    magical: false,
  }),
  footwearItem("shoes_of_soft_passage", "Shoes of Soft Passage", "Advantage on Stealth checks.", {
    modifiers: { skillAdvantages: ["stealth"] },
    mechanics: { kind: "skill_advantage", skills: ["stealth"] },
  }),
  footwearItem("mudlark_boots", "Mudlark Boots", "Difficult terrain costs no additional movement.", {
    mechanics: { kind: "movement_rule", ignoreDifficultTerrain: true },
  }),
  footwearItem("springheel_shoes", "Springheel Shoes", "Double your jump distance; standing from Prone costs only 5 feet of movement.", {
    mechanics: { kind: "movement_rule", jumpDistanceMultiplier: 2, standFromProneMovementFt: 5 },
  }),
  footwearItem("pursuers_boots", "Pursuer's Boots", "Your Speed increases by 10 feet during combat.", {
    modifiers: { combatSpeedBonusFt: 10 },
    mechanics: { kind: "conditional_speed_bonus", amountFt: 10, while: "in_combat" },
  }),
  footwearItem("ironroot_boots", "Ironroot Boots", "Advantage on checks and saves against being knocked Prone or moved against your will.", {
    mechanics: {
      kind: "roll_advantage",
      rolls: ["ability_check", "saving_throw"],
      when: ["resist_forced_movement", "resist_prone"],
    },
  }),
  footwearItem("boots_of_speed", "Boots of Speed", "Whenever you Dash, gain an additional 10 feet of movement that turn.", {
    mechanics: { kind: "dash_movement_bonus", amountFt: 10 },
  }),
  footwearItem("mistwalker_boots", "Mistwalker Boots", "Once per Long Rest, cast Misty Step.", {
    mechanics: { kind: "grant_spell", spellId: "misty_step", uses: 1, reset: "long_rest" },
  }),
  footwearItem("greater_mistwalker_boots", "Greater Mistwalker Boots", "Twice per Long Rest, cast Misty Step.", {
    mechanics: { kind: "grant_spell", spellId: "misty_step", uses: 2, reset: "long_rest" },
  }),
  footwearItem("fleetfoot_boots", "Fleetfoot Boots", "Your Speed increases by 5 feet.", {
    modifiers: { speedBonusFt: 5 },
    mechanics: { kind: "passive_speed_bonus", amountFt: 5 },
  }),
  footwearItem("gripsole_boots", "Gripsole Boots", "Advantage on Acrobatics checks.", {
    modifiers: { skillAdvantages: ["acrobatics"] },
    mechanics: { kind: "skill_advantage", skills: ["acrobatics"] },
  }),
];

export const footwear = Object.freeze(footwearRecords.map((record) => Object.freeze(record)));

const footwearById = new Map(footwear.map((record) => [record.id, record]));

export function getFootwearById(id) {
  if (!id) return null;
  return footwearById.get(id) || null;
}

function footwearItem(id, name, description, rules) {
  return {
    id,
    type: "equipment",
    equipmentKind: "footwear",
    name,
    description,
    stackable: false,
    maxStackSize: 1,
    allowedSlots: ["boots"],
    requiresAttunement: false,
    magical: rules.magical !== false,
    icon: {
      src: `combat_ui_v2/assets/icons/footwear/${id}.png`,
      width: 80,
      height: 80,
    },
    modifiers: rules.modifiers || {},
    mechanics: rules.mechanics || null,
  };
}
