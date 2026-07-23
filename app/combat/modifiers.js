import { combatAuraEffectsAffectingActor } from "./auras.js";
import { combatObjectsAffectingActor } from "./combatObjects.js";
import { getConditionRules } from "./effects.js";
import { getActorFeatureHooks } from "./featureHooks.js";
import { targetHasRequiredMark } from "./marks.js";

export function normalizeActiveEffects(effects = []) {
  return (Array.isArray(effects) ? effects : []).map((effect, index) => ({
    id: effect.id || `effect_${index + 1}`,
    label: effect.label || effect.name || effect.stat || effect.type || `Effect ${index + 1}`,
    trigger: effect.trigger || "passive",
    target: effect.target || "target",
    ...structuredClone(effect),
  }));
}

export function getEffectiveSpeed(snapshot, actor) {
  const base = actor?.speed ?? 0;
  const modifier = sumStaticModifiers(collectModifierDetails(snapshot, actor, "speed"));
  const multiplier = (actor?.conditions || []).reduce((value, condition) => (
    value * (Number.isFinite(getConditionRules(condition.id).speedMultiplier) ? getConditionRules(condition.id).speedMultiplier : 1)
  ), 1);
  return Math.max(0, Math.floor((base + modifier) * multiplier));
}

export function getEffectiveAc(snapshot, actor, context = {}) {
  const base = actor?.ac ?? 0;
  const modifier = sumStaticModifiers(collectModifierDetails(snapshot, actor, "ac", context));
  const formulas = collectModifierDetails(snapshot, actor, "ac_formula", context);
  const formulaAc = formulas.reduce((best, formula) => Math.max(best, resolveAcFormula(actor, formula)), 0);
  return Math.max(0, base + modifier, formulaAc);
}

export function rollAttackModifier(snapshot, actor, target, action, dice) {
  const outgoing = collectModifierDetails(snapshot, actor, "attack_roll", { action, target });
  const incoming = collectModifierDetails(snapshot, target, "incoming_attack_roll", { action, source: actor });
  return rollModifierDetails([...outgoing, ...incoming], dice, action?.name || "attack");
}

export function collectAttackRollModeDetails(snapshot, actor, target, action) {
  const outgoing = collectModifierDetails(snapshot, actor, "attack_roll", { action, target, source: actor });
  const incoming = collectModifierDetails(snapshot, target, "incoming_attack_roll", { action, source: actor, target });
  return [...outgoing, ...incoming].filter((detail) => ["advantage", "disadvantage"].includes(detail.mode));
}

export function collectSaveRollModeDetails(snapshot, actor, ability, action, source = null) {
  return collectModifierDetails(snapshot, actor, "save", { ability, action, source })
    .filter((detail) => ["advantage", "disadvantage"].includes(detail.mode));
}

export function rollSaveModifier(snapshot, actor, ability, action, dice) {
  const details = collectModifierDetails(snapshot, actor, "save", { ability, action });
  return rollModifierDetails(details, dice, `${String(ability || "").toUpperCase()} save`);
}

export function rollDamageReduction(snapshot, actor, damageType, dice) {
  const details = collectModifierDetails(snapshot, actor, "damage_reduction", { damageType });
  return rollModifierDetails(details, dice, `${damageType || "damage"} reduction`);
}

export function collectModifierDetails(snapshot, actor, stat, context = {}) {
  if (!actor) return [];
  const statOptions = stat === "attack_roll" || stat === "save" || stat === "ability_check"
    ? new Set([stat, "d20_test"])
    : new Set([stat]);
  const effects = [
    ...(actor.activeEffects || []),
    ...featureHookModifierEffects(actor, stat),
    ...combatAuraEffectsAffectingActor(snapshot, actor),
    ...(snapshot ? combatObjectsAffectingActor(snapshot, actor) : []).flatMap((object) =>
      (object.effects || []).map((effect) => ({
        ...effect,
        sourceId: effect.sourceId || object.id,
        sourceActorId: effect.sourceActorId || object.sourceActorId,
        sourceTeam: effect.sourceTeam || object.sourceTeam,
        label: effect.label || object.name,
      }))
    ),
  ];
  return effects
    .filter((effect) => effect?.type === "modifier")
    .filter((effect) => (effect.trigger || "passive") === "passive")
    .filter((effect) => effectAffectsActor(effect, actor))
    .filter((effect) => statOptions.has(effect.stat))
    .filter((effect) => matchesAbility(effect, context.ability))
    .filter((effect) => matchesConditionContext(effect, context.action))
    .filter((effect) => matchesDamageType(effect, context.damageType))
    .filter((effect) => matchesEquipmentCondition(effect, actor))
    .filter((effect) => matchesTags(effect, context.action))
    .filter((effect) => matchesSourceActor(effect, context.source))
    .filter((effect) => matchesTargetSourceActor(effect, context.target))
    .filter((effect) => targetHasRequiredMark(context.source || actor, context.target, effect.requiresMark))
    .map((effect) => ({
      id: effect.id || effect.sourceId || effect.stat,
      label: effect.label || effect.id || effect.stat,
      amount: Number.isFinite(effect.amount) ? effect.amount : 0,
      multiplier: Number.isFinite(effect.multiplier) ? effect.multiplier : 1,
      base: Number.isFinite(effect.base) ? effect.base : null,
      addDex: effect.addDex === true,
      die: effect.die || null,
      mode: effect.mode || null,
      stat: effect.stat,
      consumeOn: effect.consumeOn || null,
    }));
}

