// utils/dice.js
// Adds Lucky-aware d20 roll while keeping existing helpers intact.

// Existing API (unchanged)
export function roll(diceStr) {
  const { total } = rollWithDetail(diceStr);
  return total;
}

export function rollWithDetail(diceStr) {
  const formula = String(diceStr).trim();
  if (/^[+-]?\d+$/.test(formula)) {
    const total = Number(formula);
    return { total, rolls: [], modifier: total };
  }
  const match = formula.match(/^(\d*)d(\d+)([+-]\d+)?$/);
  if (!match) {
    console.warn("Invalid dice format:", diceStr);
    return { total: 0, rolls: [], modifier: 0 };
  }

  const numDice = parseInt(match[1]) || 1;
  const dieType = parseInt(match[2]);
  const modifier = parseInt(match[3]) || 0;

  const rolls = [];
  for (let i = 0; i < numDice; i++) {
    rolls.push(Math.ceil(Math.random() * dieType));
  }

  const total = rolls.reduce((sum, r) => sum + r, 0) + modifier;

  return {
    total,
    rolls,
    modifier
  };
}

// New: single die
export function rollD(sides = 20) {
  return Math.floor(Math.random() * sides) + 1;
}

/**
 * New: Lucky-aware d20 roll.
 * Options:
 * - actor: the creature rolling; if actor.luck?.points > 0, Lucky can be used
 * - allowLucky (default true): set false to bypass Lucky for this roll
 * - logFn(msg): optional logger
 * - askUseLucky(ctx): optional prompt; return true to spend a point and reroll.
 *   If omitted, we auto-use Lucky only when it's clearly helpful (roll === 1).
 * - chooseResult(a, b): optional chooser; default picks the higher of the two.
 * - context: { type: 'attack'|'check'|'save', label?: string } for logs
 *
 * Returns { total, roll, usedLucky, secondRoll }
 */
export function rollD20({ actor=null, allowLucky=true, logFn=null, askUseLucky=null, chooseResult=null, context={} } = {}) {
  const roll1 = rollD(20);
  let usedLucky = false;
  let roll2 = null;

  const logger = typeof logFn === 'function' ? logFn : (()=>{});
  const canLucky = allowLucky && actor && actor.luck && actor.luck.points > 0;

  // Decide whether to offer/use Lucky
  let willUseLucky = false;
  if (canLucky) {
    if (typeof askUseLucky === 'function') {
      try { willUseLucky = !!askUseLucky({ roll: roll1, actor, context }); } catch {}
    } else {
      // Default heuristic: auto-use only on natural 1 to keep it simple & fair by default
      willUseLucky = (roll1 === 1);
    }
  }

  if (willUseLucky) {
    roll2 = rollD(20);
    usedLucky = true;
    actor.luck.points = Math.max(0, (actor.luck.points || 0) - 1);
  }

  let finalRoll = roll1;
  if (usedLucky) {
    if (typeof chooseResult === 'function') {
      try { finalRoll = chooseResult(roll1, roll2); } catch { finalRoll = Math.max(roll1, roll2); }
    } else {
      // By default, Lucky lets you choose; pick the better automatically
      finalRoll = Math.max(roll1, roll2);
    }
    logger && logger(luckyLogLine(context, roll1, roll2, finalRoll, actor?.name));
  }

  return { total: finalRoll, roll: finalRoll, usedLucky, secondRoll: roll2 };
}

