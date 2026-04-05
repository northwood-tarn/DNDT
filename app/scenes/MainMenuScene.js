// app/scenes/MainMenuScene.js
import { routeTo } from "../engine/sceneRouter.js";
import SaveManager from "./SaveManager.js";
import { ensureDevAyaSlot99 } from "../data/devSaves.js";

export default class MainMenuScene {
  constructor(game, payload = {}) {
    this.game = game;
    this.payload = payload;
    this.root = document.getElementById("game-root");
    this.container = null;

    console.log("[MainMenuScene] constructed with payload:", payload);
  }

  start() {
    console.log("[MainMenuScene] start()");
    this.teardown(); // in case of re-entry
    this.buildDOM();
  }

  // Called by sceneRouter when switching away (if wired later)
  destroy() {
    console.log("[MainMenuScene] destroy()");
    this.teardown();
  }

  // ----- DOM construction ---------------------------------------------------

  buildDOM() {
    if (!this.root) {
      console.error("[MainMenuScene] #game-root not found");
      return;
    }

    // outer flex container
    const el = document.createElement("div");
    el.className = "main-menu-root";
    Object.assign(el.style, {
      position: "absolute",
      inset: "0",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "radial-gradient(circle at top, #132035 0, #05070b 60%)",
      color: "#e6e6e6",
      fontFamily: 'ui-monospace, Menlo, Monaco, Consolas, "Courier New", monospace'
    });

    const frame = document.createElement("div");
    Object.assign(frame.style, {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "16px"
    });

    // Poster/title area
    const titleBox = document.createElement("div");
    Object.assign(titleBox.style, {
      width: "420px",
      height: "600px",
      borderRadius: "8px",
      border: "1px solid #243552",
      background:
        "linear-gradient(to bottom, #121f33 0%, #030508 80%)",
      boxShadow: "0 0 32px rgba(0,0,0,0.7)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      textAlign: "center",
      padding: "24px",
      boxSizing: "border-box"
    });

    const h1 = document.createElement("div");
    h1.textContent = "";
    Object.assign(h1.style, {
      letterSpacing: ".18em",
      fontSize: "20px",
      fontWeight: "700",
      marginBottom: "12px",
      color: "#9bb7ff"
    });

    const h2 = document.createElement("div");
    h2.textContent = "";
    Object.assign(h2.style, {
      letterSpacing: ".28em",
      fontSize: "14px",
      fontWeight: "700",
      color: "#7fa2ff"
    });

    titleBox.appendChild(h1);
    titleBox.appendChild(h2);

    // Splash image below headings
    const splashImg = document.createElement("img");
    splashImg.src = "./assets/images/mainscreen.png"; // adjust if needed
    Object.assign(splashImg.style, {
      width: "100%",
      height: "auto",
      borderRadius: "6px",
      marginTop: "16px"
    });
    titleBox.appendChild(splashImg);

    // Button row
    const row = document.createElement("div");
    Object.assign(row.style, {
      marginTop: "18px",
      display: "flex",
      gap: "12px",
      justifyContent: "center"
    });

    const makeButton = (label, onClick) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = label;
      btn.className = "btn-main-menu";
      Object.assign(btn.style, {
        minWidth: "130px",
        padding: "8px 16px",
        background: "#162234",
        color: "#e6e6e6",
        border: "1px solid #2d3b5e",
        borderRadius: "6px",
        cursor: "pointer",
        fontSize: "13px"
      });
      btn.addEventListener("mouseenter", () => {
        btn.style.background = "#1b2a42";
      });
      btn.addEventListener("mouseleave", () => {
        btn.style.background = "#162234";
      });
      btn.addEventListener("click", onClick);
      return btn;
    };

    // Wire up actions – we can refine destinations later.
    const newGameBtn = makeButton("New Game", () => {
      console.log("[MainMenuScene] New Game");
      // go to character creation / select
      routeTo({ toScene: "characterSelect", reason: "newGame" });
    });

    const loadBtn = makeButton("Load Game", () => {
      console.log("[MainMenuScene] Load Game");
      routeTo({ toScene: "loadGame", reason: "fromMainMenu" });
    });

    const settingsBtn = makeButton("Settings", () => {
      console.log("[MainMenuScene] Settings");
      routeTo({ toScene: "settings", reason: "fromMainMenu" });
    });

    const quitBtn = makeButton("Quit", () => {
      console.log("[MainMenuScene] Quit requested");
      // If you have an Electron bridge, call it; otherwise just log.
      if (window.api?.quitGame) {
        window.api.quitGame();
      } else {
        console.warn("[MainMenuScene] quitGame bridge not available");
      }
    });

    const quickStartBtn = makeButton("Quick Start (Aya)", () => {
      console.log("[MainMenuScene] Quick Start (Aya) clicked");

      // Ensure dev save slot 99 exists and load from it
      const save = ensureDevAyaSlot99(SaveManager);
      if (!save || !save.payload) {
        console.error("[MainMenuScene] Failed to ensure/load dev slot 99", save);
        return;
      }

      const { location } = save.payload;

      routeTo({
        toScene: "dialogue",
        reason: "devQuickStartAya",
        areaId: location?.areaId || "dockside",
        entryKnot: location?.entryKnot || "start",
        saveId: save.saveId
      });
    });

    row.appendChild(newGameBtn);
    row.appendChild(loadBtn);
    row.appendChild(settingsBtn);
    row.appendChild(quitBtn);

    // Dev button in separate row to avoid clutter
    const devRow = document.createElement("div");
    Object.assign(devRow.style, {
      marginTop: "6px",
      display: "flex",
      justifyContent: "center"
    });
    Object.assign(quickStartBtn.style, {
      borderStyle: "dashed",
      borderColor: "#4b6ad8"
    });
    devRow.appendChild(quickStartBtn);

    frame.appendChild(titleBox);
    frame.appendChild(row);
    frame.appendChild(devRow);

    el.appendChild(frame);
    this.root.appendChild(el);
    this.container = el;

    console.log("[MainMenuScene] DOM built");
  }

  teardown() {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
  }
}