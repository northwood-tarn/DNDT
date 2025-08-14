// app/engine/knockback.js
// General-purpose push/knockback resolver for grid movement.
// Assumptions: 5 ft = 1 tile (configurable), grid is a 2D array with { walkable: boolean } cells.

export function feetToTiles(feet, feetPerTile = 5) {
  if (!feet || feet <= 0) return 0;
  return Math.max(0, Math.floor(feet / feetPerTile));
}

function isWalkable(grid, x, y) {
  return !!(grid?.[y]?.[x]?.walkable);
}

function isOccupied(actors = [], x, y) {
  return !!actors.find(a => a?.x === x && a?.y === y && (a.hp ?? 1) > 0);
}

/**
 * Push an actor directly away from a source point.
 * Stops early if next cell is blocked (wall/edge) or occupied.
 * @param {Object} args
 * @param {Array<Array<Object>>} args.grid - tileGrid[y][x] with .walkable
 * @param {Object} args.actor - object with x,y
 * @param {Object} args.from - {x,y} origin of force (e.g., caster position)
 * @param {number} args.maxFeet - push distance in feet
 * @param {Array<Object>} [args.actors] - optional list of other actors to treat as blocking
 * @param {number} [args.feetPerTile] - feet per tile, default 5
 * @returns {{moved:number, to:{x:number,y:number}}}
 */
export function applyPush({ grid, actor, from, maxFeet, actors = [], feetPerTile = 5 }) {
  if (!grid || !actor || typeof actor.x !== "number" || typeof actor.y !== "number" || !from) {
    return { moved: 0, to: { x: actor?.x ?? 0, y: actor?.y ?? 0 } };
  }
  const maxTiles = feetToTiles(maxFeet, feetPerTile);
  if (maxTiles <= 0) return { moved: 0, to: { x: actor.x, y: actor.y } };

  // Compute unit step away from source -> target
  const dx = Math.sign(actor.x - from.x);
  const dy = Math.sign(actor.y - from.y);

  let cx = actor.x;
  let cy = actor.y;
  let moved = 0;

  for (let i = 0; i < maxTiles; i++) {
    const nx = cx + dx;
    const ny = cy + dy;
    if (!isWalkable(grid, nx, ny)) break;
    if (isOccupied(actors, nx, ny)) break;
    cx = nx; cy = ny; moved++;
  }

  actor.x = cx;
  actor.y = cy;
  return { moved, to: { x: cx, y: cy } };
}
