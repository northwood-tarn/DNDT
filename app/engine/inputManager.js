// text-mode engine/inputManager.js
// Simple command bus for Electron/text UI. No DOM listeners here.

const bindings = new Map();
const listeners = new Set();

export function bind(key, command) {
  bindings.set(key, command);
}

export function onCommand(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

// Programmatic dispatch (e.g., from readline, IPC, or tests)
export function dispatchKey(key) {
  const cmd = bindings.get(key);
  if (!cmd) return false;
  for (const cb of listeners) cb(cmd);
  return true;
}

// Direct command dispatch with payload
export function dispatch(command, payload) {
  for (const cb of listeners) cb(command, payload);
}
