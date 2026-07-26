const OVERRIDES = {
  mending: { hooks: { utility: { kind: "repair_object", maximumBreakSizeFt: 1 } } },
  mage_hand: { hooks: { utility: { kind: "remote_interact", rangeFt: 30, maximumWeightLb: 10 } } },
  minor_magic: { hooks: { utility: { kind: "minor_magic", cosmeticOnly: true, maxDurationSeconds: 3600 } } },
  detect_magic: { hooks: { utility: { kind: "detect_filter", filter: "magic", radiusFt: 30, mode: "sustained" } } },
  detect_presence: { hooks: { utility: { kind: "detect_filter", filter: "presence", radiusFt: 30, mode: "pulse" } } },
  detect_poison_and_disease: { hooks: { utility: { kind: "detect_filter", filter: "poison_disease", radiusFt: 30, mode: "pulse" } } },
  silent_image: { hooks: { utility: { kind: "create_illusion", cubeFt: 15, investigationAgainstSpellDC: true } } },
  command: { hooks: { applyEffect: { kind: "mode_condition", modeChoiceKey: "effectMode", modeChoices: [{ id: "drop", name: "Drop", condition: "incapacitated" }, { id: "flee", name: "Flee", condition: "frightened" }, { id: "betray", name: "Betray", condition: "charmed" }], defaultMode: "drop", until: "end_of_target_next_turn" } } },

  protection_from_evil_and_good: { concentration: true, duration: minuteDuration(), range: touchRange(), hooks: { applyEffect: { kind: "incoming_attack_roll_penalty", amount: 0, mode: "disadvantage", target: "target", until: "end_of_duration" } } },
  beacon_of_hope: { concentration: true, duration: minuteDuration(), target: friendlyTargets(6), hooks: { applyEffect: { kind: "save_advantage", until: "end_of_duration" } } },
  protection_from_energy: { concentration: true, duration: hourDuration(), range: touchRange(), hooks: { applyEffect: { kind: "typed_damage_reduction", amount: 5, damageType: "all", until: "end_of_duration" } } },
  remove_curse: { hooks: { applyEffect: { kind: "cleanse_one", conditions: ["cursed"] } } },
  counterspell: { hooks: { applyEffect: { kind: "dispel_magic" } } },
  freedom_of_movement: { duration: hourDuration(), range: touchRange(), hooks: { applyEffect: { kind: "cleanse_all", conditions: ["grappled", "restrained", "paralyzed"] } } },
  dimension_door: { hooks: { applyEffect: { kind: "teleport", distanceFt: 500 } } },
  fire_shield: { duration: tenMinuteDuration(), target: selfTarget(), range: selfRange(), hooks: { applyEffect: { kind: "retaliation_only", damage: { dice: "2d8", type: "fire" }, until: "end_of_duration" } } },
  phantasmal_killer: { concentration: true, duration: minuteDuration(), hooks: { save: { ability: "WIS", dcFrom: "spellSaveDC", onSave: "negates" }, damage: { dice: "4d10", type: "psychic" }, applyEffect: { kind: "condition", name: "Frightened", until: "end_of_spell" } } },
  stoneskin: { concentration: true, duration: hourDuration(), range: touchRange(), hooks: { applyEffect: { kind: "typed_damage_reduction", amount: 5, damageType: "physical", until: "end_of_duration" } } },
  cloudkill: { hooks: { save: { ability: "CON", dcFrom: "spellSaveDC", onSave: "half" }, applyEffect: { kind: "area_hazard", radiusFt: 20, blocksLineOfSight: true, targetTeam: "all", ticks: [{ phase: "area_created", damage: { dice: "5d8", type: "poison" } }, { phase: "turn_end", damage: { dice: "5d8", type: "poison" } }] } } },
  investiture_of_the_patron: { hooks: { applyEffect: { kind: "investiture_form_action" } } },
  globe_of_invulnerability: { concentration: true, duration: minuteDuration(), target: selfTarget(), range: selfRange(), area: sphereArea(10), hooks: { applyEffect: { kind: "area_obscure", radiusFt: 10, followsCaster: true, blocksSpellLevelAtMost: 5 } } },
  symbol: { duration: { type: "until_dispelled", value: 0, unit: "rounds", special: "Until triggered or dispelled" }, target: pointTarget(), area: sphereArea(10), hooks: { save: { ability: "WIS", dcFrom: "spellSaveDC", onSave: "negates" }, applyEffect: { kind: "area_hazard", radiusFt: 10, targetTeam: "enemies", ticks: [{ phase: "enter_area", conditionOnFail: "stunned", save: { ability: "WIS", onSave: "negates_effect" } }] } } },

  prayer_of_healing: { casting: { time: 10, unit: "minute", reactionTrigger: null }, target: friendlyTargets(5), hooks: { healing: { dice: "2d8", addMod: true } } },
  silence: { concentration: true, duration: tenMinuteDuration(), target: pointTarget(), area: sphereArea(20), hooks: { applyEffect: { kind: "area_obscure", radiusFt: 20, blocksSound: true } } },
  aura_of_vitality: { concentration: true, duration: minuteDuration(), target: selfTarget(), range: selfRange(), hooks: { applyEffect: { kind: "repeatable_healing", healing: "2d6", rangeFt: 30, cost: "bonus" } } },
  revivify: { range: touchRange(), target: friendlyTargets(1), hooks: { healing: { dice: "1", allowDefeatedTarget: true } } },
  confusion: { concentration: true, duration: minuteDuration(), area: sphereArea(10), hooks: { save: { ability: "WIS", dcFrom: "spellSaveDC", onSave: "negates" }, applyEffect: { kind: "condition", name: "Confused", until: "end_of_spell" } } },
  greater_invisibility: { concentration: true, duration: minuteDuration(), target: friendlyTargets(1), hooks: { applyEffect: { kind: "condition", name: "Invisible", until: "end_of_spell" } } },
  ice_storm: { hooks: { save: { ability: "DEX", dcFrom: "spellSaveDC", onSave: "half" }, damage: { dice: "4d8", type: "cold" } } },
  otilukes_resilient_sphere: { concentration: true, duration: minuteDuration(), hooks: { save: { ability: "DEX", dcFrom: "spellSaveDC", onSave: "negates" }, applyEffect: { kind: "condition", name: "Restrained", until: "end_of_spell" } } },
  wall_of_fire: { concentration: true, duration: minuteDuration(), area: lineArea(60, 20), hooks: { save: { ability: "DEX", dcFrom: "spellSaveDC", onSave: "half" }, applyEffect: { kind: "wall", lengthFt: 60, heightFt: 20, ticks: [{ phase: "enter_area", damage: { dice: "5d8", type: "fire" } }, { phase: "turn_end", damage: { dice: "5d8", type: "fire" } }] } } },
  flame_strike: { hooks: { save: { ability: "DEX", dcFrom: "spellSaveDC", onSave: "half" }, damage: { dice: "8d6", type: "radiant" } } },
  mass_cure_wounds: { target: friendlyTargets(6), hooks: { healing: { dice: "3d8", addMod: true } } },
  dominate_person: { concentration: true, duration: minuteDuration(), hooks: { save: { ability: "WIS", dcFrom: "spellSaveDC", onSave: "negates" }, applyEffect: { kind: "condition", name: "Charmed", until: "end_of_spell" } } },
  telekinesis: { concentration: true, duration: tenMinuteDuration(), hooks: { save: { ability: "STR", dcFrom: "spellSaveDC", onSave: "negates" }, applyEffect: { kind: "condition", name: "Restrained", until: "end_of_spell" } } },
  blade_barrier: { concentration: true, duration: tenMinuteDuration(), area: lineArea(100, 20), hooks: { save: { ability: "DEX", dcFrom: "spellSaveDC", onSave: "half" }, applyEffect: { kind: "wall", lengthFt: 100, heightFt: 20, ticks: [{ phase: "enter_area", damage: { dice: "6d10", type: "force" } }, { phase: "turn_end", damage: { dice: "6d10", type: "force" } }] } } },
  harm: { hooks: { save: { ability: "CON", dcFrom: "spellSaveDC", onSave: "half" }, damage: { dice: "14d6", type: "necrotic" } } },
  heroes_feast: { casting: { time: 10, unit: "minute", reactionTrigger: null }, duration: { type: "timed", value: 24, unit: "hours", special: "24 hours" }, target: friendlyTargets(12), hooks: { healing: { dice: "2d10", addMod: false }, applyEffect: { kind: "max_hp_bonus", amount: 12 } } },
  mass_suggestion: { duration: { type: "timed", value: 24, unit: "hours", special: "24 hours" }, target: hostileTargets(12), hooks: { save: { ability: "WIS", dcFrom: "spellSaveDC", onSave: "negates" }, applyEffect: { kind: "condition", name: "Charmed", until: "end_of_duration" } } },
  otilukes_freezing_sphere: { hooks: { save: { ability: "CON", dcFrom: "spellSaveDC", onSave: "half" }, damage: { dice: "10d6", type: "cold" } } },
  ottos_irresistible_dance: { concentration: true, duration: minuteDuration(), hooks: { save: { ability: "WIS", dcFrom: "spellSaveDC", onSave: "negates" }, applyEffect: { kind: "apply_condition_bundle", name: "Dancing", until: "end_of_spell", grants: [{ kind: "condition", name: "Incapacitated" }, { kind: "condition", name: "Prone" }] } } },
  wall_of_ice: { concentration: true, duration: tenMinuteDuration(), area: lineArea(60, 10), hooks: { applyEffect: { kind: "wall", lengthFt: 60, heightFt: 10, blocksMovement: true, blocksSight: true, ticks: [{ phase: "enter_area", damage: { dice: "5d6", type: "cold" } }] } } },
  divine_word: { hooks: { save: { ability: "CHA", dcFrom: "spellSaveDC", onSave: "negates" }, damage: { dice: "7d10", type: "radiant" }, applyEffect: { kind: "condition", name: "Stunned", until: "end_of_caster_next_turn" } } },
  finger_of_death: { hooks: { save: { ability: "CON", dcFrom: "spellSaveDC", onSave: "half" }, damage: { dice: "7d8+30", type: "necrotic" } } },
  power_word_pain: { hooks: { save: { ability: "WIS", dcFrom: "spellSaveDC", onSave: "negates" }, applyEffect: { kind: "condition", name: "Wracked by Pain", until: "end_of_spell" } } },
  regenerate: { duration: hourDuration(), range: touchRange(), target: friendlyTargets(1), hooks: { healing: { dice: "4d8+15", addMod: false }, applyEffect: { kind: "regeneration", amount: 1, until: "end_of_duration" } } },
};

