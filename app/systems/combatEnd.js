// systems/combatEnd.js — text-mode
import { logSystem } from "../engine/log.js";

export function showVictoryScreen(loot = [], onReturn, onNextLevel) {
  logSystem("Victory! The enemy is defeated.");
  if (loot.length) {
    logSystem("Loot:");
    loot.forEach(item => logSystem(` - ${item.name}`));
  }
  if (typeof onReturn === "function") onReturn();
}

export function showDefeatScreen(onReloadPreCombat, onReloadEmber, onExit) {
  logSystem("You have been defeated.");
  if (typeof onReloadPreCombat === "function") onReloadPreCombat();
}
