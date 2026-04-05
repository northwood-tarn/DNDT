// app/scenes/BootScene.js

import { routeTo, attachExitListener } from "../engine/sceneRouter.js";

// BootScene
// New-style scene for the sceneRouter.
// Lifecycle: constructor(payload), start(), update(dt), buildDOM(root), teardown().

export default class BootScene {
  constructor(payload = {}) {
    this.payload = payload;
    this._root = null;
    console.info("[BootScene] constructed with payload:", payload);
  }

  start() {
    console.info("[BootScene] start()");

    // Ensure the global game:exit listener is attached once.
    try {
      attachExitListener();
    } catch (e) {
      console.warn("[BootScene] Failed to attach exit listener:", e);
    }

    // Optional: if you ever want a visible boot screen,
    // you can keep the DOM and delay this routeTo call.
    routeTo({
      toScene: "preload",
      reason: "boot",
    });
  }

  // New-style update hook (kept for consistency, even if a no-op here)
  update(_dt) {
    // No per-frame work needed in the boot scene.
  }

  // Called by sceneRouter when it wants this scene to own the DOM.
  buildDOM(rootElement) {
    this._root = rootElement;

    // For now we don't show anything; if you want a boot logo later,
    // you can populate this._root here.
    if (this._root) {
      this._root.innerHTML = "";
    }
  }

  // Cleanup before switching away
  teardown() {
    console.info("[BootScene] teardown()");
    if (this._root) {
      this._root.innerHTML = "";
      this._root = null;
    }
  }
}