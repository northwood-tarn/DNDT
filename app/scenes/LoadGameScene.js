import { routeTo } from "../engine/sceneRouter.js";
import { createRendererSaveGameClient } from "../state/saveGameClient.js";

const STYLE_ID = "load-game-scene-style";

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    @font-face {
      font-family: "DNDT Source Sans";
      src: url("./assets/fonts/source_sans_3/SourceSans3-Variable.ttf") format("truetype");
      font-style: normal;
      font-weight: 200 900;
      font-display: block;
    }
    @font-face {
      font-family: "DNDT Libre Baskerville";
      src: url("./assets/fonts/libre_baskerville/LibreBaskerville-Italic-Variable.ttf") format("truetype");
      font-style: italic;
      font-weight: 400 700;
      font-display: block;
    }

    .load-game-scene {
      position: absolute;
      inset: 0;
      z-index: 25;
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
      padding: 112px clamp(66px, 7vw, 112px) 42px;
      color: rgba(224, 231, 229, 0.84);
      background: rgba(1, 13, 15, 0.22);
      font-family: "DNDT Source Sans", var(--font-ui);
      -webkit-app-region: drag;
    }

    .load-game-flame {
      position: absolute;
      top: 32px;
      left: 50%;
      width: 46px;
      height: auto;
      transform: translateX(-50%);
      opacity: 0.2;
      animation: load-game-flame-breathe 9s ease-in-out infinite;
      pointer-events: none;
    }
    @keyframes load-game-flame-breathe {
      0%, 100% { opacity: 0.16; }
      50% { opacity: 0.24; }
    }

    .load-game-header {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0;
      margin-bottom: 20px;
    }
    .load-game-heading {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 24px;
      margin: 0;
      color: rgba(137, 174, 168, 0.58);
      font-size: clamp(28px, 3vw, 40px);
      font-weight: 300;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }
    .load-game-heading::before,
    .load-game-heading::after {
      content: "";
      width: clamp(54px, 8vw, 112px);
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(112, 157, 150, 0.42));
    }
    .load-game-heading::after { transform: scaleX(-1); }
    .load-game-body {
      min-height: 0;
      padding: 18px 0 66px;
    }

    .load-game-list {
      width: min(700px, 76vw);
      height: 100%;
      min-height: 0;
      margin: 0 auto;
      padding: 0 14px 0 0;
      overflow-y: auto;
      list-style: none;
      scrollbar-width: thin;
      scrollbar-color: rgba(126, 158, 152, 0.26) transparent;
      -webkit-app-region: no-drag;
    }
    .load-game-list-item + .load-game-list-item {
      margin-top: 22px;
    }
    .load-game-list-item {
      position: relative;
    }
    .load-game-slot {
      appearance: none;
      display: grid;
      grid-template-columns: 87px minmax(0, 1fr);
      gap: clamp(24px, 3.5vw, 44px);
      align-items: center;
      width: 100%;
      height: 120px;
      border: 0;
      border-left: 2px solid transparent;
      border-radius: 0;
      padding: 0 48px 0 0;
      text-align: left;
      color: rgba(180, 194, 191, 0.38);
      background: transparent;
      cursor: pointer;
    }
    .load-game-slot:hover,
    .load-game-slot:focus-visible,
    .load-game-slot.is-selected {
      color: rgba(213, 224, 221, 0.78);
      border-left-color: rgba(128, 169, 162, 0.52);
      background: linear-gradient(90deg, rgba(68, 107, 101, 0.12), transparent 82%);
      outline: none;
    }
    .load-game-history-nav {
      position: absolute;
      top: 50%;
      right: 9px;
      display: flex;
      align-items: center;
      gap: 9px;
      transform: translateY(-50%);
      -webkit-app-region: no-drag;
    }
    .load-game-history-arrow {
      appearance: none;
      position: relative;
      width: 18px;
      height: 18px;
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 50%;
      padding: 0;
      background: rgba(0, 0, 0, 0.12);
      opacity: 0.52;
      cursor: pointer;
    }
    .load-game-history-arrow::before {
      content: "";
      position: absolute;
      inset: 3px;
      border-radius: 50%;
      background: rgba(150, 190, 186, 0.52);
    }
    .load-game-history-arrow.is-left::before { clip-path: inset(0 50% 0 0); }
    .load-game-history-arrow.is-right::before { clip-path: inset(0 0 0 50%); }
    .load-game-history-arrow:hover,
    .load-game-history-arrow:focus-visible {
      opacity: 0.9;
      outline: none;
    }
    .load-game-portrait {
      display: block;
      width: 87px;
      height: 120px;
      object-fit: cover;
      opacity: 0.8;
    }

    .load-game-details { align-self: center; }
    .load-game-heading-line {
      display: flex;
      align-items: baseline;
      gap: 13px;
      margin-bottom: 11px;
    }
    .load-game-name {
      display: block;
      margin: 0;
      color: rgba(235, 240, 239, 0.88);
      font-size: clamp(18px, 2vw, 24px);
      font-weight: 260;
      letter-spacing: 0.025em;
      line-height: 1;
      text-transform: uppercase;
    }
    .load-game-save-type {
      color: rgba(137, 174, 168, 0.48);
      font-size: 9px;
      font-weight: 480;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }
    .load-game-fields {
      display: grid;
      gap: 6px;
      margin: 0;
    }
    .load-game-field {
      display: block;
    }
    .load-game-field-value {
      display: block;
      color: rgba(205, 216, 213, 0.68);
      font-size: clamp(10px, 1vw, 12px);
      font-weight: 330;
      letter-spacing: 0.025em;
    }

    .load-game-action {
      position: fixed;
      right: 48px;
      bottom: 38px;
      z-index: 28;
      appearance: none;
      width: 24px;
      height: 24px;
      border: 1px solid rgba(255, 255, 255, 0.16);
      border-radius: 50%;
      padding: 0;
      background: rgba(0, 0, 0, 0.12);
      opacity: 0.78;
      cursor: pointer;
      -webkit-app-region: no-drag;
    }
    .load-game-action::before {
      content: "";
      position: absolute;
      inset: 3px;
      border-radius: 50%;
      background: rgba(150, 190, 186, 0.58);
    }
    .load-game-action:hover,
    .load-game-action:focus-visible {
      opacity: 0.82;
      outline: none;
    }
    .load-game-empty {
      align-self: center;
      justify-self: center;
      color: rgba(198, 210, 207, 0.48);
      font-family: "DNDT Libre Baskerville", var(--font-prose);
      font-size: 22px;
      font-style: italic;
    }
  `;
  document.head.appendChild(style);
}

export default class LoadGameScene {
  constructor() {
    this.root = document.getElementById("game-root");
    this.container = null;
    this.saves = [];
    this.groups = [];
    this.historyIndices = [];
    this.selectedIndex = 0;
    this.saveClient = createRendererSaveGameClient();
  }

  start() {
    ensureStyles();
    this.loadSaves();
  }

  async loadSaves() {
    try {
      this.saves = await this.saveClient.list();
    } catch (error) {
      console.warn("[LoadGameScene] Failed to list saves:", error);
      this.saves = [];
    }
    this.groups = groupSavesByCharacter(this.saves);
    this.historyIndices = this.groups.map(() => 0);
    this.build();
  }

  build() {
    if (!this.root) return;
    this.container?.remove();
    this.container = document.createElement("section");
    this.container.className = "load-game-scene";
    this.container.innerHTML = `
      <img class="load-game-flame" src="./assets/images/effects/flame-black.png" alt="">
      <header class="load-game-header">
        <h1 class="load-game-heading">Load Game</h1>
      </header>
      <div class="load-game-body">
        <ol class="load-game-list" aria-label="Saved games"></ol>
      </div>
      ${this.groups.length ? '<button class="load-game-action" type="button" aria-label="Load selected game"></button>' : ''}
    `;
    this.root.appendChild(this.container);

    if (!this.groups.length) {
      this.container.querySelector(".load-game-list").innerHTML = '<li class="load-game-empty">No saved games found.</li>';
      return;
    }

    this.container.querySelector(".load-game-action")?.addEventListener("click", () => this.loadSelected());
    this.renderList();
  }

  renderList() {
    const slots = this.container?.querySelector(".load-game-list");
    if (!slots) return;
    slots.innerHTML = "";
    this.groups.forEach((group, index) => {
      const historyIndex = this.historyIndices[index] || 0;
      const save = group.saves[historyIndex];
      const item = document.createElement("li");
      item.className = "load-game-list-item";
      const button = document.createElement("button");
      button.type = "button";
      button.className = `load-game-slot${index === this.selectedIndex ? " is-selected" : ""}`;
      const background = String(save.activeBackgroundId || "wanderer").toLowerCase();
      const portraitSrc = `./character_creator/assets/portraits/cropped/backgrounds/${encodeURIComponent(background)}-negative-ink.png`;
      const className = titleCase(save.activeClassId || "Unknown class");
      const subclass = titleCase(save.activeSubclassId || "No subclass");
      button.innerHTML = `
        <img class="load-game-portrait" src="${escapeAttribute(portraitSrc)}" width="87" height="120" alt="${escapeAttribute(titleCase(background))} background portrait">
        <span class="load-game-details">
          <span class="load-game-heading-line">
            <span class="load-game-name">${escapeHtml(save.activeCharacterName || `Save ${index + 1}`)}</span>
            <span class="load-game-save-type">${escapeHtml(titleCase(save.saveType || "autosave"))}</span>
          </span>
          <span class="load-game-fields">
            ${field("Date", formatDate(save.savedAt))}
            ${field("Location", dotSeparated(save.locationLabel || save.locationAreaId || "Unknown"))}
            ${field("Subclass · Class", `${subclass} · ${className}`)}
          </span>
        </span>
      `;
      button.addEventListener("click", () => {
        this.selectedIndex = index;
        this.renderList();
      });
      item.appendChild(button);
      const historyNav = document.createElement("span");
      historyNav.className = "load-game-history-nav";
      if (index === this.selectedIndex && historyIndex > 0) {
        historyNav.appendChild(this.historyArrow("left", `Newer save for ${save.activeCharacterName}`, () => {
          this.historyIndices[index] -= 1;
          this.renderList();
        }));
      }
      if (index === this.selectedIndex && historyIndex < group.saves.length - 1) {
        historyNav.appendChild(this.historyArrow("right", `Older save for ${save.activeCharacterName}`, () => {
          this.historyIndices[index] += 1;
          this.renderList();
        }));
      }
      item.appendChild(historyNav);
      slots.appendChild(item);
    });
    this.updateSelection();
  }

  historyArrow(direction, label, action) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `load-game-history-arrow is-${direction}`;
    button.setAttribute("aria-label", label);
    button.addEventListener("click", action);
    return button;
  }

  updateSelection() {
    this.container.querySelectorAll(".load-game-slot").forEach((button, index) => {
      button.classList.toggle("is-selected", index === this.selectedIndex);
    });
  }

  async loadSelected() {
    const group = this.groups[this.selectedIndex];
    const selected = group?.saves[this.historyIndices[this.selectedIndex] || 0];
    if (!selected?.slot) return;
    const saveGame = await this.saveClient.load(selected.slot);
    if (!saveGame) return;
    const location = saveGame.world?.location || {};
    routeTo({
      toScene: location.scene || "dialogue",
      reason: "loadGame",
      saveSlot: selected.slot,
      saveGame,
      areaId: location.areaId || undefined,
      entryKnot: location.entryKnot
    });
  }

  cleanup() {
    this.container?.remove();
    this.container = null;
  }

  destroy() { this.cleanup(); }
}

function field(label, value) {
  return `<span class="load-game-field"><span class="load-game-field-value">${escapeHtml(value)}</span></span>`;
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function titleCase(value) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) { return escapeHtml(value); }

function dotSeparated(value) {
  return String(value || "").replace(/\s*[—–]\s*/g, " · ");
}

function groupSavesByCharacter(saves) {
  const groups = new Map();
  for (const save of saves) {
    const key = save.activeCharacterId || String(save.activeCharacterName || save.runId || save.slot).toLowerCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(save);
  }
  return Array.from(groups.entries()).map(([key, entries]) => ({
    key,
    saves: entries.sort((a, b) => Date.parse(b.savedAt || 0) - Date.parse(a.savedAt || 0))
  })).sort((a, b) => Date.parse(b.saves[0]?.savedAt || 0) - Date.parse(a.saves[0]?.savedAt || 0));
}
