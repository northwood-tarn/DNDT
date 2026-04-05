// Keyboard input handling (arrows / WASD)
export function attachControls(game) {
  const keys = new Set();

  const down = (e) => {
    const k = normalizeKey(e);
    if (k) { keys.add(k); e.preventDefault(); }
  };
  const up = (e) => {
    const k = normalizeKey(e);
    if (k) { keys.delete(k); e.preventDefault(); }
  };

  window.addEventListener("keydown", down);
  window.addEventListener("keyup", up);

  const tick = () => {
    let dx = 0, dy = 0;
    if (keys.has("left")) dx -= 1;
    if (keys.has("right")) dx += 1;
    if (keys.has("up")) dy -= 1;
    if (keys.has("down")) dy += 1;
    if (dx || dy) game.tryStep(dx, dy);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function normalizeKey(e) {
  const k = e.key.toLowerCase();
  if (k === "arrowleft" || k === "a") return "left";
  if (k === "arrowright" || k === "d") return "right";
  if (k === "arrowup" || k === "w") return "up";
  if (k === "arrowdown" || k === "s") return "down";
  return null;
}
