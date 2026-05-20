import { inBounds, keyOf } from "./grid.js";

export function buildFootprint(grid, shape, anchor, options = {}) {
  if (shape === "line") return lineFootprint(grid, options.origin, anchor, options.lengthSquares ?? 6);
  if (shape === "cone") return coneFootprint(grid, options.origin, anchor, options.lengthSquares ?? 6);
  if (shape === "cube") return cubeFootprint(grid, anchor, options.sizeSquares ?? 6);
  if (shape === "donut") return donutFootprint(grid, anchor, options.innerRadiusSquares ?? 1, options.outerRadiusSquares ?? 2);
  return radiusFootprint(grid, anchor, options.radiusSquares ?? 2);
}

export function radiusFootprint(grid, center, radiusSquares) {
  const cells = [];
  for (let y = center.y - radiusSquares; y <= center.y + radiusSquares; y++) {
    for (let x = center.x - radiusSquares; x <= center.x + radiusSquares; x++) {
      const pos = { x, y };
      const dx = x - center.x;
      const dy = y - center.y;
      if (inBounds(grid, pos) && Math.sqrt(dx * dx + dy * dy) <= radiusSquares) {
        cells.push(pos);
      }
    }
  }
  return cells;
}

export function lineFootprint(grid, origin, aim, lengthSquares) {
  const direction = lineDirection(origin, aim);
  if (!direction) return [];
  const cells = [];
  for (let i = 1; i <= lengthSquares; i++) {
    const pos = {
      x: origin.x + direction.x * i,
      y: origin.y + direction.y * i,
    };
    if (inBounds(grid, pos)) cells.push(pos);
  }
  return cells;
}

export function coneFootprint(grid, origin, aim, lengthSquares) {
  const direction = lineDirection(origin, aim);
  if (!direction) return [];
  const cells = [];
  for (let y = origin.y - lengthSquares; y <= origin.y + lengthSquares; y++) {
    for (let x = origin.x - lengthSquares; x <= origin.x + lengthSquares; x++) {
      const pos = { x, y };
      const rel = { x: x - origin.x, y: y - origin.y };
      const forward = rel.x * direction.x + rel.y * direction.y;
      if (forward <= 0 || forward > lengthSquares) continue;
      const lateral = Math.abs(rel.x * direction.y - rel.y * direction.x);
      if (lateral <= forward && inBounds(grid, pos)) cells.push(pos);
    }
  }
  return cells;
}

export function cubeFootprint(grid, anchor, sizeSquares) {
  const cells = [];
  const before = Math.floor((sizeSquares - 1) / 2);
  const after = sizeSquares - 1 - before;
  for (let y = anchor.y - before; y <= anchor.y + after; y++) {
    for (let x = anchor.x - before; x <= anchor.x + after; x++) {
      const pos = { x, y };
      if (inBounds(grid, pos)) cells.push(pos);
    }
  }
  return cells;
}

export function donutFootprint(grid, center, innerRadiusSquares, outerRadiusSquares) {
  return radiusFootprint(grid, center, outerRadiusSquares)
    .filter((pos) => {
      const dx = pos.x - center.x;
      const dy = pos.y - center.y;
      return Math.sqrt(dx * dx + dy * dy) > innerRadiusSquares;
    });
}

export function actorsInFootprint(actors, cells) {
  const keys = new Set(cells.map(keyOf));
  return actors
    .filter((actor) => actor.hp > 0 && keys.has(keyOf(actor.position)))
    .map((actor) => ({ id: actor.id, name: actor.name }));
}

export function lineDirection(origin, aim) {
  if (!origin || !aim) return null;
  const dx = Math.sign(aim.x - origin.x);
  const dy = Math.sign(aim.y - origin.y);
  if (dx === 0 && dy === 0) return null;
  return { x: dx, y: dy };
}
