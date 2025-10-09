// Keyboard input manager (WASD + Arrow Keys) with edge-triggered presses.

const PRESSED = new Set();
const JUST_PRESSED = new Set();

const DOWN_KEYS = new Set();

const KEYMAP = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  a: "left",
  s: "down",
  d: "right",
  W: "up",
  A: "left",
  S: "down",
  D: "right",
};

export function initInput() {
  window.addEventListener("keydown", (e) => {
    const action = KEYMAP[e.key];
    if (!action) return;
    if (!DOWN_KEYS.has(action)) {
      JUST_PRESSED.add(action);
      DOWN_KEYS.add(action);
    }
    PRESSED.add(action);
  });
  window.addEventListener("keyup", (e) => {
    const action = KEYMAP[e.key];
    if (!action) return;
    PRESSED.delete(action);
    DOWN_KEYS.delete(action);
  });
}

export function consumeJustPressed() {
  const arr = Array.from(JUST_PRESSED);
  JUST_PRESSED.clear();
  return arr;
}

export function isDown(action) {
  return PRESSED.has(action);
}
