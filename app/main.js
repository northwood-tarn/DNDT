// app/main.js (ESM)
import { attachExitListener, routeTo } from "./engine/sceneRouter.js";
import "./scenes/index.js";

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
