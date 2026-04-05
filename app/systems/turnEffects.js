// systems/turnEffects.js — end-of-turn ticking for short-lived effects (ESM)
//
// Designed to work with both legacy state.combat.{player,enemies[]} and
// the canonical state.combat.actors[] form. Pass in a `log` function to collect
// messages or side-channel to your combat log.
//
// API:
//   tickEndOfTurn(state, log=()=>{})

function collectActors(state){
  // Prefer canonical actors[]
  if (state?.combat?.actors && Array.isArray(state.combat.actors)) return state.combat.actors.filter(Boolean);
  // Fallback to legacy player + enemies
  const legacy = [];
  if (state?.combat?.player) legacy.push(state.combat.player);
  if (Array.isArray(state?.combat?.enemies)) legacy.push(...state.combat.enemies);
  return legacy.filter(Boolean);
}

export function tickEndOfTurn(state, log = () => {}) {
  if (!state || !state.combat) return;
  const actors = collectActors(state);
  for (const a of actors) {
    if (!a) continue;
    const name = a.name || a.id || "Actor";

    // Sleep countdown
    if (a.tempStatuses?.sleepRoundsRemaining > 0) {
      a.tempStatuses.sleepRoundsRemaining -= 1;
      if (a.tempStatuses.sleepRoundsRemaining <= 0) {
        a.tempStatuses.sleepRoundsRemaining = 0;
        try { a.conditions = (a.conditions || []).filter(c => c !== 'Unconscious'); } catch {}
        log(`${name} stirs awake.`);
      } else {
        log(`${name} remains asleep (${a.tempStatuses.sleepRoundsRemaining} rounds left).`);
      }
    }

    // Generic per-turn decrement bag for other timed flags
    if (a.tempStatuses && typeof a.tempStatuses._decrementEachTurn === 'object') {
      for (const k of Object.keys(a.tempStatuses._decrementEachTurn)) {
        a.tempStatuses._decrementEachTurn[k] -= 1;
        if (a.tempStatuses._decrementEachTurn[k] <= 0) {
          delete a.tempStatuses[k];
          delete a.tempStatuses._decrementEachTurn[k];
          log(`${name}: ${k} has ended.`);
        }
      }
      if (Object.keys(a.tempStatuses._decrementEachTurn).length === 0) {
        delete a.tempStatuses._decrementEachTurn;
      }
    }
  }
}
