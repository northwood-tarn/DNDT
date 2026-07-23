import { enableFog } from "../engine/foglayer.js";
import { getCurrentSceneName, routeTo } from "../engine/sceneRouter.js";
import { audioRuntime } from "../audio/index.js";

const STYLE_ID = "dndt-system-menu-style";
const MENU_ID = "dndt-system-menu";
const SYSTEM_MENU_FONT_URL = new URL("../assets/fonts/pixel_takhisis/Pixel Takhisis.otf", import.meta.url).href;

function installStyles() {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    @font-face {
      font-family: "Pixel Takhisis";
      src: url("${SYSTEM_MENU_FONT_URL}") format("opentype");
      font-display: swap;
    }

    #${MENU_ID} {
      position: fixed;
      inset: 0;
      z-index: 30000;
      display: grid;
      place-items: center;
      background: rgba(0, 10, 12, 0.34);
      -webkit-backdrop-filter: blur(10px);
      backdrop-filter: blur(10px);
      -webkit-app-region: no-drag;
    }

    #${MENU_ID}[hidden] {
      display: none;
    }

    #${MENU_ID} nav {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 18px;
      min-width: 230px;
    }

    #${MENU_ID} button {
      appearance: none;
      width: 100%;
      margin: 0;
      padding: 9px 16px 7px;
      border: 1px solid transparent;
      border-radius: 0;
      background: transparent;
      color: rgba(137, 174, 168, 0.72);
      font: 20px/1.2 "Pixel Takhisis", fantasy;
      letter-spacing: 0.035em;
      text-align: center;
      text-transform: uppercase;
      cursor: pointer;
    }

    #${MENU_ID} button:hover,
    #${MENU_ID} button:focus-visible {
      border-color: rgba(137, 174, 168, 0.72);
      outline: none;
      background: rgba(137, 174, 168, 0.72);
      color: #020809;
    }

    #${MENU_ID} button:disabled,
    #${MENU_ID} button:disabled:hover,
    #${MENU_ID} button:disabled:focus-visible {
      border-color: transparent;
      background: transparent;
      color: rgba(137, 174, 168, 0.22);
      cursor: default;
    }
  `;
  document.head.appendChild(style);
}

export function installSystemMenu(options = {}) {
  if (document.getElementById(MENU_ID)) return;

  installStyles();

  const overlay = document.createElement("div");
  overlay.id = MENU_ID;
  overlay.hidden = true;
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Game menu");

  const menu = document.createElement("nav");
  menu.setAttribute("aria-label", "Game menu options");
  overlay.appendChild(menu);
  document.body.appendChild(overlay);

  let previousFocus = null;

  const close = () => {
    if (overlay.hidden) return;
    overlay.hidden = true;
    document.body.classList.remove("is-system-menu-open");
    if (previousFocus instanceof HTMLElement) previousFocus.focus();
    previousFocus = null;
    audioRuntime.playEvent("UI_CLOSE");
  };

  const open = () => {
    if (!overlay.hidden) return;
    previousFocus = document.activeElement;
    overlay.hidden = false;
    audioRuntime.unlock();
    audioRuntime.playEvent("UI_OPEN");
    document.body.classList.add("is-system-menu-open");
    window.requestAnimationFrame(() => menu.querySelector("button:not(:disabled)")?.focus());
  };

  const toggle = () => {
    if (!overlay.hidden) {
      close();
      return;
    }
    const request = new CustomEvent("dndt:system-menu-request", { cancelable: true });
    if (window.dispatchEvent(request)) open();
  };

  window.addEventListener("dndt:open-system-menu", open);

  const goTo = (toScene, reason) => {
    const fromScene = getCurrentSceneName() || "mainMenu";
    if (toScene === "settings" && fromScene === "settings") {
      close();
      return;
    }
    audioRuntime.playEvent("UI_CONFIRM");
    close();
    enableFog();
    window.api?.enterFramedMode?.();
    routeTo({ toScene, fromScene, reason });
  };

  const actions = options.combat === true
    ? [
        { label: "Load", disabled: true },
        { label: "Save", disabled: true },
        { label: "System", action: () => goTo("settings", "combat_system_menu_settings") },
        { label: "Exit", action: () => window.api?.quit ? window.api.quit() : window.close() },
      ]
    : [
        { label: "New Game", action: () => goTo("prologue", "system_menu_new_game") },
        { label: "Load Game", action: () => goTo("loadGame", "system_menu_load_game") },
        { label: "Settings", action: () => goTo("settings", "system_menu_settings") },
        { label: "Exit", action: () => window.api?.quit ? window.api.quit() : window.close() },
      ];

  for (const item of actions) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = item.label;
    button.disabled = item.disabled === true;
    if (item.action) button.addEventListener("click", item.action);
    menu.appendChild(button);
  }

  if (window.api?.onSystemMenuToggle) {
    window.api.onSystemMenuToggle(toggle);
  } else {
    window.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || event.repeat) return;
      event.preventDefault();
      toggle();
    });
  }

  // Keep scene-level keyboard controls from firing through the modal menu.
  document.addEventListener("keydown", (event) => {
    if (overlay.hidden || event.key === "Tab") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.key === "Escape") close();
  }, true);
}
