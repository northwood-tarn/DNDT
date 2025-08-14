
// app/systems/turnEffects.js
// End-of-turn ticking for short-lived timed effects that don't justify concentration payloads.
// Keeps logic generic and data-driven where possible.

export function tickEndOfTurn(state, log = () => {}) {
  if (!state || !state.combat) return;
  const actors = [state.combat.player, ...(state.combat.enemies || [])].filter(Boolean);

  for (const a of actors) {
    // Sleep countdown (our Sleep implementation marks this on targets)
    if (a.tempStatuses?.sleepRoundsRemaining > 0) {
      a.tempStatuses.sleepRoundsRemaining -= 1;
      if (a.tempStatuses.sleepRoundsRemaining <= 0) {
        // Wake the target
        a.tempStatuses.sleepRoundsRemaining = 0;
        try {
          a.conditions = (a.conditions || []).filter(c => c !== 'Unconscious');
        } catch {}
        log(`${a.name || a.id} stirs awake.`);
      } else {
        log(`${a.name || a.id} remains asleep (${a.tempStatuses.sleepRoundsRemaining} rounds left).`);
      }
    }

    // Generic: per-turn decrement bag for other simple timed flags
    if (a.tempStatuses && typeof a.tempStatuses._decrementEachTurn === 'object') {
      for (const k of Object.keys(a.tempStatuses._decrementEachTurn)) {
        a.tempStatuses._decrementEachTurn[k] -= 1;
        if (a.tempStatuses._decrementEachTurn[k] <= 0) {
          // Clear flag when done
          delete a.tempStatuses[k];
          delete a.tempStatuses._decrementEachTurn[k];
          log(`${a.name || a.id}: ${k} has ended.`);
        }
      }
      // Clean container if empty
      if (Object.keys(a.tempStatuses._decrementEachTurn).length === 0) {
        delete a.tempStatuses._decrementEachTurn;
      }
    }
  }
}
