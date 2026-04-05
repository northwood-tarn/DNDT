import { routeTo } from '../engine/sceneRouter.js';
import { getApp } from '../engine/pixi.js';
import { ensureFogLayer } from '../engine/foglayer.js';

// PreloadScene.js.js
// Minimal router-safe stub. Non-destructive: replace incrementally.
// Lifecycle: init(ctx), enter(params), update(dt), render(g), exit(), destroy().

export default class PreloadScene {
  constructor(ctx) {
    this._ctx = ctx;
    this._label = 'Preload';
    this._params = {};
    console.info('[Scene:init] PreloadScene.js');
  }

  // Optional legacy init hook (kept for compatibility, but no longer used by the router)
  init(ctx) {
    this._ctx = ctx;
    console.info('[Scene:init:init] PreloadScene.js (legacy init)');
  }

  async start(params = {}) {
    this._params = params;
    console.info('[PreloadScene] start()', params);

    // Engine init point: ensure the shared PIXI app exists, then attach the global fog layer once.
    // This scene should not own any PIXI state beyond calling the engine modules.
    try {
      const app = await getApp();
      await ensureFogLayer(app);
    } catch (e) {
      console.warn('[PreloadScene] Failed to init PIXI app and/or fog layer:', e);
      // Non-fatal: keep routing so the game remains usable even if fog assets fail.
    }

    routeTo({
      toScene: 'mainMenu',
      reason: params.reason || 'boot',
      fromScene: 'preload',
    });
  }

  update(dt) {
    // no-op for now
  }

  render(g) {
    // optional: draw a centered label via your renderer
  }

  exit() {
    console.info('[Scene:exit] PreloadScene.js');
  }

  destroy() {
    this._ctx = null;
    this._params = {};
    console.info('[Scene:destroy] PreloadScene.js');
  }
}
