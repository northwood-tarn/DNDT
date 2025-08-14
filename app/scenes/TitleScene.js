// scenes/TitleScene.js — text-mode
import { sceneManager } from "../engine/sceneManager.js";
import { onCommand, dispatch } from "../engine/inputManager.js";
import { logSystem } from "../engine/log.js";
import CharacterSelect from "./CharacterSelect.js";

function start() {
  logSystem("=== All Heroes Fight On Alone and In the Dark ===");
  logSystem("Type one of: new | load | settings | quit");

  onCommand((cmd) => {
    if (cmd === "new") {
      logSystem("Starting a new game...");
      sceneManager.replace(CharacterSelect);
    } else if (cmd === "load") {
      logSystem("Load is not implemented yet.");
    } else if (cmd === "settings") {
      logSystem("Settings: (placeholder)");
    } else if (cmd === "quit") {
      logSystem("Quitting (signal to host app).");
      // In Electron, the host app should listen and exit.
    }
  });
}

export default { start };
