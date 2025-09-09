import { createMap, TILE, VIEW_W, VIEW_H } from "./game/map.js";
import { Game } from "./game/game.js";
import { attachControls } from "./input/controls.js";
import { Renderer } from "./render/renderer.js";
import { buildTextures } from "./render/textures.js";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Build hand-drawn textures (patterns)
const textures = buildTextures();

const map = createMap();
const game = new Game(map);
const renderer = new Renderer(ctx, TILE, VIEW_W, VIEW_H, textures);

attachControls(game);

let last = performance.now();
function loop(ts) {
  const dt = Math.min(1 / 30, (ts - last) / 1000);
  last = ts;
  game.update(dt);
  renderer.draw(game.state());
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);