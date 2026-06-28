import {
  createCombatObjectFromSpell,
  createEffectsFromSpell,
  createSpellActionExtras,
  getSpellDamage,
} from "./spellActionMappers.js";
import { createActionFromConsumable } from "./consumableActionMappers.js";
import { createHitPreventionAcPolicy } from "./reactionPolicy.js";
import { getWeaponMastery } from "../data/weaponMasteries.js";
import { createWeaponMasteryEffects } from "./weaponMasteryActionMappers.js";

const DEFAULT_SPELL_SAVE_DC = 10;
const DEFAULT_ATTACK_BONUS = 0;

export function createWeaponAction(weaponRecord, options = {}) {
  if (!weaponRecord || weaponRecord.useTime === "exploration") return null;
  const baseDamageType = options.damageType || inferWeaponDamageType(weaponRecord);
  const flatUntypedBonus = getFlatUntypedWeaponDamageBonus(weaponRecord);
  const damageBonus = (options.damageBonus ?? 0) + flatUntypedBonus;
  const damage = options.damage || addDamageBonus(weaponRecord.damage, damageBonus);
  const range = options.range ?? getWeaponRangeSquares(weaponRecord);
  const damageRiders = createWeaponDamageRiders(weaponRecord, baseDamageType);
  const mastery = getWeaponMastery(weaponRecord.mastery);
  const masteryActive = mastery && options.enableWeaponMastery !== false;
  const masteryEffects = !masteryActive
    ? []
    : createWeaponMasteryEffects(weaponRecord, mastery);
  const effects = [
    ...(options.effects || []),
    ...masteryEffects,
  ];

  return compactAction({
    id: options.id || weaponRecord.id,
    name: options.name || weaponRecord.name,
    type: "weapon_attack",
    cost: mapUseTimeToCost(options.cost || weaponRecord.useTime),
    range,
    attackBonus: options.attackBonus ?? DEFAULT_ATTACK_BONUS,
    damage,
    damageType: baseDamageType,
    damageRiders,
    weaponMastery: mastery ? mastery.id : null,
    weaponMasteryName: mastery ? mastery.name : null,
    weaponMasteryImplementation: mastery ? mastery.implementation : null,
    weaponMasteryActive: masteryActive ? true : null,
    effects: effects.length ? effects : null,
    tags: {
      weapon: true,
      melee: range <= 1,
      ranged: range > 1,
      attackRoll: true,
      harmful: true,
      requiresHands: true,
      weaponMastery: Boolean(mastery),
      ...(mastery ? { [`mastery_${mastery.id}`]: true } : {}),
      ...weaponPropertyTags(weaponRecord),
    },
  });
}

export function createNickAttackAction(primaryWeapon, secondaryWeapon, options = {}) {
  if (!primaryWeapon || !secondaryWeapon) return null;
  const nickWeapon = primaryWeapon.mastery === "nick" ? primaryWeapon : secondaryWeapon;
  if (!isLightWeapon(primaryWeapon) || !isLightWeapon(secondaryWeapon) || !nickWeapon) return null;

  const primaryAction = createWeaponAction(primaryWeapon, {
    ...options,
    id: `${options.id || "nick_attack"}_primary`,
    name: primaryWeapon.name,
    attackBonus: options.attackBonusByWeapon?.[primaryWeapon.id] ?? options.attackBonus,
    damageBonus: options.damageBonusByWeapon?.[primaryWeapon.id] ?? options.damageBonus,
    enableWeaponMastery: false,
  });
  const secondaryAction = createWeaponAction(secondaryWeapon, {
    ...options,
    id: `${options.id || "nick_attack"}_secondary`,
    name: secondaryWeapon.name,
    attackBonus: options.attackBonusByWeapon?.[secondaryWeapon.id] ?? options.attackBonus,
    damageBonus: options.damageBonusByWeapon?.[secondaryWeapon.id] ?? options.damageBonus,
    enableWeaponMastery: false,
  });
  if (!primaryAction || !secondaryAction) return null;

  return compactAction({
    id: options.id || `nick_attack_${primaryWeapon.id}_${secondaryWeapon.id}`,
    name: options.name || "Nick Attack",
    type: "compound_weapon_attack",
    cost: "action",
    requiresTarget: true,
    weaponMastery: "nick",
    weaponMasteryName: "Nick",
    weaponMasteryImplementation: "automatic",
    weaponMasteryActive: true,
    tags: {
      weapon: true,
      attackRoll: true,
      harmful: true,
      requiresHands: true,
      weaponMastery: true,
      mastery_nick: true,
    },
    attacks: [
      primaryAction,
      secondaryAction,
    ],
  });
}

