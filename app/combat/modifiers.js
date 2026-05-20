import { combatObjectsAffectingActor } from "./combatObjects.js";

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
  return Math.max(0, base + modifier);
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
  const effects = [
    ...(actor.activeEffects || []),
    ...combatObjectsAffectingActor(snapshot, actor).flatMap((object) =>
      (object.effects || []).map((effect) => ({
        ...effect,
        sourceId: effect.sourceId || object.id,
        label: effect.label || object.name,
      }))
    ),
  ];
  return effects
    .filter((effect) => effect?.type === "modifier")
    .filter((effect) => (effect.trigger || "passive") === "passive")
    .filter((effect) => effect.stat === stat)
    .filter((effect) => matchesAbility(effect, context.ability))
    .filter((effect) => matchesDamageType(effect, context.damageType))
    .map((effect) => ({
      id: effect.id || effect.sourceId || effect.stat,
      label: effect.label || effect.id || effect.stat,
      amount: Number.isFinite(effect.amount) ? effect.amount : 0,
      multiplier: Number.isFinite(effect.multiplier) ? effect.multiplier : 1,
      base: Number.isFinite(effect.base) ? effect.base : null,
      addDex: effect.addDex === true,
      die: effect.die || null,
      stat: effect.stat,
    }));
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
    reasons: parts.map((part) => `${part.label} ${formatSigned(part.amount)}`),
    label,
  };
}

function matchesAbility(effect, ability) {
  if (!effect.ability || effect.ability === "all") return true;
  return String(effect.ability).toLowerCase() === String(ability || "").toLowerCase();
}

function matchesDamageType(effect, damageType) {
  if (!effect.damageType || effect.damageType === "all") return true;
  return effect.damageType === damageType;
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
