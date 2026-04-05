// JournalOverlay.js.js
// Minimal modal overlay stub. Opened above a scene; returns focus on close.
// API: open(ctx, params), update(dt), render(g), close()

export default class JournalOverlay {
  constructor() { this._ctx = null; this._open = false; this._label = 'Journal'; }
  open(ctx, params={}) { this._ctx = ctx; this._open = True; this._params = params; console.info('[Overlay:open] JournalOverlay.js', params); }
  update(dt) { /* capture input as needed; Esc to close, etc. */ }
  render(g) { /* draw semi-transparent pane + label */ }
  close() { this._open = false; console.info('[Overlay:close] JournalOverlay.js'); }
}
