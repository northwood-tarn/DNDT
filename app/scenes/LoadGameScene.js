import { routeTo } from "../engine/sceneRouter.js";
import { createRendererSaveGameClient } from "../state/saveGameClient.js";

export default class LoadGameScene {
  constructor() {
    this._ctx = null;
    this._label = "LoadGame";
    this._rootEl = null;
    this._params = null;
    this._saves = [];
    this._saveClient = createRendererSaveGameClient();
  }

  init(ctx) {
    this._ctx = ctx;
    console.info("[Scene:init] LoadGameScene");
  }

  enter(params = {}) {
    this._params = params;
    console.info("[Scene:enter] LoadGameScene", params);

    this._loadSaves();
  }

  async _loadSaves() {
    try {
      this._saves = await this._saveClient.list();
    } catch (error) {
      console.warn("[LoadGameScene] Failed to list saves:", error);
      this._saves = [];
    }
    this._buildUi();
  }

  _buildUi() {
    let container = document.getElementById("center");
    if (!container) container = document.body;

    container.innerHTML = "";

    const root = document.createElement("div");
    root.className = "load-game-scene";

    const header = document.createElement("h1");
    header.textContent = "Load Game";
    root.appendChild(header);

    if (!this._saves.length) {
      const p = document.createElement("p");
      p.textContent = "No saved games found.";
      root.appendChild(p);

      const backBtn = document.createElement("button");
      backBtn.textContent = "Back";
      backBtn.addEventListener("click", () => {
        window.dispatchEvent(new CustomEvent("game:loadCancelled"));
      });
      root.appendChild(backBtn);

      container.appendChild(root);
      this._rootEl = root;
      return;
    }

    const info = document.createElement("p");
    info.textContent =
      "Select a save to continue. Autosaves and quicksaves are unique per run.";
    root.appendChild(info);

    const list = document.createElement("ul");
    list.className = "load-game-list";

    for (const save of this._saves) {
      const saveId = save.slot;
      const li = document.createElement("li");
      li.className = "load-game-item";

      const title = document.createElement("div");
      title.className = "load-game-title";

      const characterName = save.activeCharacterName || "(Unnamed)";
      const characterClass = save.activeClassId || "Unknown Class";
      const level = typeof save.level === "number" ? save.level : "?";

      title.textContent = `${characterName} (${characterClass} ${level})`;
      li.appendChild(title);

      const details = document.createElement("div");
      details.className = "load-game-details";

      const areaId = save.locationAreaId || "Unknown Area";
      const sceneType = save.locationScene || "unknown";

      const timeSpan = document.createElement("span");
      let timeLabel = "Unknown time";
      if (save.savedAt) {
        const d = new Date(save.savedAt);
        if (!Number.isNaN(d.getTime())) {
          timeLabel = d.toLocaleString();
        }
      }

      details.textContent = `${areaId} - ${saveId} - ${timeLabel} - Scene: ${sceneType}`;
      li.appendChild(details);

      const buttons = document.createElement("div");
      buttons.className = "load-game-buttons";

      const loadBtn = document.createElement("button");
      loadBtn.textContent = "Load";
      loadBtn.addEventListener("click", () =>
        this._handleLoadClicked(saveId)
      );
      buttons.appendChild(loadBtn);

      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "Delete";
      deleteBtn.style.marginLeft = "8px";
      deleteBtn.addEventListener("click", () =>
        this._handleDeleteClicked(saveId)
      );
      buttons.appendChild(deleteBtn);

      li.appendChild(buttons);
      list.appendChild(li);
    }

    root.appendChild(list);

    const backBtn = document.createElement("button");
    backBtn.textContent = "Back";
    backBtn.style.marginTop = "16px";
    backBtn.addEventListener("click", () => {
      window.dispatchEvent(new CustomEvent("game:loadCancelled"));
    });
    root.appendChild(backBtn);

    container.appendChild(root);
    this._rootEl = root;
  }

  async _handleLoadClicked(saveId) {
    if (!saveId) return;
    console.info("[LoadGameScene] Load clicked:", saveId);
    const saveGame = await this._saveClient.load(saveId);
    const location = saveGame?.world?.location || {};
    window.dispatchEvent(
      new CustomEvent("game:loadSaveSelected", { detail: { saveId, saveGame } })
    );
    routeTo({
      toScene: location.scene || "dialogue",
      reason: "loadGame",
      saveSlot: saveId,
      saveGame,
      areaId: location.areaId,
      entryKnot: location.entryKnot,
    });
  }

  async _handleDeleteClicked(saveId) {
    if (!saveId) return;
    const confirmed = window.confirm("Delete this save permanently?");
    if (!confirmed) return;

    await this._saveClient.clear(saveId);
    await this._loadSaves();
  }

  update(dt) {
    // No-op: UI is event-driven; nothing to animate here for now.
  }

  render(g) {
    // No-op: all rendering is handled via the DOM. PIXI can stay idle.
  }

  exit() {
    console.info("[Scene:exit] LoadGameScene");
    if (this._rootEl && this._rootEl.parentNode) {
      this._rootEl.parentNode.removeChild(this._rootEl);
    }
    this._rootEl = null;
    this._params = null;
  }

  destroy() {
    this._ctx = null;
    console.info("[Scene:destroy] LoadGameScene");
  }
}
