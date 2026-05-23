import { getConsumableById } from "../data/consumables.js";
import { getArmorById } from "../data/armor.js";
import { getSpellRecordById } from "../data/spells.js";
import { getWeaponById } from "../data/weapons.js";
import { createConsumableAction, createNickAttackAction, createSpellAction, createWeaponAction } from "../combat/actionFactory.js";
import { normalizeCombatActor, validateCombatActor } from "../combat/actor.js";
import { createFeatureActionsFromFeatures } from "../combat/featureActionFactory.js";

const ABILITY_ABBREVIATIONS = {
  strength: "str",
  dexterity: "dex",
  constitution: "con",
  intelligence: "int",
  wisdom: "wis",
  charisma: "cha",
};

export function resolvedSheetToCombatActor(sheet, options = {}) {
  const actor = normalizeCombatActor({
    id: options.id || slug(sheet.identity.characterName || "player_character"),
    name: options.name || sheet.identity.characterName || "Player Character",
    team: options.team || "heroes",
    role: options.role || sheet.identity.classId || "character",
    creatureType: options.creatureType || "humanoid",
    tags: unique(["humanoid", ...(options.tags || [])]),
    token: options.token || defaultToken(sheet),
    hp: options.hp ?? sheet.durability.maxHp,
    maxHp: sheet.durability.maxHp,
    ac: sheet.combatBasics.armorClass,
    armorClassSources: structuredClone(sheet.combatBasics.armorClassSources || []),
    level: sheet.identity.level,
    proficiencyBonus: sheet.proficiencyBonus,
    spellSaveDC: sheet.spellcasting.spellSaveDc || null,
    spellSlots: normalizeSpellSlots(sheet.spellcasting.slots || {}),
    initiativeBonus: sheet.combatBasics.initiativeBonus || 0,
    attackActionAttacks: sheet.combatBasics.attackActionAttacks || 1,
    speed: feetToSquares(sheet.combatBasics.speed || 30),
    position: options.position || { x: 0, y: 0 },
    abilityMods: abbreviateAbilityMods(sheet.abilities || {}),
    activeEffects: createPassiveFeatureEffects(sheet),
    auras: createFeatureAuras(sheet),
    saves: abbreviateSaves(sheet.combatBasics.saves || {}),
    senses: structuredClone(sheet.combatBasics.senses || []),
    resistances: [...(sheet.durability.resistances || [])],
    immunities: [...(sheet.durability.immunities || [])],
    conditionImmunities: [...(sheet.durability.conditionImmunities || [])],
    resources: structuredClone(sheet.resources || []),
    features: structuredClone(sheet.features || []),
    featureHooks: structuredClone(sheet.featureHooks || []),
    equipment: {
      armorId: sheet.equipment.armorId || null,
      armorType: getArmorById(sheet.equipment.armorId)?.type || null,
      shieldId: sheet.equipment.shieldId || null,
      weaponIds: [...(sheet.equipment.weaponIds || [])],
      masteredWeaponIds: [...(sheet.equipment.masteredWeaponIds || [])],
    },
    inventory: structuredClone(sheet.equipment.inventory || []),
    actions: createCombatActionsFromSheet(sheet),
  });
  return actor;
}

export function validateResolvedSheetCombatActor(sheet, options = {}) {
  return validateCombatActor(resolvedSheetToCombatActor(sheet, options));
}

function createCombatActionsFromSheet(sheet) {
  return [
    ...createWeaponActions(sheet),
    ...createSpellActions(sheet),
    ...createConsumableActions(sheet),
    ...createFeatureActions(sheet),
  ].filter(Boolean);
}

function normalizeSpellSlots(slots) {
  return Object.fromEntries(Object.entries(slots || {}).map(([level, slot]) => [
    level,
    typeof slot === "number"
      ? { max: slot, current: slot }
      : {
          max: slot.max || slot.current || 0,
          current: slot.current ?? Math.max(0, (slot.max || 0) - (slot.used || 0)),
          used: slot.used || 0,
        },
  ]));
}

