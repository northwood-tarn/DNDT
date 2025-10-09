/**
 * Compute the starting turn economy for an actor this turn/round.
 * These values align with turnEconomy.js naming.
 */
export function computeEconomy(){
  return { actions:1, bonusActions:1, reactions:1, movement:6 };
}
