// MapOverlay.js.js
// Minimal modal overlay stub. Opened above a scene; returns focus on close.
// API: open(ctx, params), update(dt), render(g), close()

export default class MapOverlay {
  constructor() { this._ctx = null; this._open = false; this._label = 'Map'; }
  open(ctx, params={}) { this._ctx = ctx; this._open = True; this._params = params; console.info('[Overlay:open] MapOverlay.js', params); }
  update(dt) { /* capture input as needed; Esc to close, etc. */ }
  render(g) { /* draw semi-transparent pane + label */ }
  close() { this._open = false; console.info('[Overlay:close] MapOverlay.js'); }
}
