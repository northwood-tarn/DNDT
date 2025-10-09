// app/boot/startAtArea.js
import { sceneManager } from "../engine/sceneManager.js";
import { getArea } from "../areas/registry.js";

export async function startAtArea(areaId){
  const area = getArea(areaId);
  if (!area) { console.error("[startAtArea] Unknown area:", areaId); return; }

  try {
    switch (area.kind) {
      case "exploration_map": {
        const { default: ExplorationScene } = await import("../scenes/ExplorationScene.js");
        const tmj = area.tmj || area.assets?.tmj;
        return sceneManager.replace(ExplorationScene, { areaId, tmj });
      }
      case "dialogue_area": {
        const { default: DialogExploreScene } = await import("../scenes/DialogExploreScene.js");
        const script = area.script?.json || area.script;
        return sceneManager.replace(DialogExploreScene, { areaId, script });
      }
      case "combat_map": {
        const { startCombat } = await import("../engine/flow/CombatTransition.js");
        return startCombat({ id: area.encounter?.id, returnAreaId: area.returnAreaId || null });
      }
      default: {
        const { default: ExplorationScene } = await import("../scenes/ExplorationScene.js");
        return sceneManager.replace(ExplorationScene, { areaId });
      }
    }
  } catch (e) {
    console.error("[startAtArea] failed to start:", e);
  }
}

// Optional utility for console
try { window.startAtArea = startAtArea; } catch {}
