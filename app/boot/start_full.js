// app/boot/start.js
// Boot the Title menu AND wire basic keyboard -> command dispatch for text UI.
import TitleMenuScene from "../scenes/TitleMenuScene.js";
import { dispatch } from "../engine/inputManager.js";

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

function start() {
  wireKeyboard();
  // Show the title menu
  TitleMenuScene.start();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start);
} else {
  start();
}
