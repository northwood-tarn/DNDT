export const sceneManager = {
  currentScene: null,

  init(startScene) {
    try {
      // Ensure exit routing is active for exploration -> combat/dialogue/area transitions
      const { initExitRouter } = require("./flow/ExitRouter.js");
      if (typeof initExitRouter === "function") initExitRouter();
    } catch (e) {
      console.warn("sceneManager: ExitRouter init failed (non-fatal):", e);
    }
    this.replace(startScene);
  },

  replace(sceneModule, data) {
    // cleanup previous scene if present
    try {
      if (this.currentScene && typeof this.currentScene.cleanup === 'function') {
        this.currentScene.cleanup();
      }
    } catch (e) {
      console.warn('scene.cleanup threw:', e);
    }

    this.currentScene = sceneModule;
    try { console.log('🌀 sceneManager.replace →', sceneModule && (sceneModule.name || 'scene')); } catch {}

    if (sceneModule && typeof sceneModule.start === 'function') {
      try {
        sceneModule.start(data);
      } catch (e) {
        console.error('scene.start threw:', e);
      }
    } else {
      console.warn('❌ sceneModule.start is not a function');
    }
  },

  update() {
    if (this.currentScene && typeof this.currentScene.update === 'function') {
      this.currentScene.update();
    }
  },

  render() {
    if (this.currentScene && typeof this.currentScene.render === 'function') {
      this.currentScene.render();
    }
  }
};