export function createNaturalWeaponAction(naturalAttack, options = {}) {
  if (!naturalAttack) return null;
  const range = options.range ?? naturalAttack.range ?? 1;
  return compactAction({
    id: options.id || naturalAttack.id,
    name: options.name || naturalAttack.name,
    type: "weapon_attack",
    cost: mapUseTimeToCost(options.cost || naturalAttack.useTime || "action"),
    range,
    attackBonus: options.attackBonus ?? DEFAULT_ATTACK_BONUS,
    damage: options.damage || naturalAttack.damage,
    damageType: options.damageType || naturalAttack.damageType,
    effects: options.effects || naturalAttack.effects || null,
    tags: {
      weapon: false,
      natural: true,
      melee: range <= 1,
      ranged: range > 1,
      attackRoll: true,
      harmful: true,
      ...(naturalAttack.tags || {}),
    },
  });
}

export function createSpellAction(spellRecord, options = {}) {
  if (!spellRecord || spellRecord.hooks?.ui?.hideInCombat) return null;
  if (spellRecord.dialogueRelated && !hasCombatSpellHooks(spellRecord)) return null;
  const hooks = spellRecord.hooks || {};
  const damage = getSpellDamage(spellRecord, options);
  const damageType = resolveSpellDamageType(hooks.damage, options);
  const damageTypeChoices = spellDamageTypeChoices(hooks.damage);
  const effects = options.effects || createEffectsFromSpell(spellRecord, options);
  const spellExtras = createSpellActionExtras(spellRecord, options);
  const combatObject = createCombatObjectFromSpell(spellRecord);
  const teleport = createTeleportActionFromSpell(spellRecord);
  const harmful = Boolean(
    hooks.attack ||
    hooks.save ||
    hooks.autoHit ||
    (spellRecord.area?.shape && spellRecord.area.shape !== "none") ||
    spellRecord.target?.friendly === false
  );
  const base = {
    id: options.id || spellRecord.id,
    name: options.name || spellRecord.name,
    cost: mapCastingToCost(spellRecord.casting),
    range: getSpellRangeSquares(spellRecord),
    maxTargets: spellTargetCount(spellRecord, options),
    description: describeSpell(spellRecord),
    concentration: spellRecord.concentration === true,
    sourceSpellId: spellRecord.id,
    spellLevel: spellRecord.level,
    reactionPolicy: createReactionPolicyFromSpell(spellRecord),
    requiresSight: spellRecord.target?.requiresSight === true,
    requiresSpeech: spellRecord.components?.v === true,
    requiresHands: spellRecord.components?.s === true,
    tags: {
      spell: true,
      harmful,
      requiresSight: spellRecord.target?.requiresSight === true,
      requiresSpeech: spellRecord.components?.v === true,
      requiresHands: spellRecord.components?.s === true,
    },
  };

  if (combatObject) {
    return compactAction({
      ...base,
      type: "spell_object",
      requiresTarget: true,
      object: combatObject,
      spellSaveDC: options.spellSaveDC ?? DEFAULT_SPELL_SAVE_DC,
      targeting: combatObject.placement === "cell_path" ? createCellPathTargeting(combatObject) : createTargetingFromArea(spellRecord.area),
      tags: { ...base.tags, harmful: false },
    });
  }

  if (teleport) {
    return compactAction({
      ...base,
      ...teleport,
      tags: { ...base.tags, harmful: false },
    });
  }

  if (hooks.autoHit) {
    if (!damage || !hooks.damage?.type) return null;
    const hits = hooks.darts || hooks.hits || 1;
    return compactAction({
      ...base,
      type: "spell_auto_damage",
      requiresTarget: true,
      damage,
      damageType,
      damageTypeChoices,
      hits,
      maxTargets: Math.max(base.maxTargets || 1, hits),
      targetAssignments: hits > 1 ? "per_hit" : null,
      allowRepeatedTargets: hits > 1,
      requireExactTargetCount: hits > 1,
      tags: { ...base.tags, harmful: true },
    });
  }

  if (hooks.healing) {
    const healing = options.healing || hooks.healing.dice;
    if (!healing) return null;
    const requiresTarget = spellRecord.target?.type !== "self";
    return compactAction({
      ...base,
      type: "spell_self_heal",
      requiresTarget,
      healing,
      tags: { ...base.tags, harmful: false },
    });
  }

  if (isAreaSpell(spellRecord)) {
    if ((!damage || !hooks.damage?.type) && !effects.length) return null;
    return compactAction({
      ...base,
      type: "spell_area_save",
      requiresTarget: spellExtras.selfCenteredArea ? false : true,
      saveAbility: normalizeAbility(hooks.save?.ability || options.saveAbility),
      spellSaveDC: options.spellSaveDC ?? DEFAULT_SPELL_SAVE_DC,
      damage,
      damageType,
      damageTypeChoices,
      ...spellExtras,
      effects,
      targeting: createTargetingFromArea(spellRecord.area),
      tags: { ...base.tags, savingThrow: true, harmful: true },
    });
  }

  if (hooks.save) {
    if ((!damage || !hooks.damage?.type) && !effects.length) return null;
    return compactAction({
      ...base,
      type: "spell_save",
      saveAbility: normalizeAbility(hooks.save.ability || options.saveAbility),
      spellSaveDC: options.spellSaveDC ?? DEFAULT_SPELL_SAVE_DC,
      damage,
      damageType,
      damageTypeChoices,
      ...spellExtras,
      effects,
      tags: { ...base.tags, savingThrow: true, harmful: true },
    });
  }

  if (hooks.attack) {
    if (!damage || !hooks.damage?.type) return null;
    const repeatAttacks = spellExtras.repeatAttacks || 1;
    return compactAction({
      ...base,
      type: "spell_attack",
      attackBonus: options.attackBonus ?? DEFAULT_ATTACK_BONUS,
      damage,
      damageType,
      damageTypeChoices,
      ...spellExtras,
      maxTargets: Math.max(base.maxTargets || 1, repeatAttacks),
      targetAssignments: repeatAttacks > 1 ? "per_hit" : null,
      allowRepeatedTargets: repeatAttacks > 1,
      requireExactTargetCount: repeatAttacks > 1,
      effects: effects.map((effect) => ({ ...effect, trigger: "hit" })),
      tags: { ...base.tags, attackRoll: true, ranged: base.range > 1, melee: base.range <= 1, harmful: true },
    });
  }

  if (effects.length) {
    return compactAction({
      ...base,
      type: "spell_effect",
      requiresTarget: spellRecord.target?.type !== "self",
      spellSaveDC: options.spellSaveDC ?? DEFAULT_SPELL_SAVE_DC,
      ...spellExtras,
      effects: effects.map((effect) => ({
        ...effect,
        trigger: "action_resolved",
        target: spellRecord.target?.type === "self" ? "self" : effect.target,
      })),
      tags: { ...base.tags, harmful },
    });
  }

  return null;
}

