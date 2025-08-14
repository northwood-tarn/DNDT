// scenes/GameOverScene.js — text-mode
import { logSystem } from "../engine/log.js";
import { onCommand } from "../engine/inputManager.js";
import { sceneManager } from "../engine/sceneManager.js";
import TitleScene from "./TitleScene.js";

function start() {
  logSystem("=== GAME OVER ===");
  logSystem("Type: restart | quit");
  onCommand((cmd)=>{
    if (cmd === "restart") sceneManager.replace(TitleScene);
    if (cmd === "quit") logSystem("Signal host app to exit.");
  });
}

export default { start };
