import { getDamageRollHooks, getSavageAttackerHook, markDamageRollHookUsed } from "./featureHooks.js";

export function rollActionDamage(source, action, dice, { critical = false } = {}) {
  const base = applyDamageRollHooks(source, action, dice, rollActionDamageOnce(action, dice, { critical }), { critical });
  const savage = getSavageAttackerHook(source, action);
  if (!savage) return base;

  const second = applyDamageRollHooks(source, action, dice, rollActionDamageOnce(action, dice, { critical }), { critical, skipFrequency: true });
  const chosen = second.total > base.total ? second : base;
  source.turnFlags = { ...(source.turnFlags || {}), savageAttackerUsed: true };
  return {
    ...chosen,
    savageAttacker: {
      first: summarizeDamageRoll(base),
      second: summarizeDamageRoll(second),
      kept: chosen === second ? "second" : "first",
    },
  };
}

export function rollRiderDamage(damage, dice, { critical = false } = {}) {
  if (typeof damage === "number") return { total: damage, rolls: [], modifier: damage, dice: String(damage), critical: false, criticalRolls: [] };
  return rollActionDamageOnce({ damage }, dice, { critical });
}

function rollActionDamageOnce(action, dice, { critical = false } = {}) {
  const base = dice.rollDamage(action.damage);
  if (!critical) return { ...base, critical: false, criticalRolls: [] };

  const extraDice = criticalDamageDice(action.damage);
  if (!extraDice) return { ...base, critical: true, criticalRolls: [] };

  const extra = dice.rollDamage(extraDice);
  return {
    ...base,
    total: base.total + extra.total,
    rolls: [...(base.rolls || []), ...(extra.rolls || [])],
    critical: true,
    criticalRolls: extra.rolls || [],
  };
}

function applyDamageRollHooks(source, action, dice, rolled, { critical = false, skipFrequency = false } = {}) {
  let next = rolled;
  const applied = [];
  for (const hook of getDamageRollHooks(source, action, { critical })) {
    const before = summarizeDamageRoll(next);
    if (hook.roll?.rerollLowestDie) {
      next = applyRerollLowestDie(next, action, dice);
    }
    if (hook.amount) {
      next = applyFlatDamageBonus(next, resolveHookAmount(source, hook));
    }
    if (Number.isFinite(hook.minimumDieResult)) {
      next = applyMinimumDieResult(next, hook.minimumDieResult);
    }
    if (critical && Number.isFinite(hook.extraCriticalDice) && hook.extraCriticalDice > 0) {
      next = applyExtraCriticalDice(next, action, dice, hook.extraCriticalDice);
    }
    if (next !== rolled || JSON.stringify(before) !== JSON.stringify(summarizeDamageRoll(next))) {
      applied.push({ id: hook.id, before, after: summarizeDamageRoll(next) });
      if (!skipFrequency) markDamageRollHookUsed(source, hook);
    }
  }
  return applied.length ? { ...next, featureDamageHooks: [...(next.featureDamageHooks || []), ...applied] } : next;
}

function applyFlatDamageBonus(rolled, amount) {
  if (!amount) return rolled;
  return {
    ...rolled,
    total: rolled.total + amount,
    modifier: (rolled.modifier || 0) + amount,
  };
}

function applyRerollLowestDie(rolled, action, dice) {
  const rolls = [...(rolled.rolls || [])];
  if (!rolls.length) return rolled;
  const lowestIndex = rolls.reduce((best, value, index) => value < rolls[best] ? index : best, 0);
  const sides = firstDieSides(action.damage);
  if (!sides) return rolled;
  const reroll = dice.rollDamage(`1d${sides}`);
  const replacement = reroll.rolls?.[0] ?? reroll.total;
  const previous = rolls[lowestIndex];
  rolls[lowestIndex] = Math.max(previous, replacement);
  return {
    ...rolled,
    rolls,
    total: rolls.reduce((sum, value) => sum + value, 0) + (rolled.modifier || 0),
    rerolls: [...(rolled.rerolls || []), { previous, replacement, kept: rolls[lowestIndex] }],
  };
}

function applyMinimumDieResult(rolled, minimum) {
  const rolls = (rolled.rolls || []).map((roll) => Math.max(roll, minimum));
  return {
    ...rolled,
    rolls,
    total: rolls.reduce((sum, value) => sum + value, 0) + (rolled.modifier || 0),
  };
}

function applyExtraCriticalDice(rolled, action, dice, count) {
  const sides = firstDieSides(action.damage);
  if (!sides) return rolled;
  const extra = dice.rollDamage(`${count}d${sides}`);
  return {
    ...rolled,
    total: rolled.total + extra.total,
    rolls: [...(rolled.rolls || []), ...(extra.rolls || [])],
    criticalRolls: [...(rolled.criticalRolls || []), ...(extra.rolls || [])],
  };
}

function summarizeDamageRoll(rolled) {
  return {
    total: rolled.total,
    rolls: rolled.rolls || [],
    modifier: rolled.modifier || 0,
  };
}

function criticalDamageDice(diceText) {
  const match = String(diceText || "").match(/(\d*)d(\d+)/i);
  if (!match) return null;
  const count = Number(match[1] || 1);
  const sides = Number(match[2]);
  if (!Number.isFinite(count) || !Number.isFinite(sides) || count <= 0 || sides <= 0) return null;
  return `${count}d${sides}`;
}

function firstDieSides(diceText) {
  const match = String(diceText || "").match(/\d*d(\d+)/i);
  return match ? Number(match[1]) : null;
}

function resolveHookAmount(actor, hook) {
  const amount = hook?.amount;
  const multiplier = hookAmountMultiplier(actor, hook);
  if (amount === "proficiency_bonus") return (actor?.proficiencyBonus || 0) * multiplier;
  const base = Number.isFinite(amount) ? amount : Number(amount) || 0;
  return base * multiplier;
}

function hookAmountMultiplier(actor, hook) {
  const rule = hook?.amountMultiplierWhen;
  if (!rule?.turnFlag) return 1;
  return actor?.turnFlags?.[rule.turnFlag] === true ? (rule.multiplier || 1) : 1;
}
