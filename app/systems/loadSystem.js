// systems/loadSystem.js — text-mode
import { getAvailableSaves, loadPlayer } from "../systems/saveSystem.js";
import { logSystem } from "../engine/log.js";
import { sceneManager } from "../engine/sceneManager.js";
import ExplorationScene from "../scenes/ExplorationScene.js";

export function showLoadMenu() {
  const saves = getAvailableSaves();
  if (!saves || saves.length === 0) {
    logSystem("No saved games found.");
    return;
  }
  logSystem("Available saves:");
  saves.forEach(k => logSystem(" - " + k));
  logSystem("Use your host UI to call loadSave('<key>') or wire a command.");
}

export function loadSave(key) {
  try {
    loadPlayer(() => window.player, key, "emberRest");
    sceneManager.replace(ExplorationScene);
  } catch (e) {
    logSystem("Load failed: " + (e?.message || e));
  }
}
