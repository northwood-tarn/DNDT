// utils/dice.js
// Adds Lucky-aware d20 roll while keeping existing helpers intact.

// Existing API (unchanged)
export function roll(diceStr) {
  const { total } = rollWithDetail(diceStr);
  return total;
}

export function rollWithDetail(diceStr) {
  const match = diceStr.match(/(\d*)d(\d+)([+-]\d+)?/);
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
  console.log("[dice] rollD20 initial roll:", roll1);
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

function luckyLogLine(context, r1, r2, chosen, name='You') {
  const kind = context?.type || 'roll';
  const label = context?.label ? ` (${context.label})` : '';
  return `${name} used Lucky on a d20${label}: rolled ${r1}, then ${r2}; kept ${chosen}.`;
}
