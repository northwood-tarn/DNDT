// app/scenes/ExplorationScene.js
// Pixi exploration scene that resolves map assets via the canonical areas facade.

import { sceneManager } from "../engine/sceneManager.js";
import { createWorldView } from "../renderer/pixiWorldView.js";
import { mountCenter, setTop, clearCenter } from "../renderer/shellMount.js";
import { getArea, DEFAULT_AREA_ID } from "../areas/index.js";

let view = null;

export const ExplorationScene = {
  /**
   * start({ areaId, tmj, title })
   * - If tmj provided, loads that directly.
   * - Else resolves from registry by areaId (default canonical ID with prefix).
   */
  async start({ areaId = DEFAULT_AREA_ID, tmj = null, title = "Exploration" } = {}){
    setTop(title);

    // Resolve TMJ if not explicitly provided
    if (!tmj){
      const area = getArea(areaId);
      if (!area || !area.tmj){
        console.error("[ExplorationScene] Area not found in registry:", areaId, area);
        // Graceful fallback to DEFAULT_AREA_ID if possible
        if (areaId !== DEFAULT_AREA_ID) {
          const fallback = getArea(DEFAULT_AREA_ID);
          if (fallback && fallback.tmj) {
            tmj = fallback.tmj;
          } else {
            return; // nothing we can do; avoids a blank mount
          }
        } else {
          return;
        }
      } else {
        tmj = area.tmj;
      }
    }

    // Host container for Pixi view
    const host = document.createElement("div");
    host.style.width = "fit-content";
    host.style.height = "fit-content";
    mountCenter(host);

    // Create and mount world view
    view = createWorldView({
      width: 608,
      height: 592,
      designScreensHigh: 2.2, // consistent exploration scale across maps
      playerSizePx: 0.027,    // player size as fraction of view height
      speed: 2.6              // tuned movement speed
    });
    await view.mount(host);

    // Load the map
    await view.loadFromTMJ(tmj);
  },

  cleanup(){
    try { view?.destroy(); } catch {}
    view = null;
    try { clearCenter(); } catch {}
  }
};

export default ExplorationScene;
