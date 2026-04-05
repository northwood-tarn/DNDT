// scenes/GameOverScene.js — DOM-based scene class
import { sceneManager } from "../engine/sceneManager.js";
import MainMenuScene from "./MainMenuScene.js";
import LoadGameScene from "./LoadGameScene.js";

export default class GameOverScene {
  constructor() {
    this._ctx = null;
    this._label = "GameOver";
    this._rootEl = null;
    this._params = null;
  }

  init(ctx) {
    this._ctx = ctx;
    console.info("[Scene:init] GameOverScene");
  }

  enter(params = {}) {
    this._params = params;
    console.info("[Scene:enter] GameOverScene", params);
    this._buildUi();
  }

  _buildUi() {
    const container = document.getElementById("center") || document.body;
    container.innerHTML = "";

    const root = document.createElement("div");
    root.className = "game-over-scene";

    const title = document.createElement("h1");
    title.textContent = "Game Over";
    root.appendChild(title);

    const message = document.createElement("p");
    message.textContent = this._params.reason || "Your journey ends here.";
    root.appendChild(message);

    const buttonsDiv = document.createElement("div");
    buttonsDiv.className = "game-over-buttons";

    const loadBtn = document.createElement("button");
    loadBtn.textContent = "Load Game";
    loadBtn.addEventListener("click", () => {
      sceneManager.replace(LoadGameScene);
    });
    buttonsDiv.appendChild(loadBtn);

    const mainMenuBtn = document.createElement("button");
    mainMenuBtn.textContent = "Main Menu";
    mainMenuBtn.addEventListener("click", () => {
      sceneManager.replace(MainMenuScene);
    });
    buttonsDiv.appendChild(mainMenuBtn);

    const quitBtn = document.createElement("button");
    quitBtn.textContent = "Quit";
    quitBtn.addEventListener("click", () => {
      if (window.api && typeof window.api.quit === "function") {
        window.api.quit();
      } else {
        try {
          window.close();
        } catch {}
      }
    });
    buttonsDiv.appendChild(quitBtn);

    root.appendChild(buttonsDiv);
    container.appendChild(root);
    this._rootEl = root;
  }

  update(dt) {
    // No per-frame updates needed
  }

  render(g) {
    // Rendering handled via DOM
  }

  exit() {
    console.info("[Scene:exit] GameOverScene");
    if (this._rootEl && this._rootEl.parentNode) {
      this._rootEl.parentNode.removeChild(this._rootEl);
    }
    this._rootEl = null;
    this._params = null;
  }

  destroy() {
    console.info("[Scene:destroy] GameOverScene");
    this._ctx = null;
  }
}