// EndingScene.js.js
// Minimal router-safe stub. Non-destructive: replace incrementally.
// Lifecycle: init(ctx), enter(params), update(dt), render(g), exit(), destroy().

export default class EndingScene {
  constructor() { this._ctx = null; this._label = 'Ending'; }
  init(ctx) { this._ctx = ctx; console.info('[Scene:init] EndingScene.js'); }
  enter(params={}) { this._params = params; console.info('[Scene:enter] EndingScene.js', params); }
  update(dt) { /* no-op */ }
  render(g) { /* optional: draw a centered label via your renderer */ }
  exit() { console.info('[Scene:exit] EndingScene.js'); }
  destroy() { this._ctx = null; console.info('[Scene:destroy] EndingScene.js'); }
}