function featureHookModifierEffects(actor, stat) {
  if (stat !== "damage_reduction") return [];
  return getActorFeatureHooks(actor, "damage_reduction").map((hook) => ({
    id: hook.id,
    label: hook.label || hook.name || hook.id,
    type: "modifier",
    trigger: "passive",
    target: "self",
    stat: "damage_reduction",
    amount: resolveHookAmount(actor, hook.amount),
    damageType: Array.isArray(hook.damageTypes) ? null : hook.damageType,
    damageTypes: hook.damageTypes || null,
    condition: hook.condition || null,
  }));
}

function resolveHookAmount(actor, value) {
  if (value === "proficiency_bonus") return actor?.proficiencyBonus || 0;
  return Number.isFinite(value) ? value : Number(value) || 0;
}

function matchesTargetSourceActor(effect, target) {
  if (!effect.targetSourceActorOnly) return true;
  return Boolean(target?.id && effect.sourceActorId === target.id);
}

function matchesTags(effect, action = {}) {
  if (!Array.isArray(effect.tags) || !effect.tags.length) return true;
  const actionTags = new Set([
    ...(Array.isArray(action.tags) ? action.tags : []),
    ...(Array.isArray(action.effectTags) ? action.effectTags : []),
    ...Object.entries(action.tags || {}).filter(([, value]) => value === true).map(([key]) => key),
  ]);
  return effect.tags.some((tag) => actionTags.has(tag));
}

function matchesSourceActor(effect, source) {
  if (!effect.sourceActorOnly) return true;
  return Boolean(source?.id && effect.sourceActorId === source.id);
}

function effectAffectsActor(effect, actor) {
  if (!effect.affects || effect.affects === "all") return true;
  if (effect.affects === "allies") return actor.team === effect.sourceTeam;
  if (effect.affects === "enemies") return actor.team !== effect.sourceTeam;
  return true;
}

export function addActiveEffect(actor, effect) {
  if (!actor || !effect) return false;
  if (!Array.isArray(actor.activeEffects)) actor.activeEffects = [];
  const id = effect.id || `${effect.type || "effect"}_${actor.activeEffects.length + 1}`;
  const normalized = normalizeActiveEffects([{ ...effect, id }])[0];
  const existing = actor.activeEffects.find((item) => item.id === id);
  if (existing) {
    Object.assign(existing, normalized);
    return false;
  }
  actor.activeEffects.push(normalized);
  return true;
}

export function removeActiveEffect(actor, effectId) {
  if (!Array.isArray(actor?.activeEffects)) return false;
  const before = actor.activeEffects.length;
  actor.activeEffects = actor.activeEffects.filter((effect) => effect.id !== effectId);
  return actor.activeEffects.length !== before;
}

export function sumStaticModifiers(details) {
  return details.reduce((total, detail) => total + (Number(detail.amount) || 0), 0);
}

function rollModifierDetails(details, dice, label) {
  let total = 0;
  const parts = [];
  for (const detail of details) {
    let amount = Number(detail.amount) || 0;
    if (detail.die && dice?.rollDamage) {
      const rolled = dice.rollDamage(detail.die);
      amount += rolled.total * (Number.isFinite(detail.multiplier) ? detail.multiplier : 1);
      parts.push({ ...detail, amount, roll: rolled });
    } else {
      parts.push({ ...detail, amount });
    }
    total += amount;
  }
  return {
    total,
    details: parts,
    reasons: parts.map(formatModifierReason),
    label,
  };
}

function formatModifierReason(part) {
  const roll = part.roll?.rolls?.length ? ` (${part.die} rolled [${part.roll.rolls.join(", ")}])` : "";
  return `${part.label} ${formatSigned(part.amount)}${roll}`;
}

function matchesAbility(effect, ability) {
  if (Array.isArray(effect.abilities) && effect.abilities.length) {
    return effect.abilities.map((item) => String(item).toLowerCase().slice(0, 3)).includes(String(ability || "").toLowerCase().slice(0, 3));
  }
  if (!effect.ability || effect.ability === "all") return true;
  return String(effect.ability).toLowerCase() === String(ability || "").toLowerCase();
}

function matchesConditionContext(effect, action = {}) {
  const ids = [
    effect.conditionId,
    ...(Array.isArray(effect.conditionIds) ? effect.conditionIds : []),
  ].filter(Boolean);
  if (!ids.length) return true;
  const actionIds = [
    action.condition,
    action.conditionId,
    action.saveCondition,
    action.name,
  ].filter(Boolean).map((item) => String(item).toLowerCase());
  return ids.some((id) => actionIds.includes(String(id).toLowerCase()));
}

function matchesDamageType(effect, damageType) {
  if (Array.isArray(effect.damageTypes) && effect.damageTypes.length) return effect.damageTypes.includes(damageType);
  if (!effect.damageType || effect.damageType === "all") return true;
  return effect.damageType === damageType;
}

function matchesEquipmentCondition(effect, actor) {
  const condition = effect.condition;
  if (!condition || typeof condition !== "object") return true;
  if (condition.equippedArmorType && actor?.equipment?.armorType !== condition.equippedArmorType) return false;
  if (condition.actorCondition && !(actor?.conditions || []).some((entry) => (typeof entry === "string" ? entry : entry.id) === condition.actorCondition)) return false;
  return true;
}

function formatSigned(value) {
  return value >= 0 ? `+${value}` : String(value);
}

function resolveAcFormula(actor, formula) {
  const base = Number.isFinite(formula.base) ? formula.base : 0;
  const dex = formula.addDex ? getDexModifier(actor) : 0;
  return base + dex;
}

function getDexModifier(actor) {
  if (Number.isFinite(actor?.abilityMods?.dex)) return actor.abilityMods.dex;
  if (Number.isFinite(actor?.abilities?.dex)) return Math.floor((actor.abilities.dex - 10) / 2);
  if (Number.isFinite(actor?.saves?.dex)) return actor.saves.dex;
  return 0;
}
