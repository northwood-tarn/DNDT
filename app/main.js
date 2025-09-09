// app/main.js
// Entry point: bootstrap the player, then launch the starting scene.
// If your project uses a different entry scene, adjust the two imports below.

import { bootstrapPlayer } from "./state/bootstrapPlayer.js";
import { sceneManager } from "./engine/sceneManager.js";

async function startGame(){
  // 1) Ensure player is loaded (blueprint + save + derived stats)
  await bootstrapPlayer({ characterId: "aya", saveSlot: "slot-001" });

  // 2) Route to your existing starting screen.
  // Try Dockside area scene first; fall back to ExplorationScene.
  try {
    const mod = await import("./areas/00_dockside/Dockside.js");
    const StartScene = (mod && (mod.default || mod.Docker || mod.Dockside)) || null;
    if (StartScene) {
      sceneManager.start(StartScene, { areaId: "00_dockside" });
      return;
    }
  } catch (e) {
    console.warn("Dockside start not found, falling back:", e);
  }

  try {
    const mod = await import("./scenes/ExplorationScene.js");
    const ExplorationScene = mod.default || mod.ExplorationScene || null;
    if (ExplorationScene){
      sceneManager.start(ExplorationScene, { areaId: "00_dockside" });
      return;
    }
  } catch (e) {
    console.error("Fallback scene failed to load:", e);
  }

  // Absolute last resort: show a minimal message in the shell if available.
  try {
    const { mountCenter, setTop } = await import("./renderer/shellMount.js");
    setTop("Start");
    mountCenter("Failed to locate a start scene. Check app/main.js routing.");
  } catch {}
}

// Kick off
startGame();
