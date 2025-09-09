// app/sprite_explore_boot.js
// Quick bootstrap that starts the sprite scene on load.
// Works both with and without the shell layout present.

import { startExplorationSpriteScene } from "./scenes/ExplorationSpriteScene.js";

window.addEventListener('DOMContentLoaded', () => {
  startExplorationSpriteScene();
});