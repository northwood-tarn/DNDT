// app/flow/ExitRouter.js
// Registry-aware routing for exits: exploration_map, dialogue_area, combat_map.

import { sceneManager } from "../engine/sceneManager.js";
import { startCombat } from "./CombatTransition.js";
import { getArea } from "../areas/registry.js";

let _bound = false;

export function initExitRouter() {
  if (_bound) return;
  window.addEventListener('game:exit', (ev) => {
    const exit = ev?.detail || {};
    try { routeExit(exit); } catch (e) { console.error('ExitRouter route error:', e); }
  });
  _bound = true;
  window.addEventListener('game:postCombatOutcome', async (ev) => {
    const { outcome, returnAreaId } = ev.detail || {};
    if (outcome === "victory" && returnAreaId) {
      try {
        const modExp = await import("../scenes/ExplorationScene.js");
        const ExplorationScene = modExp.default || modExp.ExplorationScene || modExp;
        sceneManager.replace(ExplorationScene, { areaId: returnAreaId });
      } catch (e) {
        console.warn("ExitRouter: failed to return to exploration after combat:", e);
      }
    }
  });

}

// Direct call API
export async function routeExit(exit) {
  if (!exit) return;

  // Explicit scene overrides
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

  if (exit.toScene === "dialogue") {
    try {
      try {
      const mod = await import("../scenes/DialogueScene.js");
      const ExplorationDialogue = mod.default || mod.ExplorationDialogue || mod.DialogueEngine || mod;
      sceneManager.replace(ExplorationDialogue, { script: exit.dialogue || exit.data || null });
    } catch (e2) {
      console.warn("ExitRouter: dialogue scene not found (ExplorationDialog).");
    }
    } catch (e) {
      console.warn("ExitRouter: failed to load DialogueScene:", e);
    }
    return;
  }

  // Area routing via registry
  if (exit.toArea) {
    const area = getArea(exit.toArea);
    if (!area) {
      console.warn("ExitRouter: toArea not found in registry:", exit.toArea);
      return;
    }
    const entry = { x: exit.entryX, y: exit.entryY };

    try {
      switch (area.kind) {
        case "exploration_map": {
          const modExp = await import("../scenes/ExplorationScene.js");
          const ExplorationScene = modExp.default || modExp.ExplorationScene || modExp;
          const tmj = area.tmj || area.assets?.tmj;
          sceneManager.replace(ExplorationScene, { areaId: exit.toArea, tmj, entry });
          return;
        }
        case "dialogue_area": {
          const modDlg = await import("../scenes/DialogueScene.js");
          const ExplorationDialogue = modDlg.default || modDlg.ExplorationDialogue || modDlg.DialogueEngine || modDlg;
          const script = area.script?.json || area.script;
          sceneManager.replace(ExplorationDialogue, { script, areaId: exit.toArea });
          return;
        }
        case "combat_map": {
          const encounterId = area.encounter?.id || exit.encounter;
          if (!encounterId) { console.warn("ExitRouter: combat_map requires encounter id:", area); return; }
          startCombat({ id: encounterId, name: area.title || "Encounter", returnAreaId: exit.returnAreaId || null });
          return;
        }
        default: {
          const modExp = await import("../scenes/ExplorationScene.js");
          const ExplorationScene = modExp.default || modExp.ExplorationScene || modExp;
          sceneManager.replace(ExplorationScene, { areaId: exit.toArea, entry });
          return;
        }
      }
    } catch (e) {
      console.warn("ExitRouter: scene load failed:", e);
    }
    return;
  }

  console.warn("ExitRouter: exit had no destination", exit);
}