function spellTargetCount(spellRecord, options = {}) {
  const repeatAttacks = repeatAttacksFromEffect(spellRecord?.hooks?.applyEffect, options.casterLevel);
  if (repeatAttacks > 1) return repeatAttacks;
  const hits = spellRecord?.hooks?.autoHit ? (spellRecord.hooks.darts || spellRecord.hooks.hits || 1) : 1;
  if (hits > 1) return hits;
  const count = Number(spellRecord?.target?.count);
  return Number.isFinite(count) && count > 1 && spellRecord?.area?.shape === "none" ? count : null;
}

function repeatAttacksFromEffect(applyEffect, casterLevel = 1) {
  if (String(applyEffect?.kind || "").toLowerCase() !== "multi_beam") return 1;
  return valueByLevel(applyEffect.beamsByLevel, casterLevel) || 1;
}

function valueByLevel(values, casterLevel = 1) {
  if (!values || typeof values !== "object") return null;
  const level = Number(casterLevel) || 1;
  return Object.entries(values)
    .map(([required, value]) => [Number(required), Number(value)])
    .filter(([required, value]) => Number.isFinite(required) && Number.isFinite(value) && required <= level)
    .sort((a, b) => b[0] - a[0])[0]?.[1] || null;
}

function hasCombatSpellHooks(spellRecord) {
  const hooks = spellRecord?.hooks || {};
  return Boolean(hooks.attack || hooks.save || hooks.damage || hooks.healing || hooks.autoHit);
}

