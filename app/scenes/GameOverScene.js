import { routeTo } from "../engine/sceneRouter.js";
import { createRendererSaveGameClient } from "../state/saveGameClient.js";

const STYLE_ID = "death-scene-style";
const FADE_OUT_DELAY_MS = 5700;
const RESTORE_DELAY_MS = 8900;

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    @font-face {
      font-family: "Pixel Takhisis";
      src: url("./assets/fonts/pixel_takhisis/Pixel Takhisis.otf") format("opentype");
      font-display: swap;
    }

    .death-scene {
      position: absolute;
      inset: 0;
      z-index: 40;
      display: grid;
      place-items: center;
      overflow: hidden;
      background: rgba(0, 5, 6, 0.72);
      -webkit-app-region: drag;
    }

    .death-scene-title {
      margin: 0;
      color: rgba(137, 174, 168, 0.72);
      font: clamp(50px, 8.4vw, 98px)/1.1 "Pixel Takhisis", fantasy;
      letter-spacing: 0.055em;
      text-align: center;
      text-transform: uppercase;
      opacity: 0;
      animation: death-title-appear 3.2s ease-out forwards;
    }

    @keyframes death-title-appear {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .death-scene-title.is-fading-out {
      animation: death-title-disappear 3.2s ease-in forwards;
    }

    @keyframes death-title-disappear {
      from { opacity: 1; }
      to { opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

export default class GameOverScene {
  constructor() {
    this.root = document.getElementById("game-root");
    this.container = null;
    this.restoreTimer = null;
    this.fadeOutTimer = null;
    this.saveClient = createRendererSaveGameClient();
    this.restorePromise = null;
    this.cleanedUp = false;
  }

  start() {
    ensureStyles();
    this.build();
    this.restorePromise = this.findMostRecentSave();
    this.fadeOutTimer = window.setTimeout(() => {
      this.container?.querySelector(".death-scene-title")?.classList.add("is-fading-out");
    }, FADE_OUT_DELAY_MS);
    this.restoreTimer = window.setTimeout(() => this.restoreMostRecentSave(), RESTORE_DELAY_MS);
  }

  build() {
    if (!this.root) return;
    this.container = document.createElement("section");
    this.container.className = "death-scene";
    this.container.setAttribute("aria-label", "Character death");
    this.container.innerHTML = `<h1 class="death-scene-title">You died</h1>`;
    this.root.appendChild(this.container);
  }

  async findMostRecentSave() {
    const summaries = await this.saveClient.list();
    return [...summaries]
      .filter((save) => save?.slot)
      .sort((left, right) => Date.parse(right.savedAt || 0) - Date.parse(left.savedAt || 0))[0] || null;
  }

  async restoreMostRecentSave() {
    try {
      const summary = await this.restorePromise;
      if (this.cleanedUp) return;
      if (!summary?.slot) {
        routeTo({ toScene: "loadGame", fromScene: "gameOver", reason: "death_no_save" });
        return;
      }

      const saveGame = await this.saveClient.load(summary.slot);
      if (this.cleanedUp || !saveGame) return;
      const location = saveGame.world?.location || {};
      routeTo({
        toScene: location.scene || "dialogue",
        fromScene: "gameOver",
        reason: "death_restore_latest",
        saveSlot: summary.slot,
        saveGame,
        areaId: location.areaId || undefined,
        entryKnot: location.entryKnot,
      });
    } catch (error) {
      console.warn("[GameOverScene] Could not restore the most recent save:", error);
      if (!this.cleanedUp) routeTo({ toScene: "loadGame", fromScene: "gameOver", reason: "death_restore_failed" });
    }
  }

  cleanup() {
    this.cleanedUp = true;
    if (this.fadeOutTimer) window.clearTimeout(this.fadeOutTimer);
    if (this.restoreTimer) window.clearTimeout(this.restoreTimer);
    this.fadeOutTimer = null;
    this.restoreTimer = null;
    this.container?.remove();
    this.container = null;
  }

  destroy() { this.cleanup(); }
}
