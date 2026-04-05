// IntroScene.js.js
// Minimal router-safe stub. Non-destructive: replace incrementally.
// Lifecycle: init(ctx), enter(params), update(dt), render(g), exit(), destroy().

export default class IntroScene {
  constructor() { this._ctx = null; this._label = 'Intro'; }
  init(ctx) { this._ctx = ctx; console.info('[Scene:init] IntroScene.js'); }
  enter(params={}) { this._params = params; console.info('[Scene:enter] IntroScene.js', params); }
  update(dt) { /* no-op */ }
  render(g) { /* optional: draw a centered label via your renderer */ }
  exit() { console.info('[Scene:exit] IntroScene.js'); }
  destroy() { this._ctx = null; console.info('[Scene:destroy] IntroScene.js'); }
}
