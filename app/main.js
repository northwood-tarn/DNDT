// app/main.js (ESM)
import { attachExitListener, routeTo } from "./engine/sceneRouter.js";
import "./scenes/index.js";

// === Dev console mirror -> in-game log (bottom pane) ===
(function attachInGameLogMirror() {
  const MAX_LINES = 200;
  const levels = ["log", "info", "warn", "error"];

  // Toggle in-game log visibility with F12
  let logVisible = true;
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
        const msg = args.map(a => {
          if (a instanceof Error) return a.stack || a.message || String(a);
          if (typeof a === "string") return a;
          try { return JSON.stringify(a); } catch { return String(a); }
        }).join(" ");
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

  // Hand off to BootScene; Boot/Preload will initialise Pixi and then
  // route on to MainMenuScene once assets are ready.
  console.info("[main.js] Routing to BootScene...");
  routeTo({
    toScene: "boot",
    reason: "boot"
  });

  // Intro audio stays here so the music still kicks in on launch.
  const audio = new Audio("./assets/audio/intro_theme.mp3");
  audio.volume = 0.9;
  try {
    await audio.play();
  } catch {
    const unlock = async () => {
      try {
        await audio.play();
      } finally {
        window.removeEventListener("pointerdown", unlock);
      }
    };
    window.addEventListener("pointerdown", unlock, { once: true });
  }
}

startGame();
