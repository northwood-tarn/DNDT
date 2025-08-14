// engine/actionEconomy.js

import { computeEconomy } from '../utils/economyRules.js';

export function resetEconomy(actor) {
  actor.combatEconomy = computeEconomy(actor);
}

export function canUseAction(actor) {
  return actor.combatEconomy?.actions > 0;
}

export function useAction(actor) {
  if (canUseAction(actor)) actor.combatEconomy.actions--;
}

export function canUseBonusAction(actor) {
  return actor.combatEconomy?.bonusActions > 0;
}

export function useBonusAction(actor) {
  if (canUseBonusAction(actor)) actor.combatEconomy.bonusActions--;
}

export function canUseReaction(actor) {
  return actor.combatEconomy?.reactions > 0;
}

export function useReaction(actor) {
  if (canUseReaction(actor)) actor.combatEconomy.reactions--;
}

export function useMovement(actor, tiles = 1) {
  if (actor.combatEconomy?.movement >= tiles) {
    actor.combatEconomy.movement -= tiles;
    return true;
  }
  return false;
}

export function canAct(actor) {
  const econ = actor.combatEconomy;
  return econ?.actions > 0 || econ?.bonusActions > 0 || econ?.reactions > 0;
}

export function attemptHide(actor, logFn = console.log) {
  if (!canUseBonusAction(actor)) {
    logFn(`${actor.name} has no bonus actions left.`);
    return false;
  }

  const roll = Math.floor(Math.random() * 20) + 1;
  const dexMod = actor.dexMod || 0;
  const stealthBonus = actor.skills?.Stealth || 0;
  const total = roll + dexMod + stealthBonus;
  const DC = 15;

  const success = total >= DC;
  actor.isHidden = success;

  logFn(`${actor.name} attempts to hide: rolled ${total} vs DC ${DC} — ${success ? "Success" : "Failure"}.`);
  useBonusAction(actor);
  return success;
}

export function clearHiddenStatus(actor, logFn = console.log) {
  if (actor.isHidden) {
    actor.isHidden = false;
    logFn(`${actor.name} is no longer hidden.`);
  }
}

export function stealthCheckAtDisadvantage(actor, logFn = console.log) {
  const roll1 = Math.floor(Math.random() * 20) + 1;
  const roll2 = Math.floor(Math.random() * 20) + 1;
  const roll = Math.min(roll1, roll2);

  const dexMod = actor.dexMod || 0;
  const stealthBonus = actor.skills?.Stealth || 0;
  const total = roll + dexMod + stealthBonus;
  const DC = 15;

  const success = total >= DC;
  actor.isHidden = success;

  logFn(`${actor.name} attempts to remain hidden (disadvantage): rolled ${roll1}/${roll2} = ${roll} + mods = ${total} vs DC ${DC} — ${success ? "Success" : "Failure"}.`);
  return success;
}
