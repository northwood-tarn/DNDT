const PAPER_TYPES = [
  { id: "acid", name: "Acid", damageType: "acid" },
  { id: "fire", name: "Fire", damageType: "fire" },
  { id: "lightning", name: "Lightning", damageType: "lightning" },
  { id: "grave", name: "Grave", damageType: "necrotic" },
];

const VIAL_TYPES = [
  { id: "poison", name: "Poison", damageType: "poison", saveAbility: "constitution", effect: "poison_fumes" },
  { id: "tar", name: "Tar", damageType: null, saveAbility: "strength", effect: "sticky_ground" },
  { id: "smoke", name: "Smoke", damageType: null, saveAbility: "constitution", effect: "smoke_cloud" },
];

export const DEVICE_RECIPES = Object.fromEntries([
  ...PAPER_TYPES.flatMap(paperRecipes),
  ...VIAL_TYPES.flatMap(vialRecipes),
  makeshiftFanRecipe(),
  thunderWireRecipe(),
  saintPaperRecipe(),
  grenadoRecipe({ id: "fire_grenado", name: "Fire Grenado", damageType: "fire" }),
  grenadoRecipe({ id: "frost_grenado", name: "Frost Grenado", damageType: "cold", effect: "frost_slow" }),
  graveLimeRecipe(),
  spellSootRecipe(),
].map((item) => [item.id, item]));

export const DEVICE_RECIPE_LIST = Object.values(DEVICE_RECIPES);

export function getDeviceRecipeById(id) {
  return DEVICE_RECIPES[id] || null;
}

export function describeDeviceRecipe(recipe, proficiencyBonus) {
  const bonus = Number(proficiencyBonus) || 0;
  return String(recipe?.text || "")
    .replace(/PB \+ 1 rounds/gi, `${bonus + 1} rounds`)
    .replace(/PB rounds/gi, `${bonus} rounds`)
    .replace(/proficiency bonus d12/gi, `${bonus}d12`);
}

export function listDeviceRecipes(options = {}) {
  const level = options.level || 20;
  const ids = new Set(options.ids || DEVICE_RECIPE_LIST.map((recipe) => recipe.id));
  return DEVICE_RECIPE_LIST
    .filter((recipe) => ids.has(recipe.id))
    .filter((recipe) => (recipe.minLevel || 1) <= level)
    .sort((a, b) => (a.minLevel || 1) - (b.minLevel || 1) || a.name.localeCompare(b.name));
}

function paperRecipes(type) {
  return [
    paperRecipe({ ...type, tier: "regular", minLevel: 3, damage: "1d6", duration: "proficiency_bonus" }),
    paperRecipe({ ...type, tier: "greater", minLevel: 8, damage: "1d8", duration: "proficiency_bonus + 1" }),
  ];
}

function vialRecipes(type) {
  return [
    vialRecipe({ ...type, tier: "regular", minLevel: 3, damage: type.damageType ? "1d6" : null, rangeFt: 20, radiusFt: 5, duration: "proficiency_bonus" }),
    vialRecipe({ ...type, tier: "greater", minLevel: 8, damage: type.damageType ? "2d6" : null, rangeFt: 30, radiusFt: 10, duration: "proficiency_bonus + 1" }),
  ];
}

function paperRecipe({ id, name, damageType, tier, minLevel, damage, duration }) {
  const greater = tier === "greater";
  return recipe({
    id: `${greater ? "greater_" : ""}${id}_paper`,
    name: `${greater ? "Greater " : ""}${name} Paper`,
    family: "paper",
    tier,
    minLevel,
    use: "Bonus Action",
    text: `Coat one weapon. For ${formatDuration(duration)} rounds, hits with that weapon deal +${damage} ${damageType} damage. A weapon can benefit from only one paper at a time.`,
    action: selfBuff({
      actionType: "bonus_action",
      duration,
      deviceEffect: {
        kind: "weapon_damage_buff",
        bonusDamage: damage,
        damageType,
        durationRounds: duration,
        exclusiveFamilyOnTarget: "paper",
      },
    }),
  });
}