export function applyLuckyNearMissD20({
  actor = null,
  currentRoll = null,
  context = {},
  logFn = null,
  chooseResult = null,
} = {}) {
  const type = context?.type;
  if (!["attack", "save"].includes(type)) return noLucky(currentRoll);

  const targetNumber = Number(context.targetNumber);
  const bonus = Number(context.bonus || 0);
  if (!Number.isFinite(targetNumber) || !Number.isFinite(currentRoll)) return noLucky(currentRoll);

  const luck = getLuckPool(actor);
  if (!luck || luck.points <= 0 || luck.usedThisCombat) return noLucky(currentRoll);

  const total = currentRoll + bonus;
  const missedBy = targetNumber - total;
  if (missedBy <= 0 || missedBy >= 5) return noLucky(currentRoll);

  const secondRoll = rollD(20);
  const finalRoll = typeof chooseResult === "function"
    ? chooseResult(currentRoll, secondRoll)
    : Math.max(currentRoll, secondRoll);
  spendLuck(actor, luck);

  const result = {
    roll: finalRoll,
    total: finalRoll,
    usedLucky: true,
    originalRoll: currentRoll,
    secondRoll,
    missedBy,
    pointsRemaining: luck.points,
  };
  if (typeof logFn === "function") {
    logFn(luckyLogLine(context, currentRoll, secondRoll, finalRoll, actor?.name));
  }
  return result;
}

export function applyResourcefulNearMissD20({
  actor = null,
  currentRoll = null,
  context = {},
  rollD20 = null,
} = {}) {
  if (context?.type !== "attack") return noLucky(currentRoll);
  const targetNumber = Number(context.targetNumber);
  const bonus = Number(context.bonus || 0);
  if (!actor || !Number.isFinite(targetNumber) || !Number.isFinite(currentRoll) || typeof rollD20 !== "function") {
    return noLucky(currentRoll);
  }
  const resource = Array.isArray(actor.resources)
    ? actor.resources.find((item) => item.id === "resourceful")
    : null;
  if (!resource || (resource.current ?? resource.max ?? 0) <= 0 || actor.combatFlags?.resourcefulUsed === true) {
    return noLucky(currentRoll);
  }
  const total = currentRoll + bonus;
  const missedBy = targetNumber - total;
  if (missedBy <= 0 || missedBy > 4) return noLucky(currentRoll);

  const second = rollD20({ type: context.type, label: context.label });
  const finalRoll = Math.max(currentRoll, second.roll);
  resource.current = Math.max(0, (resource.current ?? resource.max ?? 0) - 1);
  actor.combatFlags ??= {};
  actor.combatFlags.resourcefulUsed = true;
  return {
    roll: finalRoll,
    total: finalRoll,
    usedLucky: true,
    usedResourceful: true,
    originalRoll: currentRoll,
    secondRoll: second.roll,
    missedBy,
    pointsRemaining: resource.current,
  };
}

function noLucky(currentRoll) {
  return {
    roll: currentRoll,
    total: currentRoll,
    usedLucky: false,
    originalRoll: currentRoll,
    secondRoll: null,
  };
}

function getLuckPool(actor) {
  if (!actor) return null;
  if (actor.luck && Number.isFinite(actor.luck.points)) return actor.luck;
  const resource = Array.isArray(actor.resources)
    ? actor.resources.find((item) => item.id === "luck_points")
    : null;
  if (!resource || !Number.isFinite(resource.current)) return null;
  actor.luck = {
    points: resource.current,
    max: resource.max ?? resource.current,
    usedThisCombat: false,
    resourceId: "luck_points",
  };
  return actor.luck;
}

function spendLuck(actor, luck) {
  luck.points = Math.max(0, (luck.points || 0) - 1);
  luck.usedThisCombat = true;
  if (!actor || !Array.isArray(actor.resources)) return;
  const resource = actor.resources.find((item) => item.id === "luck_points");
  if (resource) resource.current = luck.points;
}

function luckyLogLine(context, r1, r2, chosen, name='You') {
  const kind = context?.type || 'roll';
  const label = context?.label ? ` (${context.label})` : '';
  const missedBy = Number.isFinite(context?.missedBy) ? ` after missing by ${context.missedBy}` : "";
  return `${name} used Lucky on a ${kind}${label}${missedBy}: rolled ${r1}, then ${r2}; kept ${chosen}.`;
}
