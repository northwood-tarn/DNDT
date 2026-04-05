// app/engine/events.js
// Minimal event bus for game-wide events.
// Uses EventTarget so it works in the renderer without Node integration.
//
// Contract:
//   on(name, fn) -> unsubscribe()
//   off(name, fn)
//   once(name, fn)
//   emit(name, detail)
//
// Payloads are carried in CustomEvent.detail.

const _bus = new EventTarget();

// Internal: map original handler -> wrapped listener (per event name)
const _wrappedByName = new Map(); // Map<string, Map<Function, Function>>

function _getWrappedMap(name) {
  let m = _wrappedByName.get(name);
  if (!m) {
    m = new Map();
    _wrappedByName.set(name, m);
  }
  return m;
}

/** Subscribe to an event. Returns an unsubscribe function. */
export function on(name, handler) {
  if (!name || typeof handler !== "function") {
    throw new Error("[events] on(name, handler) requires an event name and a function");
  }

  const wrappedMap = _getWrappedMap(name);

  // If the same handler is re-registered for the same event, keep it idempotent.
  // (Otherwise we leak listeners and make off() ambiguous.)
  if (wrappedMap.has(handler)) {
    return () => off(name, handler);
  }

  const wrapped = (e) => handler(e?.detail, e);
  wrappedMap.set(handler, wrapped);
  _bus.addEventListener(name, wrapped);
  return () => off(name, handler);
}

/** Unsubscribe a previously registered handler. */
export function off(name, handler) {
  if (!name || typeof handler !== "function") return;

  const wrappedMap = _wrappedByName.get(name);
  if (!wrappedMap) return;

  const wrapped = wrappedMap.get(handler);
  if (!wrapped) return;

  _bus.removeEventListener(name, wrapped);
  wrappedMap.delete(handler);
  if (wrappedMap.size === 0) _wrappedByName.delete(name);
}

/** Subscribe once. */
export function once(name, handler) {
  const offOnce = on(name, (detail, e) => {
    try {
      handler(detail, e);
    } finally {
      offOnce();
    }
  });
  return offOnce;
}

/** Emit an event with a plain-object payload. */
export function emit(name, detail = {}) {
  if (!name) throw new Error("[events] emit(name, detail) requires an event name");
  _bus.dispatchEvent(new CustomEvent(name, { detail }));
}

/** Low-level escape hatch (rarely needed). */
export function getBus() {
  return _bus;
}