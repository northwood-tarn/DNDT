// app/main.js (ESM)
import { attachExitListener, routeTo } from "./engine/sceneRouter.js";
import { emit } from "./engine/events.js";
import "./scenes/index.js";

import { startExplorationRenderer } from "./renderers/explorationRenderer.js";
import { startExplorationSystem } from "./systems/explorationSystem.js";

// === Dev console mirror -> in-game log (bottom pane) ===
(function attachInGameLogMirror() {
  const MAX_LINES = 200;
  const levels = ["log", "info", "warn", "error"];

  // Toggle in-game log visibility with F12
  let logVisible = false;
  window.addEventListener("keydown", (e) => {
    if (e.key === "F12") {
      e.preventDefault();
      const el = document.getElementById("game-log");
      if (!el) return;
      logVisible = !logVisible;
      el.style.display = logVisible ? "block" : "none";
    }
  });

  function append(line) {
    const el = document.getElementById("game-log");
    if (!el) return; // safe if DOM not ready yet
    const lines = el.textContent ? el.textContent.split("\n") : [];
    lines.push(line);
    if (lines.length > MAX_LINES) lines.splice(0, lines.length - MAX_LINES);
    el.textContent = lines.join("\n");
    el.scrollTop = el.scrollHeight;
  }

  levels.forEach((lvl) => {
    const orig = console[lvl].bind(console);
    console[lvl] = (...args) => {
      try {
        const msg = args
          .map((a) => {
            if (a instanceof Error) return a.stack || a.message || String(a);
            if (typeof a === "string") return a;
            try {
              return JSON.stringify(a);
            } catch {
              return String(a);
            }
          })
          .join(" ");
        append(`[${lvl}] ${msg}`);
      } catch {}
      orig(...args);
    };
  });
})();

async function startGame() {
  // Ensure sceneRouter is listening for game:exit events
  try {
    attachExitListener();
  } catch (e) {
    console.warn("sceneRouter attachExitListener failed:", e);
  }

  // Start the exploration domain system early.
  // It subscribes to exploration:* events and emits exploration:ready / exploration:moved.
  try {
    startExplorationSystem();
  } catch (e) {
    console.warn("explorationSystem start failed:", e);
  }

  // Start the exploration renderer event bindings early.
  // It should subscribe to exploration:* events and render once PIXI is ready.
  try {
    startExplorationRenderer();
  } catch (e) {
    console.warn("explorationRenderer start failed:", e);
  }

  // TEMP: Input bypass for exploration movement.
  // If your engine/inputManager is swallowing keys due to focus/DOM capture, this will still drive exploration.
  // Safe: explorationSystem ignores moveIntent unless exploration is active.
  try {
    window.addEventListener(
      "keydown",
      (e) => {
        // Don’t interfere with typing into inputs.
        const tag =
          e.target && e.target.tagName ? String(e.target.tagName).toLowerCase() : "";
        if (tag === "input" || tag === "textarea" || e.target?.isContentEditable) return;

        let dir = null;

        switch (e.key) {
          case "ArrowUp":
            dir = "up";
            break;
          case "ArrowDown":
            dir = "down";
            break;
          case "ArrowLeft":
            dir = "left";
            break;
          case "ArrowRight":
            dir = "right";
            break;

          case "w":
          case "W":
            dir = "up";
            break;
          case "s":
          case "S":
            dir = "down";
            break;
          case "a":
          case "A":
            dir = "left";
            break;
          case "d":
          case "D":
            dir = "right";
            break;
        }

        if (!dir) return;

        e.preventDefault();
        emit("exploration:moveIntent", dir);
        console.info("[main.js] emitted exploration:moveIntent", dir);
      },
      { passive: false }
    );

    console.info("[main.js] TEMP exploration key-bypass active (WASD/Arrows -> exploration:moveIntent)");
  } catch (e) {
    console.warn("[main.js] failed to attach TEMP exploration key-bypass:", e);
  }

  // Hand off to BootScene; Boot/Preload will initialise Pixi and then
  // route on to MainMenuScene once assets are ready.
  console.info("[main.js] Routing to BootScene...");
  routeTo({
    toScene: "boot",
    reason: "boot",
  });

  const markIntroMusicFinished = () => {
    if (window.__dndtIntroMusicFinished) return;
    window.__dndtIntroMusicFinished = true;
    window.dispatchEvent(new CustomEvent("dndt:intro-music-finished"));
  };

  // Intro audio stays here so the music still kicks in on launch.
  const audio = new Audio("./assets/audio/intro_theme.mp3");
  audio.volume = 0.9;
  audio.addEventListener("ended", markIntroMusicFinished, { once: true });
  try {
    await audio.play();
  } catch {
    const unlock = async () => {
      try {
        await audio.play();
      } catch {
        markIntroMusicFinished();
      } finally {
        window.removeEventListener("pointerdown", unlock);
      }
    };
    window.addEventListener("pointerdown", unlock, { once: true });
  }
}

startGame();
