import {
  createCombatObjectFromSpell,
  createEffectsFromSpell,
  getSpellDamage,
} from "./spellActionMappers.js";
import { createActionFromConsumable } from "./consumableActionMappers.js";
import { createHitPreventionAcPolicy } from "./reactionPolicy.js";

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
    tags: {
      weapon: true,
      melee: range <= 1,
      ranged: range > 1,
      attackRoll: true,
      harmful: true,
      requiresHands: true,
      ...weaponPropertyTags(weaponRecord),
    },
  });
}

export function createSpellAction(spellRecord, options = {}) {
  if (!spellRecord || spellRecord.dialogueRelated || spellRecord.hooks?.ui?.hideInCombat) return null;
  const hooks = spellRecord.hooks || {};
  const damage = getSpellDamage(spellRecord, options);
  const effects = options.effects || createEffectsFromSpell(spellRecord);
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
    return compactAction({
      ...base,
      type: "spell_auto_damage",
      requiresTarget: true,
      damage,
      damageType: hooks.damage.type || options.damageType,
      hits: hooks.darts || hooks.hits || 1,
      tags: { ...base.tags, harmful: true },
    });
  }

  if (hooks.healing) {
    const healing = options.healing || hooks.healing.dice;
    if (!healing) return null;
    return compactAction({
      ...base,
      type: "spell_self_heal",
      requiresTarget: false,
      healing,
      tags: { ...base.tags, harmful: false },
    });
  }

  if (isAreaSpell(spellRecord)) {
    if ((!damage || !hooks.damage?.type) && !effects.length) return null;
    return compactAction({
      ...base,
      type: "spell_area_save",
      requiresTarget: true,
      saveAbility: normalizeAbility(hooks.save?.ability || options.saveAbility),
      spellSaveDC: options.spellSaveDC ?? DEFAULT_SPELL_SAVE_DC,
      damage,
      damageType: hooks.damage?.type || options.damageType,
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
      damageType: hooks.damage?.type || options.damageType,
      effects,
      tags: { ...base.tags, savingThrow: true, harmful: true },
    });
  }

  if (hooks.attack) {
    if (!damage || !hooks.damage?.type) return null;
    return compactAction({
      ...base,
      type: "spell_attack",
      attackBonus: options.attackBonus ?? DEFAULT_ATTACK_BONUS,
      damage,
      damageType: hooks.damage?.type || options.damageType,
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
