// LoadGameScene.js.js
// Minimal router-safe stub. Non-destructive: replace incrementally.
// Lifecycle: init(ctx), enter(params), update(dt), render(g), exit(), destroy().

export default class LoadGameScene {
  constructor() { this._ctx = null; this._label = 'LoadGame'; }
  init(ctx) { this._ctx = ctx; console.info('[Scene:init] LoadGameScene.js'); }
  enter(params={}) { this._params = params; console.info('[Scene:enter] LoadGameScene.js', params); }
  update(dt) { /* no-op */ }
  render(g) { /* optional: draw a centered label via your renderer */ }
  exit() { console.info('[Scene:exit] LoadGameScene.js'); }
  destroy() { this._ctx = null; console.info('[Scene:destroy] LoadGameScene.js'); }
}
