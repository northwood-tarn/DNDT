// renderer.js
// Robust renderer entry that bootstraps the player and launches the start scene,
// handling different sceneManager APIs (start/replace/goto/push) gracefully.

import { bootstrapPlayer } from "./state/bootstrapPlayer.js";
import * as SM from "./engine/sceneManager.js";
import { setTop, mountCenter } from "./renderer/shellMount.js";

// Determine a launch function that works with your sceneManager.
function pickLauncher(sceneManager){
  const cand = ["start", "replace", "goto", "push", "begin", "run"];
  for (const k of cand){
    if (typeof sceneManager[k] === "function"){
      return (Scene, args) => sceneManager[k](Scene, args);
    }
  }
  // Manual last-resort: instantiate and call .start if present
  return (Scene, args) => {
    try {
      const instance = new Scene(args || {});
      if (typeof instance.start === "function") {
        instance.start(args || {});
      } else {
        console.warn("[renderer] No sceneManager API found; started scene instance without lifecycle.");
      }
    } catch (e){
      console.error("[renderer] Fallback launch failed:", e);
      throw e;
    }
  };
}
const sceneManager = (SM && (SM.default || SM)) || SM;
const launch = pickLauncher(sceneManager);

function el(html){
  const d = document.createElement('div');
  d.innerHTML = html;
  return d.firstElementChild || d;
}
function showFatal(message, details){
  try {
    setTop("Error");
    const node = el([
      '<div style="padding:10px; line-height:1.5">',
      `<h3 style="margin:0 0 8px 0">Renderer error</h3>`,
      `<div>${message}</div>`,
      details ? `<pre style="margin-top:8px; font-size:.85rem; white-space:pre-wrap">${details}</pre>` : '',
      '</div>'
    ].join(""));
    mountCenter(node);
  } catch (e) {
    console.error("[renderer] fatal:", message, details, e);
  }
}

async function startRenderer(){
  try {
    await bootstrapPlayer({ characterId: "aya", saveSlot: "slot-001" });
    console.log("[renderer] bootstrap complete");
  } catch (e) {
    showFatal("Failed to bootstrap player.", String(e?.stack || e));
    return;
  }

  try {
    const mod = await import("./areas/00_dockside/Dockside.js");
    const StartScene = (mod && (mod.default || mod.Dockside)) || null;
    if (StartScene) {
      console.log("[renderer] launching Dockside with API:", Object.keys(sceneManager).filter(k => typeof sceneManager[k]==='function').join(", "));
      launch(StartScene, { areaId: "00_dockside" });
      return;
    }
  } catch (e) {
    console.warn("[renderer] Dockside start failed, trying ExplorationScene", e);
  }

  try {
    const mod = await import("./scenes/ExplorationScene.js");
    const ExplorationScene = mod.default || mod.ExplorationScene || null;
    if (ExplorationScene){
      console.log("[renderer] launching Exploration fallback");
      launch(ExplorationScene, { areaId: "00_dockside" });
      return;
    }
  } catch (e) {
    showFatal("Could not start any scene.", String(e?.stack || e));
    return;
  }
}

window.addEventListener('error', (e) => {
  showFatal("Unhandled error", String(e?.error?.stack || e?.message || e));
});
window.addEventListener('unhandledrejection', (e) => {
  showFatal("Unhandled promise rejection", String(e?.reason?.stack || e?.reason || e));
});

if (document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', startRenderer, { once: true });
} else {
  startRenderer();
}
