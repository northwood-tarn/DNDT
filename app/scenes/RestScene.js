// RestScene.js.js
// Minimal router-safe stub. Non-destructive: replace incrementally.
// Lifecycle: init(ctx), enter(params), update(dt), render(g), exit(), destroy().

export default class RestScene {
  constructor() { this._ctx = null; this._label = 'Rest'; }
  init(ctx) { this._ctx = ctx; console.info('[Scene:init] RestScene.js'); }
  enter(params={}) { this._params = params; console.info('[Scene:enter] RestScene.js', params); }
  update(dt) { /* no-op */ }
  render(g) { /* optional: draw a centered label via your renderer */ }
  exit() { console.info('[Scene:exit] RestScene.js'); }
  destroy() { this._ctx = null; console.info('[Scene:destroy] RestScene.js'); }
}
