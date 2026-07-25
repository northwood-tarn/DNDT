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
  if (!weaponRecord) return null;
  const baseDamageType = options.damageType || weaponRecord.damageType || inferWeaponDamageType(weaponRecord);
  const enhancementBonus = weaponRecord.enhancementBonus || weaponRecord.modifiers?.enhancementBonus || 0;
  const flatUntypedBonus = getFlatUntypedWeaponDamageBonus(weaponRecord);
  const damageBonus = (options.damageBonus ?? 0) + enhancementBonus + flatUntypedBonus;
  const damage = options.damage || addDamageBonus(weaponRecord.damageFormula || weaponRecord.damage, damageBonus);
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
    cost: mapUseTimeToCost(options.cost || weaponRecord.actionCost || weaponRecord.useTime || "action"),
    range,
    attackBonus: (options.attackBonus ?? DEFAULT_ATTACK_BONUS) + enhancementBonus,
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
  const damage = addSpellcastingModifier(getSpellDamage(spellRecord, options), spellRecord.hooks?.damage, options);
  const damageType = resolveSpellDamageType(hooks.damage, options);
  const damageTypeChoices = spellDamageTypeChoices(hooks.damage);
  const effects = options.effects || createEffectsFromSpell(spellRecord, options);
  const spellExtras = createSpellActionExtras(spellRecord, options);
  const combatObject = createCombatObjectFromSpell(spellRecord, options);
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
    description: spellRecord.text,
    concentration: spellRecord.concentration === true,
    sourceSpellId: spellRecord.id,
    spellLevel: options.slotLevel ?? spellRecord.level,
    baseSpellLevel: spellRecord.level,
    lanternaOilCost: hooks.costs?.lanternaOil || null,
    saveOnSuccess: hooks.save?.onSave || null,
    usesExactSpellSlot: options.usesExactSpellSlot === true,
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

  if (hooks.postHitSmite) {
    return finalizeSpellAction(compactAction({
      ...base,
      type: "spell_post_hit",
      requiresTarget: true,
      range: 1,
      damage,
      damageType,
      postHitOnly: true,
      postHitActionTags: [...(hooks.postHitSmite.actionTags || ["melee", "weapon"])],
      postHitRequiresAnyActionTag: [...(hooks.postHitSmite.requiresAnyActionTag || [])],
      bonusAgainstCreatureTypes: [...(hooks.postHitSmite.bonusAgainstCreatureTypes || [])],
      bonusDamage: hooks.postHitSmite.bonusDamage || null,
      allowDefeatedTarget: false,
      tags: { ...base.tags, harmful: true },
    }), spellRecord);
  }

  if (combatObject) {
    return finalizeSpellAction(compactAction({
      ...base,
      type: "spell_object",
      requiresTarget: true,
      object: combatObject,
      ...spellExtras,
      spellSaveDC: options.spellSaveDC ?? DEFAULT_SPELL_SAVE_DC,
      targeting: combatObject.placement === "cell_path" ? createCellPathTargeting(combatObject) : createTargetingFromArea(spellRecord.area),
      tags: { ...base.tags, harmful },
    }), spellRecord);
  }

  if (teleport) {
    return finalizeSpellAction(compactAction({
      ...base,
      ...teleport,
      tags: { ...base.tags, harmful: false },
    }), spellRecord);
  }

  if (hooks.autoHit) {
    if (!damage || !hooks.damage?.type) return null;
    const hits = scaledSpellHitCount(spellRecord, hooks.darts || hooks.hits || 1, options.slotLevel);
    return finalizeSpellAction(compactAction({
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
    }), spellRecord);
  }

  if (hooks.healing) {
    const healing = addSpellcastingModifier(
      scaleSpellFormulaForSlot(options.healing || hooks.healing.dice, spellRecord, options.slotLevel),
      hooks.healing,
      options
    );
    if (!healing) return null;
    const requiresTarget = spellRecord.target?.type !== "self";
    return finalizeSpellAction(compactAction({
      ...base,
      type: "spell_self_heal",
      requiresTarget,
      healing,
      effects,
      tags: { ...base.tags, harmful: false },
    }), spellRecord);
  }

  if (isAreaSpell(spellRecord)) {
    if ((!damage || !hooks.damage?.type) && !effects.length) return null;
    return finalizeSpellAction(compactAction({
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
    }), spellRecord);
  }

  if (hooks.save) {
    if ((!damage || !hooks.damage?.type) && !effects.length) return null;
    return finalizeSpellAction(compactAction({
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
    }), spellRecord);
  }

  if (hooks.attack) {
    if (!damage || !hooks.damage?.type) return null;
    const repeatAttacks = spellExtras.repeatAttacks || 1;
    return finalizeSpellAction(compactAction({
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
    }), spellRecord);
  }

  if (effects.length) {
    return finalizeSpellAction(compactAction({
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
    }), spellRecord);
  }

  return null;
}

