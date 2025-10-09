// app/systems/turnEconomy.js — per-actor action economy + distance helpers (ESM)
//
// API:
//   newTurnEconomy() -> economy bag
//   resetTurnEconomy(actor) / ensureTurnEconomy(actor)
//   canUseAction/Bonus/Move, spendAction/Bonus/Move
//   setDisengaged(actor), setDashed(actor)  // dashed marks and *spends* action+move
//   startTurn(actor) / endTurn(actor)       // QoL aliases (startTurn resets economy)
//   resetTurnEconomyForAll(state)           // resets for every actor in state.combat.actors[]
//   getDistanceFromPC(actor), setDistanceFromPC(actor, feet), isMeleeRange(actor)
//
export function newTurnEconomy() {
  return { actionUsed: false, bonusUsed: false, moveUsed: false, disengagedThisTurn: false, dashedThisTurn: false };
}

export function resetTurnEconomy(actor) {
  actor.turnEconomy = newTurnEconomy();
}

export function ensureTurnEconomy(actor) {
  if (!actor.turnEconomy) resetTurnEconomy(actor);
  return actor.turnEconomy;
}

export function canUseAction(actor)   { return !ensureTurnEconomy(actor).actionUsed; }
export function canUseBonus(actor)    { return !ensureTurnEconomy(actor).bonusUsed; }
export function canUseMove(actor)     { return !ensureTurnEconomy(actor).moveUsed;  }

export function spendAction(actor)    { ensureTurnEconomy(actor).actionUsed = true; }
export function spendBonus(actor)     { ensureTurnEconomy(actor).bonusUsed = true;  }
export function spendMove(actor)      { ensureTurnEconomy(actor).moveUsed = true;   }

export function setDisengaged(actor)  { ensureTurnEconomy(actor).disengagedThisTurn = true; }

// Dash should atomically mark the flag *and* spend Action + Move for this turn.
export function setDashed(actor)      {
  const e = ensureTurnEconomy(actor);
  e.dashedThisTurn = true;
  e.actionUsed = true;
  e.moveUsed = true;
}

// ---- Turn lifecycle helpers ----
export function startTurn(actor) {
  // reset per-turn economy and flags
  resetTurnEconomy(actor);
}

// Placeholder for symmetry; keep if you later want per-turn end hooks.
export function endTurn(actor) {
  // no-op for now
}

// Reset all actors' economy bags (canonical combat shape preferred)
export function resetTurnEconomyForAll(state) {
  const actors = (state?.combat?.actors && Array.isArray(state.combat.actors))
    ? state.combat.actors
    : [ state?.combat?.player, ...(state?.combat?.enemies || []) ].filter(Boolean);
  for (const a of actors) resetTurnEconomy(a);
}

// ---- Range helpers ----
export function getDistanceFromPC(actor) {
  const d = typeof actor.distanceFromPC === "number" ? actor.distanceFromPC : 5;
  return Math.max(0, d|0);
}

export function setDistanceFromPC(actor, feet) {
  actor.distanceFromPC = Math.max(0, feet|0);
}

export function isMeleeRange(actor) {
  return getDistanceFromPC(actor) <= 5;
}
