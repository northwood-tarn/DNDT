// LoadGameScene.js
// Scene for listing and selecting saved games.
// Uses SaveManager to retrieve saves, but does NOT perform the actual restore.
// Instead, it dispatches `game:loadSaveSelected` with { saveId } so that
// a higher-level controller (ExitRouter / sceneManager) can handle the load.

import SaveManager, {
  SAVE_TYPE_AUTOSAVE,
  SAVE_TYPE_QUICKSAVE,
  SAVE_TYPE_MANUAL
} from "./SaveManager.js";

export default class LoadGameScene {
  constructor() {
    this._ctx = null;
    this._label = "LoadGame";
    this._rootEl = null;
    this._params = null;
    this._saves = [];
  }

  init(ctx) {
    this._ctx = ctx;
    console.info("[Scene:init] LoadGameScene");
  }

  enter(params = {}) {
    this._params = params;
    console.info("[Scene:enter] LoadGameScene", params);

    this._saves = SaveManager.getAllSaves();
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
      const { saveId, saveType, timestamp, metadata } = save;
      const meta = metadata || {};
      const li = document.createElement("li");
      li.className = "load-game-item";

      const title = document.createElement("div");
      title.className = "load-game-title";

      const characterName = meta.characterName || "(Unnamed)";
      const characterClass = meta.characterClass || "Unknown Class";
      const level = typeof meta.level === "number" ? meta.level : "?";

      title.textContent = `${characterName} (${characterClass} ${level})`;
      li.appendChild(title);

      const details = document.createElement("div");
      details.className = "load-game-details";

      const areaId = meta.currentAreaId || "Unknown Area";
      const sceneType = meta.currentSceneType || "unknown";
      const typeLabel = this._labelForSaveType(saveType);

      const timeSpan = document.createElement("span");
      let timeLabel = "Unknown time";
      if (timestamp) {
        const d = new Date(timestamp);
        if (!Number.isNaN(d.getTime())) {
          timeLabel = d.toLocaleString();
        }
      }

      details.textContent = `${areaId} – ${typeLabel} – ${timeLabel} – Scene: ${sceneType}`;
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

  _labelForSaveType(saveType) {
    switch (saveType) {
      case SAVE_TYPE_AUTOSAVE:
        return "Autosave";
      case SAVE_TYPE_QUICKSAVE:
        return "Quicksave";
      case SAVE_TYPE_MANUAL:
        return "Manual Save";
      default:
        return "Unknown Save";
    }
  }

  _handleLoadClicked(saveId) {
    if (!saveId) return;
    console.info("[LoadGameScene] Load clicked:", saveId);
    window.dispatchEvent(
      new CustomEvent("game:loadSaveSelected", { detail: { saveId } })
    );
  }

  _handleDeleteClicked(saveId) {
    if (!saveId) return;
    const confirmed = window.confirm("Delete this save permanently?");
    if (!confirmed) return;

    SaveManager.deleteSave(saveId);
    this._saves = SaveManager.getAllSaves();
    this._buildUi();
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