function resolveSpellDamageType(damageHook, options = {}) {
  if (options.damageType) return options.damageType;
  if (damageHook?.type && damageHook.type !== "choice") return damageHook.type;
  return damageHook?.choices?.[0] || damageHook?.type || null;
}

function spellDamageTypeChoices(damageHook) {
  if (damageHook?.type !== "choice" || !Array.isArray(damageHook.choices)) return null;
  return [...damageHook.choices];
}

function createReactionPolicyFromSpell(spellRecord) {
  const effect = spellRecord?.hooks?.applyEffect;
  if (spellRecord?.id !== "shield" || effect?.kind !== "shield_reaction") return null;
  return createHitPreventionAcPolicy({
    id: spellRecord.id,
    minimumSlotLevel: spellRecord.level || 1,
    acBonus: effect.acBonus || 5,
    priority: 80,
  });
}

export function createConsumableAction(consumableRecord, options = {}) {
  return compactAction(createActionFromConsumable(consumableRecord, options));
}

export function indexRecordsById(records) {
  return Object.fromEntries((records || []).filter((record) => record?.id).map((record) => [record.id, record]));
}

function createTargetingFromArea(area = {}) {
  const shape = area.shape;
  if (shape === "line") {
    return {
      shape: "line",
      lengthSquares: feetToSquares(area.length || area.size),
      lengthFt: area.length || area.size,
    };
  }
  if (shape === "cone") {
    return {
      shape: "cone",
      lengthSquares: feetToSquares(area.length || area.size),
      lengthFt: area.length || area.size,
    };
  }
  if (shape === "cube") {
    return {
      shape: "cube",
      sizeSquares: feetToSquares(area.size || area.width),
      sizeFt: area.size || area.width,
    };
  }
  return {
    shape: "radius",
    radiusSquares: feetToSquares(area.size || area.width || area.length),
    radiusFt: area.size || area.width || area.length,
  };
}

function createCellPathTargeting(object) {
  return {
    shape: "cell_path",
    maxCells: object.lengthSquares || 10,
    minCells: 1,
  };
}

function createTeleportActionFromSpell(spellRecord) {
  const payload = spellRecord.hooks?.applyEffect;
  if (String(payload?.kind || "").toLowerCase() !== "teleport") return null;
  const rangeFt = payload.distanceFt || spellRecord.range?.distance || 30;
  return {
    type: "spell_teleport",
    requiresTarget: true,
    range: feetToSquares(rangeFt),
    targeting: {
      shape: "radius",
      radiusSquares: feetToSquares(rangeFt),
      radiusFt: rangeFt,
    },
  };
}

function isAreaSpell(spellRecord) {
  return spellRecord.area?.shape && spellRecord.area.shape !== "none";
}

