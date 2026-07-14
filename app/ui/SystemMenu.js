import { enableFog } from "../engine/foglayer.js";
import { getCurrentSceneName, routeTo } from "../engine/sceneRouter.js";

const STYLE_ID = "dndt-system-menu-style";
const MENU_ID = "dndt-system-menu";

function installStyles() {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    @font-face {
      font-family: "Pixel Takhisis";
      src: url("./assets/fonts/pixel_takhisis/Pixel Takhisis.otf") format("opentype");
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
  `;
  document.head.appendChild(style);
}

export function installSystemMenu() {
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
  };

  const open = () => {
    if (!overlay.hidden) return;
    previousFocus = document.activeElement;
    overlay.hidden = false;
    document.body.classList.add("is-system-menu-open");
    window.requestAnimationFrame(() => menu.querySelector("button")?.focus());
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
    close();
    enableFog();
    window.api?.enterFramedMode?.();
    routeTo({ toScene, fromScene, reason });
  };

  const actions = [
    ["New Game", () => goTo("prologue", "system_menu_new_game")],
    ["Load Game", () => goTo("loadGame", "system_menu_load_game")],
    ["Settings", () => goTo("settings", "system_menu_settings")],
    ["Exit", () => window.api?.quit ? window.api.quit() : window.close()],
  ];

  for (const [label, action] of actions) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", action);
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
