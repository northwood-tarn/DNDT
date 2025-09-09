// app/engine/flow/ExitRouter.js
// Unified handler for exit objects from exploration.
// Usage:
//   window.dispatchEvent(new CustomEvent('game:exit', { detail: exitObject }));
// Where exitObject may include: { toArea, toScene, encounter, entryX, entryY, once, name, flavor, enemies, returnAreaId }

import { sceneManager } from "../sceneManager.js";
import { startCombat } from "./CombatTransition.js";

let _bound = false;

export function initExitRouter() {
  if (_bound) return;
  window.addEventListener('game:exit', (ev) => {
    const exit = ev?.detail || {};
    try { routeExit(exit); } catch (e) { console.error('ExitRouter route error:', e); }
  });
  _bound = true;
}

// Direct call API too (e.g., from tile interaction code)
export function routeExit(exit) {
  if (!exit) return;

  // Exploration -> Combat
  if (exit.toScene === "combat") {
    startCombat({
      id: exit.encounter || "unknown_encounter",
      name: exit.name || "Encounter",
      flavor: exit.flavor || "",
      enemies: Array.isArray(exit.enemies) ? exit.enemies : [],
      returnAreaId: exit.returnAreaId || null
    });
    return;
  }

  // Exploration -> Dialogue
  if (exit.toScene === "dialogue") {
    const ev = new CustomEvent("dialog:start", { detail: { node: exit.dialog || exit.data || null } });
    window.dispatchEvent(ev);
    return;
  }

  // Area -> Area
  if (exit.toArea) {
    try {
      const { default: ExplorationScene } = require("../../scenes/ExplorationScene.js");
      sceneManager.replace(ExplorationScene, { areaId: exit.toArea, entry: { x: exit.entryX, y: exit.entryY } });
    } catch (e) {
      console.warn("ExitRouter: failed to load ExplorationScene:", e);
    }
    return;
  }

  console.warn("ExitRouter: exit had no destination", exit);
}
