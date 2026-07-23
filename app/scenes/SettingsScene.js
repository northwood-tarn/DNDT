import { routeTo } from "../engine/sceneRouter.js";

const STYLE_ID = "settings-scene-style";
const STORAGE_KEY = "dndt.settings";
const DEFAULTS = Object.freeze({ master: 1, music: 0.9, effects: 0.9, fullscreen: false, audioBuses: {} });

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

    .settings-scene {
      position: absolute;
      inset: 0;
      z-index: 25;
      display: grid;
      grid-template-rows: auto 1fr;
      padding: 112px clamp(66px, 7vw, 112px) 48px;
      color: rgba(203, 218, 214, 0.72);
      background: rgba(1, 13, 15, 0.22);
      font-family: "DNDT Source Sans", var(--font-ui);
      -webkit-app-region: drag;
    }

    .settings-flame {
      position: absolute;
      top: 32px;
      left: 50%;
      width: 46px;
      height: auto;
      transform: translateX(-50%);
      opacity: 0.2;
      animation: settings-flame-breathe 9s ease-in-out infinite;
      pointer-events: none;
    }
    @keyframes settings-flame-breathe {
      0%, 100% { opacity: 0.16; }
      50% { opacity: 0.24; }
    }

    .settings-heading {
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
    .settings-heading::before,
    .settings-heading::after {
      content: "";
      width: clamp(54px, 8vw, 112px);
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(112, 157, 150, 0.42));
    }
    .settings-heading::after { transform: scaleX(-1); }

    .settings-controls {
      align-self: center;
      justify-self: center;
      width: min(440px, 70vw);
      margin-top: -24px;
      -webkit-app-region: no-drag;
    }
    .settings-row {
      display: grid;
      grid-template-columns: 112px minmax(0, 1fr) 42px;
      align-items: center;
      gap: 20px;
      min-height: 54px;
      border-bottom: 1px solid rgba(124, 158, 151, 0.10);
    }
    .settings-label,
    .settings-value {
      font-size: 14px;
      font-weight: 400;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .settings-value {
      color: rgba(166, 190, 185, 0.44);
      text-align: right;
    }
    .settings-range {
      appearance: none;
      width: 100%;
      height: 16px;
      margin: 0;
      padding: 0;
      border: 0;
      border-radius: 0;
      background: transparent;
      box-shadow: none;
      outline: none;
      cursor: pointer;
    }
    .settings-range::-webkit-slider-runnable-track {
      height: 3px;
      background: rgba(143, 177, 171, 0.34);
    }
    .settings-range::-webkit-slider-thumb {
      appearance: none;
      width: 12px;
      height: 12px;
      margin-top: -4.5px;
      border: 1px solid rgba(157, 190, 184, 0.48);
      border-radius: 50%;
      background: rgba(91, 132, 125, 0.82);
    }

    .settings-fullscreen {
      grid-column: 3;
      justify-self: end;
      appearance: none;
      width: 18px;
      height: 18px;
      border: 1px solid rgba(143, 177, 171, 0.34);
      border-radius: 50%;
      padding: 0;
      background: transparent;
      box-shadow: none;
      outline: none;
      opacity: 0.58;
      cursor: pointer;
    }
    .settings-fullscreen::before {
      content: "";
      display: block;
      width: 10px;
      height: 10px;
      margin: 3px;
      border-radius: 50%;
      background: rgba(150, 190, 186, 0.54);
      opacity: 0;
    }
    .settings-fullscreen[aria-pressed="true"]::before { opacity: 1; }

    .settings-information {
      min-height: 44px;
      margin: 18px 0 0 132px;
      color: rgba(166, 190, 185, 0.38);
      font-size: 12px;
      font-weight: 400;
      line-height: 1.45;
      letter-spacing: 0.025em;
    }

    .settings-close {
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
    .settings-close::before {
      content: "";
      position: absolute;
      inset: 3px;
      border-radius: 50%;
      background: rgba(150, 190, 186, 0.58);
    }
  `;
  document.head.appendChild(style);
}

export default class SettingsScene {
  constructor() {
    this.root = document.getElementById("game-root");
    this.container = null;
    this.params = {};
    this.settings = readSettings();
  }

  start(params = {}) {
    this.params = params;
    ensureStyles();
    this.build();
  }

  build() {
    if (!this.root) return;
    this.container = document.createElement("section");
    this.container.className = "settings-scene";
    this.container.innerHTML = `
      <img class="settings-flame" src="./assets/images/effects/flame-black.png" alt="">
      <h1 class="settings-heading">Settings</h1>
      <div class="settings-controls">
        ${rangeRow("Master", "master")}
        ${rangeRow("Music", "music")}
        ${rangeRow("Effects", "effects")}
        <div class="settings-row" data-information="Expand the game to fill your screen. Note: this means that you cannot detach and organise your inventory, spell list or other content.">
          <span class="settings-label">Fullscreen</span>
          <button class="settings-fullscreen" type="button" aria-label="Toggle fullscreen" aria-pressed="${this.settings.fullscreen}"></button>
        </div>
        <div class="settings-information" aria-live="polite"></div>
      </div>
      <button class="settings-close" type="button" aria-label="Close settings"></button>
    `;
    this.root.appendChild(this.container);

    for (const key of ["master", "music", "effects"]) {
      const input = this.container.querySelector(`[data-setting="${key}"]`);
      input.value = String(Math.round(this.settings[key] * 100));
      this.updateValue(key, input.value);
      input.addEventListener("input", () => {
        this.settings[key] = Number(input.value) / 100;
        this.updateValue(key, input.value);
        this.persist();
      });
    }

    const information = this.container.querySelector(".settings-information");
    for (const row of this.container.querySelectorAll("[data-information]")) {
      const showInformation = () => { information.textContent = row.dataset.information || ""; };
      const clearInformation = () => { information.textContent = ""; };
      row.addEventListener("mouseenter", showInformation);
      row.addEventListener("mouseleave", clearInformation);
      row.addEventListener("focusin", showInformation);
      row.addEventListener("focusout", clearInformation);
    }

    this.container.querySelector(".settings-fullscreen")?.addEventListener("click", async (event) => {
      this.settings.fullscreen = !this.settings.fullscreen;
      event.currentTarget.setAttribute("aria-pressed", String(this.settings.fullscreen));
      window.api?.setFullscreen?.(this.settings.fullscreen);
      this.persist();
    });

    this.container.querySelector(".settings-close")?.addEventListener("click", () => {
      routeTo({
        toScene: this.params.fromScene || "mainMenu",
        fromScene: "settings",
        reason: "settings_closed"
      });
    });
  }

  updateValue(key, value) {
    const output = this.container?.querySelector(`[data-value="${key}"]`);
    if (output) output.textContent = `${value}%`;
  }

  persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    window.dispatchEvent(new CustomEvent("dndt:settings-changed", { detail: { ...this.settings } }));
  }

  cleanup() {
    this.container?.remove();
    this.container = null;
  }

  destroy() { this.cleanup(); }
}

function rangeRow(label, key) {
  return `<label class="settings-row"><span class="settings-label">${label}</span><input class="settings-range" data-setting="${key}" type="range" min="0" max="100" step="1"><output class="settings-value" data-value="${key}"></output></label>`;
}

function readSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") };
  } catch {
    return { ...DEFAULTS };
  }
}
