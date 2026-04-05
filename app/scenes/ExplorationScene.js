// app/scenes/ExplorationScene.js
//
// Exploration scene orchestrator.
// - Validates the canonical Area contract (kind + assets)
// - Loads the TMJ map JSON
// - Emits exploration domain events for renderers/systems
// - Does not render DOM UI or perform PIXI rendering directly

import { emit } from "../engine/events.js";
import { attachExitListener } from "../engine/sceneRouter.js";
import { getArea } from "../areas/index.js";
import { clearCenter } from "../ui/layout.js";

let currentAreaId = null;

const ExplorationScene = {
  async start(payload = {}) {
    clearCenter();

    const areaId = payload.areaId;
    if (!areaId) {
      console.error("[ExplorationScene] Missing required areaId in payload.");
      return;
    }

    const area = getArea(areaId);
    if (!area) {
      console.error("[ExplorationScene] Unknown area:", areaId);
      return;
    }

    if (area.kind !== "exploration_map") {
      console.error(
        "[ExplorationScene] Refusing to start: area is not exploration_map:",
        areaId,
        "kind=",
        area.kind
      );
      return;
    }

    const tmjPath = area.assets?.tmj;
    if (typeof tmjPath !== "string" || !tmjPath.trim()) {
      console.error(
        "[ExplorationScene] exploration_map missing area.assets.tmj:",
        areaId,
        area.assets
      );
      return;
    }

    // Debug + contract enforcement: TMJ is already JSON; callers must provide the real .tmj path.
    console.info("[ExplorationScene] Using TMJ:", tmjPath, "for area:", areaId);
    if (!/\.tmj(\?|#|$)/i.test(tmjPath) || /\.tmj\.json(\?|#|$)/i.test(tmjPath)) {
      console.error(
        "[ExplorationScene] Invalid TMJ asset path (must be a .tmj file, not .tmj.json):",
        tmjPath,
        "area.assets=",
        area.assets
      );
      return;
    }

    currentAreaId = areaId;

    try {
      attachExitListener();
    } catch (e) {
      console.warn("[ExplorationScene] attachExitListener failed (continuing):", e);
    }

    // Hand off to the exploration domain system. It owns map loading, player spawn,
    // collision rules, triggers, and emits exploration:ready / exploration:moved.
    emit("exploration:enter", { areaId, area, tmj: tmjPath });
  },

  cleanup() {
    if (currentAreaId) {
      emit("exploration:exit", { areaId: currentAreaId });
    }
    currentAreaId = null;
  },
};

export default ExplorationScene;