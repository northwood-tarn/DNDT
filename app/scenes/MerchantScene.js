// MerchantScene.js.js
// Minimal router-safe stub. Non-destructive: replace incrementally.
// Lifecycle: init(ctx), enter(params), update(dt), render(g), exit(), destroy().

export default class MerchantScene {
  constructor() { this._ctx = null; this._label = 'Merchant'; }
  init(ctx) { this._ctx = ctx; console.info('[Scene:init] MerchantScene.js'); }
  enter(params={}) { this._params = params; console.info('[Scene:enter] MerchantScene.js', params); }
  update(dt) { /* no-op */ }
  render(g) { /* optional: draw a centered label via your renderer */ }
  exit() { console.info('[Scene:exit] MerchantScene.js'); }
  destroy() { this._ctx = null; console.info('[Scene:destroy] MerchantScene.js'); }
}
