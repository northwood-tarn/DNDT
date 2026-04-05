import { emit } from "./events.js";
// engine/inputManager.js — augmented minimal manager with movement snapshot
const bindings = new Map();
const listeners = new Set();
const state = { up: false, down: false, left: false, right: false };

export function bind(key, command) {
  bindings.set(key, command);
}

export function onCommand(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function dispatchKey(key) {
  const cmd = bindings.get(key);
  if (!cmd) return false;
  for (const cb of listeners) cb(cmd);
  return true;
}

export function dispatch(command, payload) {
  for (const cb of listeners) cb(command, payload);
}

export function attachDOM() {
  window.addEventListener(
    "keydown",
    (e) => {
      const k = e.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowleft", "arrowdown", "arrowright"].includes(k)) {
        e.preventDefault();
      }
      if (k === "w" || k === "arrowup") state.up = true;
      if (k === "s" || k === "arrowdown") state.down = true;
      if (k === "a" || k === "arrowleft") state.left = true;
      if (k === "d" || k === "arrowright") state.right = true;

      // Exploration movement: emit a single intent per keydown.
      // Safe: explorationSystem ignores this event unless exploration is active.
      let dir = null;
      if (k === "w" || k === "arrowup") dir = "up";
      else if (k === "s" || k === "arrowdown") dir = "down";
      else if (k === "a" || k === "arrowleft") dir = "left";
      else if (k === "d" || k === "arrowright") dir = "right";

      if (dir) emit("exploration:moveIntent", dir);

      // Generic key->command bindings (if any are registered)
      dispatchKey(k);
    },
    { passive: false }
  );

  window.addEventListener(
    "keyup",
    (e) => {
      const k = e.key.toLowerCase();
      if (k === "w" || k === "arrowup") state.up = false;
      if (k === "s" || k === "arrowdown") state.down = false;
      if (k === "a" || k === "arrowleft") state.left = false;
      if (k === "d" || k === "arrowright") state.right = false;
    },
    { passive: true }
  );
}

export function movementState() {
  return { ...state };
}

// -----------------------------------------------------------------------------
// Optional: Exploration movement bridge
// -----------------------------------------------------------------------------
//
// This keeps input handling UI-agnostic:
// - We read the held-key snapshot (movementState)
// - On a tick signal (default: window "game:tick"), we emit ONE move intent
//   at a controlled cadence, leaving collision/triggers to explorationSystem.
//
// Usage elsewhere (e.g., when entering ExplorationScene):
//   const detach = attachExplorationMovement({
//     emit: (name, detail) => emit(name, detail),
//     isEnabled: () => stateStore.getState().scene === "exploration",
//     stepMs: 120,
//   });
//   // call detach() on scene exit

let _exploreDetach = null;

function _dirFromState(s) {
  // No diagonals for now; pick a stable priority.
  if (s.up) return { dx: 0, dy: -1 };
  if (s.down) return { dx: 0, dy: 1 };
  if (s.left) return { dx: -1, dy: 0 };
  if (s.right) return { dx: 1, dy: 0 };
  return null;
}

export function attachExplorationMovement(options = {}) {
  const {
    emit,
    isEnabled = () => true,
    stepMs = 140,
    tickEventName = "game:tick",
    target = typeof window !== "undefined" ? window : null,
  } = options;

  if (!target || typeof target.addEventListener !== "function") {
    console.warn("[inputManager] attachExplorationMovement: no valid event target");
    return () => {};
  }

  if (typeof emit !== "function") {
    console.warn("[inputManager] attachExplorationMovement: missing emit(name, detail)");
    return () => {};
  }

  // If called twice, detach the previous bridge.
  if (typeof _exploreDetach === "function") {
    try {
      _exploreDetach();
    } catch (_) {}
  }

  let lastStepAt = 0;

  const onTick = () => {
    try {
      if (!isEnabled()) return;

      const dir = _dirFromState(state);
      if (!dir) return;

      const now = typeof performance !== "undefined" ? performance.now() : Date.now();
      if (now - lastStepAt < stepMs) return;
      lastStepAt = now;

      emit("exploration:moveIntent", dir);
    } catch (err) {
      console.warn("[inputManager] exploration tick failed", err);
    }
  };

  target.addEventListener(tickEventName, onTick);

  const detach = () => {
    try {
      target.removeEventListener(tickEventName, onTick);
    } catch (_) {}
    if (_exploreDetach === detach) _exploreDetach = null;
  };

  _exploreDetach = detach;
  return detach;
}
