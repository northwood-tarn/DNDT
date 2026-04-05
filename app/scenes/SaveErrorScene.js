// SaveErrorScene.js.js
// Minimal router-safe stub. Non-destructive: replace incrementally.
// Lifecycle: init(ctx), enter(params), update(dt), render(g), exit(), destroy().

export default class SaveErrorScene {
  constructor() { this._ctx = null; this._label = 'SaveError'; }
  init(ctx) { this._ctx = ctx; console.info('[Scene:init] SaveErrorScene.js'); }
  enter(params={}) { this._params = params; console.info('[Scene:enter] SaveErrorScene.js', params); }
  update(dt) { /* no-op */ }
  render(g) { /* optional: draw a centered label via your renderer */ }
  exit() { console.info('[Scene:exit] SaveErrorScene.js'); }
  destroy() { this._ctx = null; console.info('[Scene:destroy] SaveErrorScene.js'); }
}