function scaleSpellFormulaForSlot(formula, spellRecord, slotLevel) {
  if (!formula || spellRecord.scaling?.type !== "slot") return formula;
  const levelsAbove = Math.max(0, Number(slotLevel ?? spellRecord.level) - spellRecord.level);
  if (!levelsAbove) return formula;
  const text = spellRecord.scaling?.slot?.text || "";
  const flatTempHp = text.match(/\+(\d+)\s+temp(?:orary)?\s+hp.*per slot/i);
  if (flatTempHp) return addFlatBonus(formula, Number(flatTempHp[1]) * levelsAbove);
  const flatMatch = text.match(/\+(\d+) (?:healing|hit points?).*per slot level above/i);
  if (flatMatch && /^\d+$/.test(String(formula))) return String(Number(formula) + Number(flatMatch[1]) * levelsAbove);
  const match = text.match(/\+(\d*)d(\d+).*per slot(?: level)? above/i);
  if (!match) return formula;
  return addDamageDice(formula, Number(match[1] || 1) * levelsAbove, Number(match[2]));
}

function addFlatBonus(formula, amount) {
  const match = String(formula).match(/^(.*?)([+-]\d+)?$/);
  if (!match) return formula;
  const total = Number(match[2] || 0) + amount;
  return `${match[1]}${total > 0 ? "+" : ""}${total || ""}`;
}

function addSpellcastingModifier(formula, hook, options) {
  if (!formula || !(hook?.addMod === true || hook?.modFrom === "spellcasting")) return formula;
  const modifier = Number(options.spellcastingModifier) || 0;
  if (!modifier) return formula;
  return `${formula}${modifier > 0 ? "+" : ""}${modifier}`;
}

function addDamageDice(formula, addedCount, sides) {
  const match = String(formula).match(/^(\d+)d(\d+)(.*)$/i);
  if (!match || Number(match[2]) !== sides) return formula;
  return `${Number(match[1]) + addedCount}d${sides}${match[3]}`;
}

function spellTargetCount(spellRecord, options = {}) {
  const repeatAttacks = repeatAttacksFromEffect(spellRecord?.hooks?.applyEffect, options.casterLevel);
  if (repeatAttacks > 1) return repeatAttacks;
  const hits = spellRecord?.hooks?.autoHit ? (spellRecord.hooks.darts || spellRecord.hooks.hits || 1) : 1;
  if (hits > 1) return hits;
  const count = scaledSpellTargetCount(spellRecord, Number(spellRecord?.target?.count), options.slotLevel);
  return Number.isFinite(count) && count > 1 && spellRecord?.area?.shape === "none" ? count : null;
}

function scaledSpellHitCount(spellRecord, base, slotLevel) {
  const levelsAbove = Math.max(0, Number(slotLevel ?? spellRecord.level) - spellRecord.level);
  return /\+1 dart per slot/i.test(spellRecord.scaling?.slot?.text || "") ? base + levelsAbove : base;
}

function scaledSpellTargetCount(spellRecord, base, slotLevel) {
  if (!Number.isFinite(base)) return base;
  const levelsAbove = Math.max(0, Number(slotLevel ?? spellRecord.level) - spellRecord.level);
  return /(?:affect|target) \+1 creature per slot/i.test(spellRecord.scaling?.slot?.text || "") ? base + levelsAbove : base;
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
  if (Number.isFinite(weaponRecord.range)) return weaponRecord.range;
  if ((weaponRecord.weaponType || weaponRecord.type) === "melee") return 1;
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
  return (weaponRecord.damageBonuses || weaponRecord.modifiers?.damageBonuses || []).reduce((total, bonus) => {
    const amount = bonus.damage ?? bonus.amount;
    const damageType = bonus.damageType ?? bonus.type;
    if (typeof amount !== "number" || damageType) return total;
    return total + amount;
  }, 0);
}

