// app/scenes/ExplorationDialog.js
// Dialogue scene with dynamic fog background.
// Compatibility note: this module exports BOTH an instance (default) with .start()
// and a class (named export). SceneManager that expects `scene.start(...)` will work,
// and SceneManager that wants to instantiate can import { ExplorationDialog } and `new` it.

import { PIXI, getApp } from "../engine/pixi.js";
import { createFogRoller } from "../engine/fogRoller.js";

function setTopTitle(title){
  const top = document.getElementById("top");
  if (top) top.textContent = title || "";
}

class ExplorationDialog {
  constructor() {
    this._fog = null;
    this._overlay = null;
  }

  async start({ script = null, title = "Dialogue" } = {}) {
    const app = await getApp();
    app.stage.sortableChildren = true;
    app.stage.removeChildren();
    setTopTitle(title);

    // Safety: visible faint frame so we know stage is drawing
    const frame = new PIXI.Graphics();
    frame.rect(0,0,app.renderer.width,app.renderer.height).stroke({ color: 0x22314d, width: 1, alpha: 0.25 });
    frame.zIndex = -2000;
    app.stage.addChild(frame);

    // Fog background at back
    this._fog = createFogRoller(app, {
      frames: [
        ["./assets/fog/fog_01.png", "./assets/fog/fog_01.jpeg"],
        ["./assets/fog/fog_02.png", "./assets/fog/fog_02.jpeg"],
        ["./assets/fog/fog_03.png", "./assets/fog/fog_03.jpeg"],
        ["./assets/fog/fog_04.png", "./assets/fog/fog_04.jpeg"],
      ],
      holdTime: 10,
      fadeTime: 5,
      pingPong: true,
      baseDim: 0.32,
      onLog: (m)=>console.log(m)
    });
    await this._fog.start();
    app.stage.addChild(this._fog.container);

    // Overlay layer for future dialogue UI
    this._overlay = new PIXI.Container();
    this._overlay.zIndex = 1000;
    app.stage.addChild(this._overlay);

    // Preload script silently (UI rendering comes next step)
    if (script) {
      try {
        await fetch(script).then(r => r.json());
      } catch (e) {
        console.warn("ExplorationDialog: failed to load dialogue script:", e);
      }
    }
  }

  cleanup(){
    const app = window.app;
    if (this._fog) { try { this._fog.destroy(); } catch {} this._fog = null; }
    if (app) app.stage.removeChildren();
    const top = document.getElementById("top"); if (top) top.textContent = "";
  }
}

// Export both shapes for compatibility:
const explorationDialogSingleton = new ExplorationDialog();
export default explorationDialogSingleton;
export { ExplorationDialog };
