// Canonical headwear registry.
// Headwear occupies one slot, requires no attunement, and resolves its art by id.

const headwearRecords = [
  headwearItem("circlet_of_blasting", "Circlet of Blasting", "Once per Long Rest, cast Scorching Ray.", {
    mechanics: { kind: "grant_spell", spellId: "scorching_ray", uses: 1, reset: "long_rest" },
  }),
  headwearItem("circlet_of_fire_resistance", "Circlet of Fire Resistance", "You have resistance to fire damage.", {
    modifiers: { resistances: ["fire"] },
    mechanics: { kind: "damage_resistance", damageType: "fire" },
  }),
  headwearItem("headband_of_intellect", "Headband of Intellect", "Your Intelligence score is 17 while wearing this headband.", {
    modifiers: { abilityScoreMinimums: { intelligence: 17 } },
    mechanics: { kind: "ability_score_minimum", ability: "intelligence", score: 17 },
  }),
  headwearItem("cap_of_vanishing", "Cap of Vanishing", "Once per Long Rest, become Invisible for up to 1 minute. The effect ends if you attack or cast a spell with a Somatic component.", {
    mechanics: {
      kind: "grant_active_effect",
      actionCost: "action",
      condition: "invisible",
      durationSeconds: 60,
      uses: 1,
      reset: "long_rest",
      endsOn: ["attack", "cast_spell_with_somatic_component"],
    },
  }),
  headwearItem("helm_of_comprehending_script", "Helm of Comprehending Script", "You immediately find yourself able to read all script.", {
    mechanics: { kind: "comprehend_written_language", allScripts: true },
  }),
  headwearItem("helm_of_desperate_measures", "Helm of Desperate Measures", "Cast Daylight, Fireball, or Wall of Fire once. The helm then crumbles to dust.", {
    mechanics: {
      kind: "grant_spell_choice",
      spellIds: ["daylight", "fireball", "wall_of_fire"],
      sharedUses: 1,
      consumeItemOnUse: true,
    },
  }),
];

export const headwear = Object.freeze(headwearRecords.map((record) => Object.freeze(record)));

const headwearById = new Map(headwear.map((record) => [record.id, record]));

export function getHeadwearById(id) {
  if (!id) return null;
  return headwearById.get(id) || null;
}

function headwearItem(id, name, description, rules) {
  return {
    id,
    type: "equipment",
    equipmentKind: "headwear",
    name,
    description,
    stackable: false,
    maxStackSize: 1,
    allowedSlots: ["headwear"],
    requiresAttunement: false,
    magical: true,
    icon: {
      src: `combat_ui_v2/assets/icons/headwear/${id}.png`,
      width: 80,
      height: 80,
    },
    modifiers: rules.modifiers || {},
    mechanics: rules.mechanics,
  };
}
