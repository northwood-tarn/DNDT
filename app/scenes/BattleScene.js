// BattleScene.js.js
// Minimal router-safe stub. Non-destructive: replace incrementally.
// Lifecycle: init(ctx), enter(params), update(dt), render(g), exit(), destroy().

export default class BattleScene {
  constructor() { this._ctx = null; this._label = 'Battle'; }
  init(ctx) { this._ctx = ctx; console.info('[Scene:init] BattleScene.js'); }
  enter(params={}) { this._params = params; console.info('[Scene:enter] BattleScene.js', params); }
  update(dt) { /* no-op */ }
  render(g) { /* optional: draw a centered label via your renderer */ }
  exit() { console.info('[Scene:exit] BattleScene.js'); }
  destroy() { this._ctx = null; console.info('[Scene:destroy] BattleScene.js'); }
}
