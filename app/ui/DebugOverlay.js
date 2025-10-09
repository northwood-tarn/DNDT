// ui/DebugOverlay.js — lightweight F9 debug overlay (ESM)
//
// Responsibilities:
// - Toggle with F9
// - Subscribe to `game:tick` for FPS updates
// - Display: scene name, area id, FPS, actor/enemy counts, last error
// - Keep engine decoupled (no imports into engine); depends only on sceneManager reference passed at install
//
// Usage:
//   import { installDebugOverlay } from "./ui/DebugOverlay.js";
//   installDebugOverlay({ sceneManager, countersProvider: () => ({ actors, enemies }), areaIdProvider: () => currentAreaId });
//
// Notes:
// - If you don't pass providers, it will try best-effort introspection on sceneManager.current
// - It listens for window 'error' and 'unhandledrejection' to capture the last error string

export function installDebugOverlay(opts = {}) {
  const sceneManager = opts.sceneManager;
  const countersProvider = opts.countersProvider || defaultCountersProvider(sceneManager);
  const areaIdProvider = opts.areaIdProvider || defaultAreaIdProvider(sceneManager);

  // Root element
  const el = document.createElement('div');
  el.id = 'debug-overlay';
  Object.assign(el.style, {
    position: 'fixed',
    top: '8px',
    right: '8px',
    minWidth: '240px',
    maxWidth: '360px',
    zIndex: 99999,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
    fontSize: '12px',
    lineHeight: '1.3',
    color: '#e6f1ff',
    background: 'rgba(0,0,0,0.55)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '10px',
    padding: '10px 12px',
    boxShadow: '0 6px 20px rgba(0,0,0,0.5)',
    backdropFilter: 'blur(4px)',
    pointerEvents: 'none', // non-interactive
    display: 'none'
  });
  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
      <strong>Debug</strong>
      <span id="dbg-fps" style="opacity:.9">FPS: --</span>
    </div>
    <div id="dbg-lines" style="white-space:pre;opacity:.95"></div>
  `;
  document.body.appendChild(el);

  // Hotkey toggle (F9)
  let visible = false;
  function setVisible(v) { visible = v; el.style.display = v ? 'block' : 'none'; }
  window.addEventListener('keydown', (e) => {
    if (e.key === 'F9') setVisible(!visible);
  });

  // FPS smoothing
  let fps = 0;
  let lastNow = 0;
  const smooth = 0.1; // EMA smoothing factor
  function onTick(dt, now) {
    if (!lastNow) lastNow = now;
    const inst = 1000 / Math.max(1, (now - lastNow));
    fps = fps ? (fps + (inst - fps) * smooth) : inst;
    lastNow = now;
    if (visible) render();
  }

  // Last error capture
  let lastError = null;
  window.addEventListener('error', (ev) => {
    lastError = (ev?.error && (ev.error.stack || ev.error.message)) || ev.message || String(ev);
  });
  window.addEventListener('unhandledrejection', (ev) => {
    const r = ev?.reason;
    lastError = (r && (r.stack || r.message)) || String(r);
  });

  function render() {
    const scene = (sceneManager && sceneManager.current) || null;
    const sceneName = scene?.name || scene?.constructor?.name || '(none)';
    const areaId = tryCall(areaIdProvider);
    const counts = tryCall(countersProvider) || { actors: 0, enemies: 0 };
    const fpsText = `FPS: ${Math.round(fps).toString().padStart(2, ' ')}`;
    el.querySelector('#dbg-fps').textContent = fpsText;

    const lines = [
      `Scene: ${sceneName}`,
      `Area:  ${areaId || '(unknown)'}`,
      `Actors: ${pad2(counts.actors)}   Enemies: ${pad2(counts.enemies)}`,
      lastError ? `LastErr: ${truncate(lastError, 160)}` : `LastErr: (none)`,
    ];

    el.querySelector('#dbg-lines').textContent = lines.join('\n');
  }

  // Subscribe to the global tick without importing engine
  const tickHandler = (ev) => onTick(ev.detail.dt, ev.detail.now);
  window.addEventListener('game:tick', tickHandler);

  // Return an API so scenes can update counts if they want
  return {
    setCounts(actors, enemies) { el._counts = { actors, enemies }; },
    destroy() {
      window.removeEventListener('game:tick', tickHandler);
      document.body.removeChild(el);
    }
  };
}

// -------- helpers --------
function tryCall(fn) {
  try { return typeof fn === 'function' ? fn() : fn; } catch { return null; }
}
function pad2(n) { return String(n ?? 0).padStart(2, ' '); }
function truncate(s, max) {
  if (!s) return s;
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}
function defaultAreaIdProvider(sceneManager) {
  return () => {
    const s = sceneManager?.current;
    // common patterns
    return s?.areaId || s?.area?.id || s?.map?.areaId || null;
  };
}
function defaultCountersProvider(sceneManager) {
  return () => {
    const s = sceneManager?.current;
    // Try common props
    const actors = Array.isArray(s?.actors) ? s.actors.length
      : Array.isArray(s?.entities) ? s.entities.length
      : (typeof s?.getActorCount === 'function' ? s.getActorCount() : 0);
    const enemies = Array.isArray(s?.enemies) ? s.enemies.length
      : (typeof s?.getEnemyCount === 'function' ? s.getEnemyCount() : 0);
    return { actors, enemies };
  };
}