function createPassiveFeatureEffects(sheet) {
  return (sheet.features || [])
    .flatMap((feature) => [
      ...(feature.effects?.modifiers || []),
      ...(feature.grants?.modifiers || []),
    ].map((modifier) => ({
      id: modifier.id || `${feature.id}_${modifier.stat}`,
      label: feature.name,
      type: "modifier",
      trigger: "passive",
      target: modifier.target || "self",
      stat: modifier.stat,
      amount: Number.isFinite(modifier.amount) ? modifier.amount : Number(modifier.value) || 0,
      die: modifier.die || null,
      mode: modifier.mode || null,
      requiresMark: structuredClone(modifier.requiresMark || null),
      ability: modifier.ability || null,
      damageType: modifier.damageType || null,
      sourceFeatureId: feature.id,
    })))
    .filter((effect) => effect.stat);
}

function createFeatureAuras(sheet) {
  return (sheet.features || [])
    .flatMap((feature) => (feature.effects?.auras || []).map((aura) => ({
      id: aura.id || `${feature.id}_aura`,
      name: aura.name || feature.name,
      radiusSquares: feetToSquares(aura.radiusFt ?? aura.radiusFeet ?? 0),
      affects: aura.affects || "self_and_allies",
      sourceFeatureId: feature.id,
      effects: normalizeAuraEffects(aura.effects || [], feature, sheet),
    })))
    .filter((aura) => aura.radiusSquares > 0 && aura.effects.length > 0);
}

function normalizeAuraEffects(effects, feature, sheet) {
  return (effects || [])
    .map((effect, index) => ({
      ...structuredClone(effect),
      id: effect.id || `${feature.id}_aura_effect_${index + 1}`,
      label: effect.label || feature.name,
      amount: resolveAuraAmount(effect, sheet),
      spellSaveDC: resolveAuraSaveDc(effect, sheet),
      sourceFeatureId: feature.id,
    }))
    .filter((effect) => effect.type && (effect.stat || effect.type !== "modifier"));
}

function resolveAuraSaveDc(effect, sheet) {
  if (effect.save?.dcFrom === "spellSaveDC") return sheet.spellcasting.spellSaveDc;
  if (effect.save?.dcFrom === "classSaveDC") return 8 + sheet.proficiencyBonus + classAbilityModifier(sheet);
  return effect.save?.dc ?? effect.spellSaveDC ?? null;
}

function resolveAuraAmount(effect, sheet) {
  if (Number.isFinite(effect.amount)) return effect.amount;
  if (Number.isFinite(effect.amountFt)) return feetToSignedSquares(effect.amountFt);
  if (effect.amountFormula) return Number(resolveFormula(effect.amountFormula, sheet)) || 0;
  return Number(effect.value) || 0;
}

function abbreviateAbilityMods(abilities) {
  return Object.fromEntries(Object.entries(abilities).map(([ability, entry]) => [
    ABILITY_ABBREVIATIONS[ability] || ability,
    entry?.modifier || 0,
  ]));
}

function createWeaponActions(sheet) {
  const weaponRecords = (sheet.equipment.weaponIds || [])
    .map((weaponId) => {
      const weapon = getWeaponById(weaponId);
      if (!weapon) return null;
      return createWeaponAction(weapon, {
        attackBonus: weaponAttackBonus(sheet, weapon),
        damageBonus: weaponDamageBonus(sheet, weapon),
        enableWeaponMastery: isWeaponMastered(sheet, weapon.id),
      });
    })
    .filter(Boolean);
  return [
    ...weaponRecords,
    ...createNickAttackActions(sheet),
  ];
}

function createNickAttackActions(sheet) {
  const weapons = (sheet.equipment.weaponIds || []).map(getWeaponById).filter(Boolean);
  const nick = weapons.find((weapon) => weapon.mastery === "nick" && (weapon.properties || []).includes("light"));
  const partner = weapons.find((weapon) => weapon.id !== nick?.id && (weapon.properties || []).includes("light"));
  if (!nick || !partner || !isWeaponMastered(sheet, nick.id)) return [];
  const action = createNickAttackAction(nick, partner, {
    id: "nick_attack",
    attackBonusByWeapon: Object.fromEntries([nick, partner].map((weapon) => [weapon.id, weaponAttackBonus(sheet, weapon)])),
    damageBonusByWeapon: Object.fromEntries([nick, partner].map((weapon) => [weapon.id, weaponDamageBonus(sheet, weapon)])),
  });
  return action ? [action] : [];
}

function isWeaponMastered(sheet, weaponId) {
  return (sheet.equipment.masteredWeaponIds || []).includes(weaponId);
}