function createWeaponDamageRiders(weaponRecord, baseDamageType) {
  const riders = (weaponRecord.damageBonuses || weaponRecord.modifiers?.damageBonuses || [])
    .map((bonus) => ({
      damage: bonus.damage ?? bonus.amount,
      damageFormula: bonus.damageFormula,
      damageType: bonus.damageType ?? bonus.type,
    }))
    .filter((bonus) => bonus && (bonus.damageType || bonus.damageFormula || typeof bonus.damage !== "number"))
    .map((bonus, index) => ({
      id: `${weaponRecord.id || "weapon"}_damage_bonus_${index + 1}`,
      name: bonus.damageType ? `${weaponRecord.name} ${bonus.damageType} bonus` : `${weaponRecord.name} damage bonus`,
      trigger: "source_hits_with_attack_roll",
      damage: bonus.damageFormula ?? bonus.damage,
      damageType: bonus.damageType || baseDamageType,
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

function finalizeSpellAction(action, spellRecord) {
  action.description = describeCompiledSpellAction(action, spellRecord);
  return action;
}

function describeCompiledSpellAction(action, spellRecord) {
  let description = String(spellRecord.text || spellRecord.name || "").trim();
  if (!(action.spellLevel > action.baseSpellLevel)) return description;

  const baseDamage = spellRecord.hooks?.damage?.dice || nestedBaseDamage(spellRecord.hooks?.applyEffect);
  const compiledDamage = action.damage || nestedCompiledDamage(action);
  if (baseDamage && compiledDamage && compiledDamage !== baseDamage) {
    const withModifier = new RegExp(`${escapeRegExp(baseDamage)}\\s*(?:\\+|plus)\\s*(?:your\\s+)?spellcasting ability modifier`, "gi");
    if (withModifier.test(description)) description = description.replace(withModifier, compiledDamage);
    else description = replaceAllLiteral(description, baseDamage, compiledDamage);
  }

  const baseHealing = spellRecord.hooks?.healing?.dice;
  if (baseHealing && action.healing) {
    const withModifier = new RegExp(`${escapeRegExp(baseHealing)}\\s*(?:\\+|plus)\\s*(?:your\\s+)?spellcasting ability modifier`, "gi");
    if (withModifier.test(description)) description = description.replace(withModifier, action.healing);
    else if (action.healing !== baseHealing) description = replaceAllLiteral(description, baseHealing, action.healing);
  }

  const scaledNoun = scalingCountNoun(spellRecord.scaling?.slot?.text);
  const scaledCount = scaledNoun === "dart" ? action.hits : action.maxTargets;
  if (scaledNoun && Number.isFinite(scaledCount)) {
    const replaced = scaledNoun === "dart"
      ? replaceCountBeforeNoun(description, scaledNoun, scaledCount)
      : replaceUpToCreatureCount(description, scaledCount);
    description = replaced === description
      ? `Targets: ${numberWord(scaledCount)} ${scaledCount === 1 ? scaledNoun : `${scaledNoun}s`}. ${description}`
      : replaced;
  }

  const tempHp = (action.effects || []).find((effect) => effect.type === "temp_hp" && Number.isFinite(effect.amount));
  if (tempHp) description = description.replace(/\b\d+\s+temporary hit points?/i, (match) => match.replace(/\d+/, String(tempHp.amount)));
  const retaliation = (action.effects || []).find((effect) => effect.damageRetaliation?.damage)?.damageRetaliation;
  if (retaliation) description = description.replace(/\b\d+\s+cold damage\b/i, `${retaliation.damage} cold damage`);
  const maxHp = (action.effects || []).find((effect) => effect.type === "max_hp_bonus" && Number.isFinite(effect.amount));
  if (maxHp) description = description.replace(/\bincrease by \d+\b/i, `increase by ${maxHp.amount}`);
  const dispel = (action.effects || []).find((effect) => effect.type === "dispel_magic");
  if (Number.isFinite(dispel?.maximumAutomaticSpellLevel)) {
    description = description.replace(/Spells of \d+(?:st|nd|rd|th) level or lower/i, `Spells of ${ordinal(dispel.maximumAutomaticSpellLevel)} level or lower`);
  }

  return `Cast using a level ${action.spellLevel} slot. ${description}`;
}

function nestedBaseDamage(payload) {
  return payload?.damage?.dice || payload?.ticks?.find((tick) => tick.damage?.dice)?.damage?.dice || null;
}

function nestedCompiledDamage(action) {
  return action.object?.effects?.find((effect) => effect.damage)?.damage
    || action.effects?.find((effect) => effect.action?.damage)?.action?.damage
    || null;
}

function replaceUpToCreatureCount(text, count) {
  const pattern = /\bup to (\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve) creatures\b/i;
  return text.replace(pattern, `up to ${numberWord(count)} creatures`);
}

function ordinal(value) {
  const mod100 = value % 100;
  const suffix = mod100 >= 11 && mod100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[value % 10] || "th");
  return `${value}${suffix}`;
}

function scalingCountNoun(text = "") {
  const match = String(text).match(/\+1\s+(dart|creature|target)\b/i);
  return match ? match[1].toLowerCase() : null;
}

function replaceCountBeforeNoun(text, noun, count) {
  const number = numberWord(count);
  const plural = count === 1 ? noun : `${noun}s`;
  const pattern = new RegExp(`\\b(\\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\\s+${noun}s?\\b`, "i");
  return text.replace(pattern, `${number} ${plural}`);
}

function numberWord(value) {
  return ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"][value] || String(value);
}

function replaceAllLiteral(text, from, to) {
  return text.replace(new RegExp(escapeRegExp(from), "gi"), to);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeAbility(ability) {
  return ability ? String(ability).toLowerCase().slice(0, 3) : null;
}

function feetToSquares(feet) {
  return Math.max(0, Math.ceil((Number(feet) || 0) / 5));
}

function compactAction(action) {
  if (!action) return null;
  return Object.fromEntries(Object.entries(action).filter(([, value]) => value !== null && value !== undefined));
}