function vialRecipe({ id, name, damageType, saveAbility, effect, tier, minLevel, damage, rangeFt, radiusFt, duration }) {
  const greater = tier === "greater";
  const damageText = damage ? ` Creatures in the area test ${abilityLabel(saveAbility)} or take ${damage} ${damageType} damage.` : "";
  return recipe({
    id: `${greater ? "greater_" : ""}${id}_vial`,
    name: `${greater ? "Greater " : ""}${name} Vial`,
    family: "vial",
    tier,
    minLevel,
    use: "Action",
    text: `Thrown ${rangeFt} ft; creates a ${radiusFt}-ft radius area for ${formatDuration(duration)} rounds.${damageText}`,
    action: areaSave({
      damage,
      damageType,
      saveAbility,
      rangeFt,
      radiusFt,
      duration,
      objectKind: effect,
      deviceEffect: { kind: effect, durationRounds: duration, radiusFt },
    }),
  });
}

function grenadoRecipe({ id, name, damageType, effect = null }) {
  return recipe({
    id,
    name,
    family: "grenado",
    tier: "grenado",
    minLevel: 7,
    use: "Action",
    text: `Thrown 20 ft; one target takes proficiency bonus d12 ${damageType} damage (${damageType === "cold" ? "CON" : "DEX"} save half).`,
    action: targetSave({
      damage: "proficiency_bonus d12",
      damageType,
      saveAbility: damageType === "cold" ? "constitution" : "dexterity",
      rangeFt: 20,
      deviceEffect: effect ? { kind: effect } : null,
    }),
  });
}

function makeshiftFanRecipe() {
  return recipe({
    id: "makeshift_fan",
    name: "Makeshift Fan",
    family: "defense",
    tier: "regular",
    minLevel: 5,
    use: "Reaction",
    text: "When an attack would hit you, snap open a patched fan of wire, foil, and treated paper. Until the start of your next turn, gain +5 AC, including against the triggering attack.",
    action: selfBuff({
      actionType: "reaction",
      duration: "turn_start",
      reactionPolicy: shieldReactionPolicy("makeshift_fan"),
      deviceEffect: { kind: "shield_reaction", acBonus: 5 },
    }),
  });
}

function thunderWireRecipe() {
  return recipe({
    id: "thunder_wire",
    name: "Thunder Wire",
    family: "wire",
    tier: "regular",
    minLevel: 5,
    use: "Action",
    text: "Cast a humming wire in a 30-ft line. Creatures in the line test DEX or take 2d6 thunder damage.",
    action: lineSave({
      damage: "2d6",
      damageType: "thunder",
      saveAbility: "dexterity",
      rangeFt: 30,
      lengthFt: 30,
      deviceEffect: { kind: "thunder_line" },
    }),
  });
}

function saintPaperRecipe() {
  return recipe({
    id: "saint_paper",
    name: "Saint Paper",
    family: "paper",
    tier: "saint",
    minLevel: 7,
    use: "Bonus Action",
    text: "Coat one weapon. For PB rounds, hits with that weapon deal +1d6 radiant damage, doubled against undead. A weapon can benefit from only one paper at a time.",
    action: selfBuff({
      actionType: "bonus_action",
      duration: "proficiency_bonus",
      deviceEffect: {
        kind: "weapon_damage_buff",
        bonusDamage: "1d6",
        damageType: "radiant",
        durationRounds: "proficiency_bonus",
        exclusiveFamilyOnTarget: "paper",
        targetMultipliers: { undead: 2 },
      },
    }),
  });
}

