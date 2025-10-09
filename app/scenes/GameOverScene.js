// scenes/GameOverScene.js — text-mode
import { logSystem } from "../engine/log.js";
import { onCommand } from "../engine/inputManager.js";
import { sceneManager } from "../engine/sceneManager.js";
import TitleScene from "./TitleScene.js";

function start() {
  logSystem("=== GAME OVER ===");
  logSystem("Type: restart | quit");
  onCommand((cmd) => {
    if (cmd === "restart") sceneManager.replace(TitleScene);
    if (cmd === "quit") logSystem("Signal host app to exit.");
  });
}

// --- Lifecycle shim (auto-added by validator prep) ---
let __ctx_GameOver = null;
function init(ctx) { __ctx_GameOver = ctx; }
function enter(params = {}) { try { start(params); } catch {} }
function update(dt) { /* no-op */ }
function render(g) { /* no-op */ }
function exit() { /* no-op */ }
function destroy() { __ctx_GameOver = null; }

export default { init, enter, update, render, exit, destroy, start };