// app/systems/initiative.js
// Standardised initiative system wired to abilities.js (single-player friendly).
// Uses the existing dice mechanic's advantage/disadvantage if available.
// Falls back to manual best-of/take-lowest if the dice API doesn't support adv flags.
//
// Exports:
// - rollInitiative(actors, opts={ state }) -> { order, rolls, surprised }
// - insertIntoInitiative(order, actorId, afterRound) -> new order
//
// Actors format (minimal):
//   { id, name, abilities: { dex: 14 }, initBonus?: number, surprised?: boolean }
//   // If you don't store abilities.dex, you can still pass { dexMod } directly.
//   // Any per-actor initiative advantage/disadvantage should be expressed via effects on state
//   // (e.g., Alert adds flat bonus; Feral Instinct adds advantage).
//
// Notes:
// - We derive (mod, adv, bonus) from abilities.getInitiativeComponents(actor, state).
// - Ties break by higher DEX mod, then name, then stable index.
// - Surprise is recorded but enforcement (skipping first turn) is done by the caller.
//

import { rollWithDetail } from "../utils/dice.js";
import { getInitiativeComponents, getAbilityMod } from "./abilities.js";

function d20WithAdv(adv=0){
  // Try native advantage on the dice API first
  try {
    const res = rollWithDetail("1d20", { adv });
    if (res && typeof res.total === 'number') {
      const rolls = res.rolls || (res.detail ? res.detail : [res.roll ?? res.total]);
      return { d20: res.total, detail: rolls };
    }
  } catch (e) {
    // fall through to manual
  }
  // Manual fallback
  const a = rollWithDetail("1d20");
  const r1 = a.roll ?? a.total;
  if (!adv) return { d20: r1, detail: [r1] };
  const b = rollWithDetail("1d20");
  const r2 = b.roll ?? b.total;
  return adv > 0
    ? { d20: Math.max(r1, r2), detail: [r1, r2] }
    : { d20: Math.min(r1, r2), detail: [r1, r2] };
}

export function rollInitiative(actors=[], opts={}){
  const gameState = opts.state; // optional; used for effects (bonuses/advantage)
  const withRolls = actors.map((a, index) => {
    const name = a.name || a.id;
    // Get derived components from abilities (mod, adv, bonus)
    const { mod, adv, bonus } = getInitiativeComponents(a, gameState);
    // Roll d20 with advantage flag (−1/0/+1)
    const r = d20WithAdv(adv || 0);
    const total = r.d20 + (mod || 0) + (bonus || 0);
    // Also compute dexMod independently for tie-break (stable even if effects change mid-combat)
    const dexMod = (typeof a.dexMod === 'number')
      ? a.dexMod
      : getAbilityMod(a, 'dex', gameState);
    return {
      id: a.id,
      name,
      surprised: !!a.surprised,
      index,
      dexMod,
      bonus: bonus || 0,
      d20: r.d20,
      detail: r.detail || [r.d20],
      total,
    };
  });

  // Sort: total desc, dexMod desc, name asc, index asc
  withRolls.sort((x,y) => {
    if (y.total !== x.total) return y.total - x.total;
    if (y.dexMod !== x.dexMod) return y.dexMod - x.dexMod;
    const nx = (x.name||"").toLowerCase(), ny = (y.name||"").toLowerCase();
    if (nx !== ny) return nx < ny ? -1 : 1;
    return x.index - y.index;
  });

  const order = withRolls.map(r => r.id);
  const rolls = {};
  withRolls.forEach(r => { rolls[r.id] = { total: r.total, d20: r.d20, mod: r.dexMod, bonus: r.bonus }; });
  const surprised = {};
  withRolls.forEach(r => { if (r.surprised) surprised[r.id] = true; });

  return { order, rolls, surprised };
}

export function insertIntoInitiative(order, actorId, afterRound=false){
  const next = order.slice();
  if (afterRound) next.push(actorId);
  else next.splice(order.length, 0, actorId);
  return next;
}