function graveLimeRecipe() {
  return recipe({
    id: "grave_lime",
    name: "Grave Lime",
    family: "anti_healing",
    tier: "regular",
    minLevel: 7,
    use: "Action",
    text: "Thrown 30 ft; creates a 10-ft radius area for PB rounds. Creatures in the lime cannot regain hit points while they remain inside.",
    action: areaSave({
      damage: null,
      damageType: null,
      saveAbility: "constitution",
      rangeFt: 30,
      radiusFt: 10,
      duration: "proficiency_bonus",
      objectKind: "grave_lime_cloud",
      deviceEffect: { kind: "healing_block_area", durationRounds: "proficiency_bonus", radiusFt: 10 },
    }),
  });
}

function spellSootRecipe() {
  return recipe({
    id: "spell_soot",
    name: "Spell Soot",
    family: "anti_magic",
    tier: "regular",
    minLevel: 7,
    use: "Action",
    text: "Thrown 30 ft; scatters spell-ash in a 10-ft radius. Concentrating creatures inside must immediately retest concentration against your device save DC.",
    action: areaSave({
      damage: null,
      damageType: null,
      saveAbility: "constitution",
      rangeFt: 30,
      radiusFt: 10,
      duration: null,
      objectKind: "spell_soot_cloud",
      deviceEffect: { kind: "concentration_retest", dcFrom: "deviceSaveDC" },
    }),
  });
}

function recipe(record) {
  return {
    tags: ["device", record.family, record.tier].filter(Boolean),
    ...record,
    action: {
      tags: ["device", record.family, record.tier].filter(Boolean),
      ...(record.action || {}),
    },
  };
}

function areaSave({ actionType = "action", damage, damageType, saveAbility = "dexterity", rangeFt = 20, radiusFt = 5, duration = null, objectKind = null, deviceEffect = null }) {
  return {
    actionType,
    requiresTarget: true,
    rangeFt,
    save: { ability: saveAbility, dcFrom: "deviceSaveDC", onSave: damage ? "half" : "negates" },
    damage: damage ? { dice: damage, type: damageType } : null,
    targeting: { shape: "radius", radiusSquares: Math.ceil(radiusFt / 5), radiusFt },
    duration,
    object: objectKind ? { kind: objectKind, radiusFt, durationRounds: duration } : null,
    deviceEffect,
  };
}

function targetSave({ actionType = "action", damage, damageType, saveAbility = "dexterity", rangeFt = 20, deviceEffect = null }) {
  return {
    actionType,
    requiresTarget: true,
    rangeFt,
    save: { ability: saveAbility, dcFrom: "deviceSaveDC", onSave: "half" },
    damage: { dice: damage, type: damageType },
    deviceEffect,
  };
}

function lineSave({ actionType = "action", damage, damageType, saveAbility = "dexterity", rangeFt = 30, lengthFt = 30, deviceEffect = null }) {
  return {
    actionType,
    requiresTarget: true,
    rangeFt,
    save: { ability: saveAbility, dcFrom: "deviceSaveDC", onSave: "half" },
    damage: { dice: damage, type: damageType },
    targeting: { shape: "line", lengthSquares: Math.ceil(lengthFt / 5), lengthFt },
    deviceEffect,
  };
}

function selfBuff({ actionType = "action", duration = null, reactionPolicy = null, deviceEffect = null }) {
  return { actionType, requiresTarget: false, rangeFt: 0, duration, reactionPolicy, deviceEffect };
}

function shieldReactionPolicy(id) {
  return {
    id,
    trigger: "would_be_hit_by_attack",
    reactionMode: "prompt",
    promptMode: "binary",
    relevance: "would_change_hit",
    offerOnlyIfEffective: true,
    cost: { type: "none", policy: "none" },
    effect: {
      kind: "ac_bonus",
      amount: 5,
      duration: "turn_start",
      preventsTriggeringHit: true,
    },
    priority: 80,
  };
}

function formatDuration(duration) {
  if (duration === "proficiency_bonus") return "PB";
  if (duration === "proficiency_bonus + 1") return "PB + 1";
  return String(duration || "1");
}

function abilityLabel(ability) {
  return String(ability || "dexterity").slice(0, 3).toUpperCase();
}
