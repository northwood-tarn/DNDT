import { getConditionRules } from "./effects.js";
import { ignoresDamageResistance } from "./featureHooks.js";
import { rollDamageReduction } from "./modifiers.js";
import { combatAuraEffectsAffectingActor } from "./auras.js";

export function resolveDamageAmount(source, target, action, rolledDamage, baseAmount = rolledDamage?.total || 0, snapshot = null, dice = null) {
  const damageType = action?.damageType || action?.collisionDamageType || "untyped";
  const modifiers = collectDamageModifiers(target, damageType, snapshot);
  let amount = Math.max(0, baseAmount);

  const bypassResistance = ignoresDamageResistance(source, action, damageType);
  if (bypassResistance && modifiers.resistant.length) {
    modifiers.ignoredResistance = [...modifiers.resistant];
    modifiers.resistant = [];
  }

  if (modifiers.immune.length) {
    amount = 0;
  } else {
    if (modifiers.resistant.length) amount = Math.floor(amount / 2);
    if (modifiers.vulnerable.length) amount *= 2;
  }

  const reduction = rollDamageReduction(snapshot, target, damageType, dice);
  if (reduction.total > 0 && amount > 0) {
    amount = Math.max(0, amount - reduction.total);
    modifiers.reduced = reduction.reasons;
  }

  return {
    sourceId: source?.id || null,
    targetId: target?.id || null,
    damageType,
    originalAmount: Math.max(0, baseAmount),
    amount,
    modifiers,
  };
}

function collectDamageModifiers(target, damageType, snapshot) {
  const modifiers = {
    resistant: [],
    immune: [],
    vulnerable: [],
  };

  for (const condition of target?.conditions || []) {
    const id = conditionId(condition);
    const rules = getConditionRules(id);
    if (matchesDamageType(rules.resistance, damageType)) modifiers.resistant.push(id);
    if (matchesDamageType(rules.immune, damageType)) modifiers.immune.push(id);
    if (matchesDamageType(rules.vulnerability, damageType)) modifiers.vulnerable.push(id);
  }

  if (matchesDamageType(target?.resistance, damageType)) modifiers.resistant.push("actor");
  if (matchesDamageType(target?.resistances, damageType)) modifiers.resistant.push("actor");
  if (matchesDamageType(target?.immune, damageType)) modifiers.immune.push("actor");
  if (matchesDamageType(target?.immunities, damageType)) modifiers.immune.push("actor");
  if (matchesDamageType(target?.vulnerability, damageType)) modifiers.vulnerable.push("actor");
  for (const effect of combatAuraEffectsAffectingActor(snapshot, target)) {
    if (effect.type === "damage_resistance" && matchesDamageType(effect.damageTypes, damageType)) {
      modifiers.resistant.push(effect.label || effect.auraId || "aura");
    }
  }

  return modifiers;
}

function matchesDamageType(types, damageType) {
  if (!Array.isArray(types)) return false;
  return types.includes("all") || types.includes(damageType);
}

function conditionId(condition) {
  return typeof condition === "string" ? condition : condition?.id;
}
