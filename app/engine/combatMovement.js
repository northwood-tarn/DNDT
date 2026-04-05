// text-mode engine/combatMovement.js
import { clearHiddenStatus } from "./actionEconomy.js";

// Move a combat unit to a new position on the battle grid
// Accepts an explicit `combat` state object to keep this module UI-agnostic.
export function moveCombatant(actor, dx, dy, combat, logFn = console.log) {
  if (!combat || !combat.grid) {
    logFn("Combat grid is unavailable.");
    return false;
  }
  const newX = actor.x + dx;
  const newY = actor.y + dy;

  // Bounds check
  if (newY < 0 || newY >= combat.grid.length || newX < 0 || newX >= combat.grid[0].length) {
    logFn("Can't move out of combat bounds.");
    return false;
  }

  const tile = combat.grid[newY][newX];
  if (!tile || tile.occupied || tile.blocked) {
    logFn("That tile is blocked or occupied.");
    return false;
  }

  // Clear actor's old position
  combat.grid[actor.y][actor.x].occupied = false;

  // Move actor
  actor.x = newX;
  actor.y = newY;
  combat.grid[newY][newX].occupied = true;

  // Break stealth
  clearHiddenStatus(actor, logFn);

  return true;
}
