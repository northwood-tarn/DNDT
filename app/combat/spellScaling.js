export function getScaledSpellDamage(spellRecord, options = {}) {
  const conditional = conditionalDamageFromEffect(spellRecord.hooks?.applyEffect);
  const baseDamage = options.damage || conditional?.base || spellRecord.hooks?.damage?.dice || firstTierDamage(spellRecord.hooks?.damage?.diceByTier) || null;
  const cantripDamage = scaleCantripDamage(baseDamage, spellRecord, options.casterLevel);
  return scaleStandardSlotDamage(cantripDamage, spellRecord, options.slotLevel);
}

function scaleStandardSlotDamage(damage, spellRecord, slotLevel) {
  if (!damage || spellRecord.scaling?.type !== "slot") return damage;
  const levelsAbove = Math.max(0, Number(slotLevel ?? spellRecord.level) - spellRecord.level);
  if (!levelsAbove) return damage;
  const text = spellRecord.scaling?.slot?.text || "";
  const perTwoSlots = /(?:per|for every) 2 slot levels/i.test(text);
  const steps = perTwoSlots ? Math.floor(levelsAbove / 2) : levelsAbove;
  if (!steps) return damage;
  const match = text.match(/\+(\d*)d(\d+)/i);
  if (!match) return damage;
  return addDice(damage, `+${Number(match[1] || 1) * steps}d${match[2]}`);
}

export function createSpellActionExtrasFromScaling(spellRecord, options = {}) {
  const applyEffect = spellRecord.hooks?.applyEffect;
  const extras = {};
  const repeatAttacks = repeatAttacksFromEffect(applyEffect, options.casterLevel);
  const conditionalDamage = conditionalDamageFromEffect(applyEffect);
  if (repeatAttacks > 1) extras.repeatAttacks = repeatAttacks;
  if (conditionalDamage) {
    extras.conditionalDamage = {
      ...conditionalDamage,
      base: scaleCantripDamage(conditionalDamage.base, spellRecord, options.casterLevel),
      alternate: scaleCantripDamage(conditionalDamage.alternate, spellRecord, options.casterLevel),
    };
  }
  if (spellRecord.hooks?.onCastEnd) extras.onCastEnd = structuredClone(spellRecord.hooks.onCastEnd);
  return extras;
}

export function scaleSlotDamage(damage, scaling, slotLevel) {
  if (!damage || !scaling) return damage;
  const baseLevel = scaling.baseLevel || 1;
  const steps = Math.max(0, Math.floor(((Number(slotLevel) || baseLevel) - baseLevel) / 2));
  if (steps <= 0) return damage;
  const match = String(scaling.add || "").match(/^\+?(\d*)d(\d+)$/i);
  if (!match) return damage;
  const count = Number(match[1] || 1) * steps;
  return addDice(damage, `+${count}d${match[2]}`);
}

function repeatAttacksFromEffect(applyEffect, casterLevel = 1) {
  if (String(applyEffect?.kind || "").toLowerCase() !== "multi_beam") return 1;
  return valueByLevel(applyEffect.beamsByLevel, casterLevel) || 1;
}

function conditionalDamageFromEffect(applyEffect) {
  if (String(applyEffect?.kind || "").toLowerCase() !== "conditional_die") return null;
  return {
    condition: applyEffect.condition || "if_damaged",
    base: applyEffect.base || null,
    alternate: applyEffect.alternate || null,
  };
}

function scaleCantripDamage(damage, spellRecord, casterLevel = 1) {
  if (!damage || spellRecord.scaling?.type !== "cantrip") return damage;
  const add = cantripTierAdd(spellRecord.scaling?.cantrip?.tiers, casterLevel);
  return addDice(damage, add);
}

function cantripTierAdd(tiers = [], casterLevel = 1) {
  const level = Number(casterLevel) || 1;
  return (tiers || [])
    .filter((tier) => Number(tier.level) <= level)
    .sort((a, b) => Number(b.level) - Number(a.level))[0]?.add || null;
}

function firstTierDamage(diceByTier) {
  if (!diceByTier || typeof diceByTier !== "object") return null;
  const firstKey = Object.keys(diceByTier)
    .map(Number)
    .filter(Number.isFinite)
    .sort((a, b) => a - b)[0];
  const value = diceByTier[firstKey];
  return typeof value === "string" ? value : value?.dice || null;
}

function addDice(base, add) {
  if (!add || !base) return base;
  const baseMatch = String(base).match(/^(\d+)d(\d+)$/i);
  const addMatch = String(add).match(/^\+?(\d+)d(\d+)$/i);
  if (!baseMatch || !addMatch) return base;
  return `${Number(baseMatch[1]) + Number(addMatch[1])}d${baseMatch[2]}`;
}

function valueByLevel(values, casterLevel = 1) {
  if (!values || typeof values !== "object") return null;
  const level = Number(casterLevel) || 1;
  return Object.entries(values)
    .map(([required, value]) => [Number(required), Number(value)])
    .filter(([required, value]) => Number.isFinite(required) && Number.isFinite(value) && required <= level)
    .sort((a, b) => b[0] - a[0])[0]?.[1] || null;
}
