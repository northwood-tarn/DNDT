// app/scenes/ExplorationSpriteScene.js
// Refactored to remove renderer/* dependencies. Uses Pixi+DOM directly.
// NOTE: Minimal world view to get you unstuck. We mount (or create) a Pixi app
// into #center and show a placeholder until the TMJ loader is wired.

import { Assets } from "../utils/Assets.js";

function setTopTitle(title){
  const top = document.getElementById("top");
  if (top) top.textContent = title || "";
}
function mountCenterEl(el){
  const center = document.getElementById("center");
  if (center){
    center.innerHTML = "";
    center.appendChild(el);
  }
}
async function ensurePixiApp({ width=608, height=592 } = {}){
  const PIXI = window.PIXI;
  if (!PIXI) throw new Error("PIXI not found on window. Ensure Pixi v8 is loaded before scenes.");
  if (window.app && window.app.renderer) return window.app;

  const app = new PIXI.Application();
  await app.init({ width, height, backgroundAlpha: 0 });
  window.app = app;
  return app;
}

function placeholderView({ tmj } = {}){
  const wrap = document.createElement("div");
  wrap.style.cssText = "display:flex;flex-direction:column;gap:12px;padding:12px;font-size:0.95rem;";
  const h = document.createElement("div");
  h.textContent = "Exploration";
  h.style.cssText = "font-weight:600;";
  const p = document.createElement("div");
  p.innerHTML = tmj
    ? `Map requested: <code>${typeof tmj === "string" ? tmj : "[object]"}</code><br/>Tile map rendering pending.`
    : "Tile map rendering pending.";
  wrap.appendChild(h);
  wrap.appendChild(p);
  return wrap;
}

export default {
  async start({ tmj = null, title = "Exploration" } = {}){
    setTopTitle(title);

    // Ensure Pixi app and mount its canvas into #center
    const app = await ensurePixiApp({ width: 608, height: 592 });
    const center = document.getElementById("center");
    if (!center) throw new Error("#center mount point missing in DOM.");
    center.innerHTML = "";
    center.appendChild(app.canvas);

    // Clear stage and draw a simple background to confirm rendering
    app.stage.removeChildren();
    const g = new window.PIXI.Graphics();
    g.rect(0,0,608,592).fill({ color: 0x0b1220 });
    g.rect(8,8,592,576).stroke({ color: 0x22314d, width: 1 });
    app.stage.addChild(g);

    // TEMP marker text
    const label = new window.PIXI.Text({
      text: "Exploration view (TMJ loader pending)",
      style: { fill: 0x9bb7ff, fontSize: 16 }
    });
    label.x = 16; label.y = 16;
    app.stage.addChild(label);

    // If TMJ path provided, just echo it in DOM for now (non-blocking)
    const echo = placeholderView({ tmj });
    center.appendChild(echo);
  },
  cleanup(){
    // Keep app alive between scenes for now (faster). Just clear center.
    const center = document.getElementById("center");
    if (center) center.innerHTML = "";
  }
};
