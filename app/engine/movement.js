// text-mode engine/movement.js
import { clearHiddenStatus } from "./actionEconomy.js";

// Move the player in text-mode. Accepts an explicit `state` object to avoid UI coupling.
export function movePlayer(dx, dy, state, logFn = console.log) {
  if (!state || !state.player || !state.map) {
    logFn("State is not initialized.");
    return false;
  }
  const { player, map } = state;
  const newX = player.x + dx;
  const newY = player.y + dy;

  // Bounds check
  if (newY < 0 || newY >= map.length || newX < 0 || newX >= map[0].length) {
    logFn("Can't move out of bounds.");
    return false;
  }

  const tile = map[newY][newX];
  if (!tile || tile.blocked) {
    logFn("That way is blocked.");
    return false;
  }

  // Move player
  player.x = newX;
  player.y = newY;

  // Break stealth
  clearHiddenStatus(player, logFn);

  return true;
}
