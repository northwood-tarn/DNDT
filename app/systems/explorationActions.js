// systems/explorationActions.js — text-mode
import { logSystem } from "../engine/log.js";
import { onCommand } from "../engine/inputManager.js";
import { savePlayer, loadPlayer, getCharacterSaveKeys } from "./saveSystem.js";
import { state } from "../state/stateStore.js";

export function showExplorationActions() {
  logSystem("=== Actions ===");
  logSystem("Type: quicksave | load <ember|preCombat|quickSave> | cancel");
  const off = onCommand((raw) => {
    const [cmd, arg] = String(raw).trim().split(/\s+/, 2);
    if (cmd === "quicksave") {
      try { savePlayer(state.player, "quickSave"); logSystem("Quick-saved."); } catch(e) { logSystem("Save failed."); }
    } else if (cmd === "load") {
      const slot = arg || "emberRest";
      try { loadPlayer(() => state.player, state.player?.name || "Player", slot); logSystem("Loaded " + slot); } catch(e) { logSystem("Load failed."); }
    } else if (cmd === "cancel") {
      off(); logSystem("Closed actions.");
    }
  });
}
