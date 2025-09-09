// app/systems/turnEconomy.js
// Centralized action economy utilities (Action, Bonus, Move) with simple range helpers.

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
export function setDashed(actor)      { ensureTurnEconomy(actor).dashedThisTurn = true; spendAction(actor); spendMove(actor); }

// ---- Range helpers ----
// Normalize and read a numeric "distanceFromPC" (feet) stored on actors relative to the single PC.
// If missing, default to 5 ft for melee-range creatures.
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