function createSpellActions(sheet) {
  const spellIds = unique([
    ...(sheet.spellcasting.knownSpellIds || []),
    ...(sheet.spellcasting.preparedSpellIds || []),
  ]);
  return spellIds
    .map((spellId) => {
      const spell = getSpellRecordById(spellId);
      if (!spell) return null;
      return createSpellAction(spell, {
        attackBonus: sheet.spellcasting.spellAttackBonus || 0,
        spellSaveDC: sheet.spellcasting.spellSaveDc || 10,
      });
    })
    .filter(Boolean);
}

function createConsumableActions(sheet) {
  return (sheet.equipment.inventory || [])
    .map((entry) => getConsumableById(entry.id))
    .filter(Boolean)
    .map((item) => createConsumableAction(item))
    .filter(Boolean);
}

function createFeatureActions(sheet) {
  return createFeatureActionsFromFeatures(sheet.features || [], {
    resources: sheet.resources || [],
    resolveFormula: (formula) => resolveFormula(formula, sheet),
    resolveSaveDc: (option) => resolveFeatureSaveDc(option, sheet),
  });
}

function weaponAttackBonus(sheet, weapon) {
  return sheet.proficiencyBonus + weaponAbilityModifier(sheet, weapon);
}

function weaponDamageBonus(sheet, weapon) {
  return weaponAbilityModifier(sheet, weapon);
}

function weaponAbilityModifier(sheet, weapon) {
  const str = sheet.abilities.strength?.modifier || 0;
  const dex = sheet.abilities.dexterity?.modifier || 0;
  if ((weapon.properties || []).includes("finesse")) return Math.max(str, dex);
  if (weapon.type === "ranged") return dex;
  return str;
}

function abbreviateSaves(saves) {
  return Object.fromEntries(Object.entries(saves).map(([ability, value]) => [
    ABILITY_ABBREVIATIONS[ability] || ability,
    value,
  ]));
}

function resolveFormula(formula, sheet) {
  return String(formula || "")
    .replace(/\blevel\b/g, String(sheet.identity.level))
    .replace(/\bstrength_modifier\b/g, String(sheet.abilities.strength?.modifier || 0))
    .replace(/\bdexterity_modifier\b/g, String(sheet.abilities.dexterity?.modifier || 0))
    .replace(/\bconstitution_modifier\b/g, String(sheet.abilities.constitution?.modifier || 0))
    .replace(/\bintelligence_modifier\b/g, String(sheet.abilities.intelligence?.modifier || 0))
    .replace(/\bwisdom_modifier\b/g, String(sheet.abilities.wisdom?.modifier || 0))
    .replace(/\bcharisma_modifier\b/g, String(sheet.abilities.charisma?.modifier || 0))
    .replace(/\s+/g, "");
}

function resolveFeatureSaveDc(option, sheet) {
  if (option.save?.dcFrom === "spellSaveDC") return sheet.spellcasting.spellSaveDc;
  if (option.save?.dcFrom === "classSaveDC") return 8 + sheet.proficiencyBonus + classAbilityModifier(sheet);
  return option.save?.dc || option.spellSaveDC;
}

function classAbilityModifier(sheet) {
  const classId = sheet.identity.classId;
  if (["warlock", "paladin"].includes(classId)) return sheet.abilities.charisma?.modifier || 0;
  if (classId === "wizard") return sheet.abilities.intelligence?.modifier || 0;
  if (classId === "cleric") return sheet.abilities.wisdom?.modifier || 0;
  return Math.max(
    sheet.abilities.strength?.modifier || 0,
    sheet.abilities.dexterity?.modifier || 0,
    sheet.abilities.constitution?.modifier || 0,
    sheet.abilities.intelligence?.modifier || 0,
    sheet.abilities.wisdom?.modifier || 0,
    sheet.abilities.charisma?.modifier || 0
  );
}

function defaultToken(sheet) {
  return String(sheet.identity.className || sheet.identity.characterName || "P").trim().charAt(0).toUpperCase() || "P";
}

function feetToSquares(feet) {
  return Math.max(0, Math.ceil((Number(feet) || 0) / 5));
}

function feetToSignedSquares(feet) {
  const value = Number(feet) || 0;
  return Math.sign(value) * Math.ceil(Math.abs(value) / 5);
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function slug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
