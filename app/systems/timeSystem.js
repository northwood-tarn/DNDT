// systems/timeSystem.js — unified exploration/combat time (ESM)
//
// Public API:
//   getTime() -> { minutes, combatSeconds, inCombat }
//   setRates({ inside, outside })       // configure multipliers; defaults: inside=1, outside=6
//   addListener(fn), removeListener(fn)  // exploration-time listeners (receives minutesAdded)
//   advance(context: 'inside'|'outside', steps=1) -> minutesAdded   (no-op during combat)
//   enterCombat(), exitCombat()
//   advanceCombat(rounds=1) -> secondsAdded (6 per round)
//
// Notes:
//   - Exploration time is measured in 'minutes'. Steps are player action units multiplied by a rate.
//   - Combat time is tracked separately in seconds and only changes via advanceCombat().
//   - We do NOT notify exploration listeners during combat advancement.

const RATE = { inside: 1, outside: 6 };
let minutes = 0;           // exploration minutes
let combatSeconds = 0;     // combat time
let inCombat = false;
const listeners = new Set();

export function getTime(){ return { minutes, combatSeconds, inCombat }; }
export function setRates(next){
  if (next && typeof next.inside === 'number') RATE.inside = Math.max(0, Math.floor(next.inside));
  if (next && typeof next.outside === 'number') RATE.outside = Math.max(0, Math.floor(next.outside));
}
export function addListener(fn){ if (typeof fn === 'function') listeners.add(fn); }
export function removeListener(fn){ listeners.delete(fn); }

export function advance(context='inside', steps=1){
  if (inCombat) return 0; // exploration time frozen during combat
  const rate = RATE[context] ?? RATE.inside;
  const add = Math.max(0, Math.floor((steps||1) * rate));
  if (add <= 0) return 0;
  minutes += add;
  listeners.forEach(fn => { try{ fn(add); } catch(_){} });
  return add;
}

export function enterCombat(){ inCombat = true; }
export function exitCombat(){ inCombat = false; }

export function advanceCombat(rounds=1){
  const add = Math.max(0, Math.floor(rounds||0) * 6);
  combatSeconds += add;
  return add;
}
