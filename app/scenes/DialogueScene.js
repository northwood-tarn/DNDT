// DialogueScene.js.js
// Minimal router-safe stub. Non-destructive: replace incrementally.
// Lifecycle: init(ctx), enter(params), update(dt), render(g), exit(), destroy().

export default class DialogueScene {
  constructor() { this._ctx = null; this._label = 'Dialogue'; }
  init(ctx) { this._ctx = ctx; console.info('[Scene:init] DialogueScene.js'); }
  enter(params={}) { this._params = params; console.info('[Scene:enter] DialogueScene.js', params); }
  update(dt) { /* no-op */ }
  render(g) { /* optional: draw a centered label via your renderer */ }
  exit() { console.info('[Scene:exit] DialogueScene.js'); }
  destroy() { this._ctx = null; console.info('[Scene:destroy] DialogueScene.js'); }
}
