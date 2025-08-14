// app/scenes/CombatScene.js — minimal combat shell with correct time hooks
import { logSystem } from "../engine/log.js";
import { sceneManager } from "../engine/sceneManager.js";
import * as time from "../systems/timeSystem.js";
import ExplorationScene from "./ExplorationScene.js";

export default {
  start() {
    // Freeze exploration time / oil burn
    time.enterCombat();
    const args = arguments && arguments[1] || {};
    const id = args.encounterId || "unknown_encounter";
    logSystem(`Combat begins: ${id} (time frozen for oil).`);
    logSystem("…(Combat UI/flow goes here — this is a minimal placeholder)…");

    // For now, auto-resolve after one round of combat time for demonstration
    setTimeout(() => {
      time.advanceCombat(1); // 1 round = 6 seconds
      logSystem("Combat ends.");
      this.cleanup();
      // Return to previous exploration area
      const areaId = (args && args.returnAreaId) || 'fields';
      sceneManager.replace(ExplorationScene, { areaId });
    }, 300);
  },
  cleanup() {
    // Unfreeze exploration time
    time.exitCombat();
  }
};
