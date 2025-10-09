// engine/loop.js — Single authoritative game loop (ESM)
//
// Responsibilities:
// - Own a single requestAnimationFrame loop for the whole app
// - Emit a 'game:tick' event for systems that want dt updates
// - Call sceneManager.update(dt) and sceneManager.render(interp) if present
// - Support pause/resume and fixed-step updates for determinism

import { sceneManager } from "./sceneManager.js";

const STEP_MS = 1000 / 60;           // 60 Hz fixed update
const MAX_SUBSTEPS = 5;              // prevent spiral of death
let _running = false;
let _paused  = false;
let _lastTime = 0;
let _accum = 0;
let _rafId = 0;
let _speed = 1.0;                     // time scale multiplier (1.0 = realtime)

const tickListeners = new Set();

function _emitTick(dt, now) {
  try {
    const ev = new CustomEvent("game:tick", { detail: { dt, now } });
    window.dispatchEvent(ev);
  } catch (e) {
    // no-op; events are best-effort
  }
  // also call any explicit listeners (optional convenience)
  for (const cb of tickListeners) {
    try { cb(dt, now); } catch {}
  }
}

function _frame(now) {
  if (!_running) return;
  if (_paused) { _rafId = requestAnimationFrame(_frame); return; }

  if (_lastTime === 0) _lastTime = now;
  let rawDt = (now - _lastTime) * _speed;
  _lastTime = now;

  // clamp dt (tab restore, breakpoints)
  if (rawDt > 1000) rawDt = STEP_MS;

  _accum += rawDt;
  let steps = 0;

  while (_accum >= STEP_MS && steps < MAX_SUBSTEPS) {
    const dt = STEP_MS;
    _emitTick(dt, now);
    if (sceneManager && typeof sceneManager.update === "function") {
      try { sceneManager.update(dt); } catch (e) { console.warn("sceneManager.update error:", e); }
    }
    _accum -= STEP_MS;
    steps++;
  }

  // Render once per RAF, allow interpolation ratio if scenes need it
  if (sceneManager && typeof sceneManager.render === "function") {
    const alpha = Math.max(0, Math.min(1, _accum / STEP_MS));
    try { sceneManager.render(alpha); } catch (e) { console.warn("sceneManager.render error:", e); }
  }

  _rafId = requestAnimationFrame(_frame);
}

export const gameLoop = {
  start() {
    if (_running) return;
    _running = true;
    _paused = false;
    _lastTime = 0;
    _accum = 0;
    _rafId = requestAnimationFrame(_frame);
  },
  stop() {
    _running = false;
    _paused = false;
    if (_rafId) cancelAnimationFrame(_rafId);
    _rafId = 0;
  },
  pause()   { _paused = true; },
  resume()  { _paused = false; },
  setSpeed(multiplier = 1.0) { _speed = Math.max(0.1, Math.min(4.0, Number(multiplier) || 1.0)); },
  onTick(cb)  { if (cb && typeof cb === "function") tickListeners.add(cb); return () => tickListeners.delete(cb); },
  offTick(cb) { tickListeners.delete(cb); },
  isRunning() { return _running; },
  isPaused()  { return _paused; }
};

// Auto-pause on tab hide (optional; comment out if undesirable)
document.addEventListener("visibilitychange", () => {
  if (document.hidden) gameLoop.pause();
  else gameLoop.resume();
});