export function applySpellImplementationOverrides(spells) {
  for (const [id, override] of Object.entries(OVERRIDES)) {
    if (!spells[id] || spells[id].active === false) continue;
    spells[id] = merge(spells[id], override);
  }
  return spells;
}

function merge(base, override) {
  if (!isObject(base) || !isObject(override)) return structuredClone(override);
  const result = { ...base };
  for (const [key, value] of Object.entries(override)) {
    result[key] = isObject(value) && isObject(base[key]) ? merge(base[key], value) : structuredClone(value);
  }
  return result;
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function minuteDuration() { return { type: "timed", value: 60, unit: "seconds", special: "Up to 1 minute" }; }
function tenMinuteDuration() { return { type: "timed", value: 600, unit: "seconds", special: "Up to 10 minutes" }; }
function hourDuration() { return { type: "timed", value: 1, unit: "hours", special: "1 hour" }; }
function touchRange() { return { type: "touch", distance: 5, unit: "ft", special: null }; }
function selfRange() { return { type: "self", distance: 0, unit: "ft", special: null }; }
function selfTarget() { return { type: "self", count: 1, friendly: true, requiresSight: false }; }
function pointTarget() { return { type: "point", count: 1, friendly: false, requiresSight: true }; }
function friendlyTargets(count) { return { type: "creature", count, friendly: true, requiresSight: true }; }
function hostileTargets(count) { return { type: "creature", count, friendly: false, requiresSight: true }; }
function sphereArea(size) { return { shape: "sphere", size, length: 0, width: 0, height: 0, unit: "ft" }; }
function lineArea(length, height) { return { shape: "line", size: length, length, width: 5, height, unit: "ft" }; }
