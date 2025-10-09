// AreaTransitionScene.js.js
// Minimal router-safe stub. Non-destructive: replace incrementally.
// Lifecycle: init(ctx), enter(params), update(dt), render(g), exit(), destroy().

export default class AreaTransitionScene {
  constructor() { this._ctx = null; this._label = 'AreaTransition'; }
  init(ctx) { this._ctx = ctx; console.info('[Scene:init] AreaTransitionScene.js'); }
  enter(params={}) { this._params = params; console.info('[Scene:enter] AreaTransitionScene.js', params); }
  update(dt) { /* no-op */ }
  render(g) { /* optional: draw a centered label via your renderer */ }
  exit() { console.info('[Scene:exit] AreaTransitionScene.js'); }
  destroy() { this._ctx = null; console.info('[Scene:destroy] AreaTransitionScene.js'); }
}
