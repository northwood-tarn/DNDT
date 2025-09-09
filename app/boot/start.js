// app/boot/start.js
// Boot with a DEV_QUICKSTART toggle. When enabled, jump straight to DocksideIntro
// with a bootstrapped Fighter (AYA) loaded via bootstrapPlayer and a full skills table.

import TitleMenuScene from "../scenes/TitleMenuScene.js";
import DocksideIntro from "../areas/00_dockside/Dockside.js";
import { dispatch } from "../engine/inputManager.js";
import { sceneManager } from "../engine/sceneManager.js";
import { state } from "../state/stateStore.js";
import { bootstrapPlayer } from "../state/bootstrapPlayer.js"; // ← NEW: ensure player exists

const DEV_QUICKSTART = true; // flip to false to restore normal Title Menu flow

function wireKeyboard() {
  const map = new Map([
    ["ArrowUp", "up"], ["ArrowDown", "down"], ["ArrowLeft", "left"], ["ArrowRight", "right"],
    ["w", "up"], ["s", "down"], ["a", "left"], ["d", "right"],
    ["W", "up"], ["S", "down"], ["A", "left"], ["D", "right"],
    ["Enter", "confirm"], ["Escape", "back"]
  ]);
  window.addEventListener("keydown", (e) => {
    const cmd = map.get(e.key);
    if (!cmd) return;
    e.preventDefault();
    try { dispatch(cmd); } catch {}
  });
}

// Pick a scene launch function your manager supports (start/replace/goto/push)
const launch =
  (typeof sceneManager.start === "function" && sceneManager.start.bind(sceneManager)) ||
  (typeof sceneManager.replace === "function" && sceneManager.replace.bind(sceneManager)) ||
  (typeof sceneManager.goto === "function" && sceneManager.goto.bind(sceneManager)) ||
  (typeof sceneManager.push === "function" && sceneManager.push.bind(sceneManager)) ||
  ((Scene, args) => {
    // Last-resort: many scenes in this codebase are plain objects with start()
    if (Scene && typeof Scene.start === "function") return Scene.start(args || {});
    // If it happens to be a constructor, try instantiating
    try {
      const inst = new Scene(args || {});
      if (typeof inst.start === "function") return inst.start(args || {});
      return inst;
    } catch (e) {
      console.error("No usable scene launch API found.", e);
    }
  });

async function start() {
  wireKeyboard();

  // 1) Ensure player exists before any scene runs (no more manual seedAya)
  try {
    await bootstrapPlayer({ characterId: "aya", saveSlot: "slot-001" });
  } catch (e) {
    console.error("[boot] bootstrapPlayer failed; falling back to Title Menu", e);
    return TitleMenuScene.start ? TitleMenuScene.start() : launch(TitleMenuScene, {});
  }

  // 2) Normal flow managed by the engine
  if (DEV_QUICKSTART) {
    try {
      // Jump straight into the intro scene using the engine's launcher
      launch(DocksideIntro, { areaId: "00_dockside" });
      return;
    } catch (e) {
      console.error("Failed to start DocksideIntro, falling back to Title Menu", e);
      return TitleMenuScene.start ? TitleMenuScene.start() : launch(TitleMenuScene, {});
    }
  }

  // 3) Title menu flow
  return TitleMenuScene.start ? TitleMenuScene.start() : launch(TitleMenuScene, {});
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => { start(); }, { once: true });
} else {
  start();
}
