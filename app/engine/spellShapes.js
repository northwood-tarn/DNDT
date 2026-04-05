// app/engine/spellShapes.js
// Pure grid math for spell areas (no DOM, no rendering).
// All functions return an array of unique { x, y } tile coords.
//
// Coordinates are integer grid tiles. Origin is inclusive.
// Distances are based on Chebyshev metric by default (good for square grids).

/**
 * @typedef {{x:number,y:number}} Point
 * @typedef {{width:number,height:number}} Bounds
 */

/** Clamp test */
function inBounds(p, bounds) {
  if (!bounds) return true;
  return p.x >= 0 && p.y >= 0 && p.x < bounds.width && p.y < bounds.height;
}

/** Dedup helper */
function uniq(points) {
  const seen = new Set();
  const out = [];
  for (const pt of points) {
    const k = pt.x + "," + pt.y;
    if (!seen.has(k)) { seen.add(k); out.push(pt); }
  }
  return out;
}

/** Chebyshev distance on grid */
function chebyshev(a, b) {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/** Normalize a direction vector to unit-ish grid step */
function normDir(dir) {
  let dx = Math.sign(dir?.x || 0);
  let dy = Math.sign(dir?.y || 0);
  if (dx === 0 && dy === 0) dy = -1; // default up
  return { x: dx, y: dy };
}

/**
 * Single tile (the origin).
 */
export function tilesSingle(origin, bounds) {
  return inBounds(origin, bounds) ? [ { x: origin.x, y: origin.y } ] : [];
}

/**
 * Circle/Sphere on grid using Chebyshev metric (diamond/square depending on metric).
 * @param {Point} origin
 * @param {number} radius inclusive
 * @param {Bounds=} bounds
 */
export function tilesCircle(origin, radius, bounds) {
  const pts = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const p = { x: origin.x + dx, y: origin.y + dy };
      if (!inBounds(p, bounds)) continue;
      if (chebyshev(origin, p) <= radius) pts.push(p);
    }
  }
  return uniq(pts);
}

/**
 * Axis-aligned or directed line (a rectangle of length x width) extending from origin in dir.
 * @param {Point} origin
 * @param {{x:number,y:number}} dir - normalized grid dir (will be normalized if not)
 * @param {number} length - tiles including origin step forward; if length=1, affects the tile in front
 * @param {number} width - odd integer recommended (1,3,5). Width is centered on the line.
 * @param {Bounds=} bounds
 */
export function tilesLine(origin, dir, length, width=1, bounds) {
  const d = normDir(dir);
  const pts = [];
  // orthogonal vector for width
  const ortho = { x: -d.y, y: d.x }; // rotate 90°
  const half = Math.floor((Math.max(1, width) - 1) / 2);
  for (let i = 1; i <= Math.max(1, length); i++) {
    const cx = origin.x + d.x * i;
    const cy = origin.y + d.y * i;
    for (let w = -half; w <= half; w++) {
      const p = { x: cx + ortho.x * w, y: cy + ortho.y * w };
      if (inBounds(p, bounds)) pts.push(p);
    }
  }
  return uniq(pts);
}

/**
 * Cone fan forward from origin.
 * Uses dot-product threshold (45° half-angle) to approximate a 90° cone.
 * @param {Point} origin
 * @param {{x:number,y:number}} dir
 * @param {number} length
 * @param {Bounds=} bounds
 */
export function tilesCone(origin, dir, length, bounds) {
  const d = normDir(dir);
  // Normalize to unit vector for dot product
  const mag = Math.hypot(d.x, d.y) || 1;
  const ux = d.x / mag, uy = d.y / mag;
  const cosHalfAngle = Math.SQRT1_2; // cos(45°) ≈ 0.707
  const pts = [];
  for (let dy = -length; dy <= length; dy++) {
    for (let dx = -length; dx <= length; dx++) {
      const p = { x: origin.x + dx, y: origin.y + dy };
      if (!inBounds(p, bounds)) continue;
      const dist = chebyshev(origin, p);
      if (dist === 0 || dist > length) continue;
      // Vector from origin to p
      const vx = p.x - origin.x, vy = p.y - origin.y;
      const vmag = Math.hypot(vx, vy) || 1;
      const dot = (vx / vmag) * ux + (vy / vmag) * uy;
      if (dot >= cosHalfAngle) pts.push(p);
    }
  }
  return uniq(pts);
}

/**
 * Axis-aligned cube/square centered on origin (useful for shocks like Thunderwave if centered differently).
 * @param {Point} origin
 * @param {number} radius
 * @param {Bounds=} bounds
 */
export function tilesSquare(origin, radius, bounds) {
  const pts = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const p = { x: origin.x + dx, y: origin.y + dy };
      if (inBounds(p, bounds)) pts.push(p);
    }
  }
  return uniq(pts);
}

/**
 * Unified entry point.
 * @param {{ kind: 'single'|'circle'|'line'|'cone'|'square', radius?:number, length?:number, width?:number }} shape
 * @param {Point} origin
 * @param {{x:number,y:number}=} dir
 * @param {Bounds=} bounds
 */
export function tilesInArea(shape, origin, dir, bounds) {
  switch (shape?.kind) {
    case 'single': return tilesSingle(origin, bounds);
    case 'circle': return tilesCircle(origin, shape.radius ?? 0, bounds);
    case 'square': return tilesSquare(origin, shape.radius ?? 0, bounds);
    case 'line':   return tilesLine(origin, dir, shape.length ?? 1, shape.width ?? 1, bounds);
    case 'cone':   return tilesCone(origin, dir, shape.length ?? 1, bounds);
    default: return tilesSingle(origin, bounds);
  }
}

export default {
  tilesSingle,
  tilesCircle,
  tilesSquare,
  tilesLine,
  tilesCone,
  tilesInArea
};