function getSpellRangeSquares(spellRecord) {
  if (spellRecord.range?.type === "self") return 0;
  if (spellRecord.range?.type === "touch") return 1;
  return feetToSquares(spellRecord.range?.distance || 0);
}

function getWeaponRangeSquares(weaponRecord) {
  if (weaponRecord.type === "melee") return 1;
  const rangeProperty = (weaponRecord.properties || []).find((property) => /^range \(/i.test(property));
  const match = rangeProperty?.match(/range \((\d+)\//i);
  return feetToSquares(match ? Number(match[1]) : 5);
}

function inferWeaponDamageType(weaponRecord) {
  const id = `${weaponRecord.id || ""} ${weaponRecord.name || ""}`.toLowerCase();
  if (id.includes("bow") || id.includes("dagger") || id.includes("rapier")) return "piercing";
  if (id.includes("hammer") || id.includes("staff")) return "bludgeoning";
  if (id.includes("axe") || id.includes("sword") || id.includes("scimitar")) return "slashing";
  return "bludgeoning";
}

function weaponPropertyTags(weaponRecord) {
  const tags = Object.fromEntries((weaponRecord.properties || []).map((property) => [propertyTag(property), true]));
  if (tags.two_handed || tags.versatile) tags.two_handed_or_versatile = true;
  return tags;
}

function isLightWeapon(weaponRecord) {
  return (weaponRecord.properties || []).includes("light");
}

function propertyTag(property) {
  return String(property || "").replace(/-/g, "_");
}

function getFlatUntypedWeaponDamageBonus(weaponRecord) {
  return (weaponRecord.modifiers?.damageBonuses || []).reduce((total, bonus) => {
    if (typeof bonus?.amount !== "number" || bonus.type) return total;
    return total + bonus.amount;
  }, 0);
}

function createWeaponDamageRiders(weaponRecord, baseDamageType) {
  const riders = (weaponRecord.modifiers?.damageBonuses || [])
    .filter((bonus) => bonus && (bonus.type || typeof bonus.amount !== "number"))
    .map((bonus, index) => ({
      id: `${weaponRecord.id || "weapon"}_damage_bonus_${index + 1}`,
      name: bonus.type ? `${weaponRecord.name} ${bonus.type} bonus` : `${weaponRecord.name} damage bonus`,
      trigger: "source_hits_with_attack_roll",
      damage: bonus.amount,
      damageType: bonus.type || baseDamageType,
    }));
  return riders.length ? riders : null;
}

function addDamageBonus(damage, bonus) {
  if (!bonus) return damage;
  return `${damage}${bonus > 0 ? "+" : ""}${bonus}`;
}

function parseHealingDice(effect = "") {
  const match = effect.match(/(\d+d\d+(?:\s*[+-]\s*\d+)?)\s*HP/i);
  return match ? match[1].replace(/\s+/g, "") : null;
}

function mapCastingToCost(casting = {}) {
  return mapUseTimeToCost(casting.unit);
}

function mapUseTimeToCost(useTime = "action") {
  if (useTime === "bonus_action" || useTime === "bonus") return "bonus";
  if (useTime === "reaction") return "reaction";
  if (useTime === "free") return "movement";
  return "action";
}

function describeSpell(spellRecord) {
  const parts = [
    `${spellRecord.name}`,
    spellRecord.concentration ? "CONCENTRATION" : null,
    spellRecord.level === 0 ? "Cantrip" : `Level ${spellRecord.level}`,
    spellRecord.school,
    spellRecord.source,
    spellRecord.text,
  ].filter(Boolean);
  return parts.join(" | ");
}

function normalizeAbility(ability) {
  return ability ? String(ability).toLowerCase().slice(0, 3) : null;
}

function feetToSquares(feet) {
  return Math.max(0, Math.ceil((Number(feet) || 0) / 5));
}

function compactAction(action) {
  return Object.fromEntries(Object.entries(action).filter(([, value]) => value !== null && value !== undefined));
}
