export function keyOf(pos) {
  return `${pos.x},${pos.y}`;
}

export function inBounds(grid, pos) {
  return pos.x >= 0 && pos.y >= 0 && pos.x < grid.width && pos.y < grid.height;
}

export function isBlocked(grid, pos) {
  return grid.blocked.has(keyOf(pos));
}

export function isMovementBlocked(grid, pos) {
  return isBlocked(grid, pos) || Boolean(grid.cover?.get(keyOf(pos)));
}

export function actorAt(snapshot, pos, exceptId = null) {
  return snapshot.actors.find((actor) =>
    actor.id !== exceptId &&
    actor.hp > 0 &&
    actor.position.x === pos.x &&
    actor.position.y === pos.y
  ) || null;
}

export function isWalkable(snapshot, pos, exceptId = null) {
  return inBounds(snapshot.grid, pos) &&
    !isMovementBlocked(snapshot.grid, pos) &&
    !actorAt(snapshot, pos, exceptId);
}

export function distance(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function neighbors(pos) {
  return [
    { x: pos.x, y: pos.y - 1 },
    { x: pos.x + 1, y: pos.y },
    { x: pos.x, y: pos.y + 1 },
    { x: pos.x - 1, y: pos.y },
  ];
}

export function hasLineOfSight(grid, from, to) {
  const points = bresenham(from.x, from.y, to.x, to.y);
  for (let i = 1; i < points.length - 1; i++) {
    if (isBlocked(grid, points[i])) return false;
  }
  return true;
}

export function findReachable(snapshot, actor, maxSteps = actor.movementRemaining) {
  const start = actor.position;
  const seen = new Set([keyOf(start)]);
  const queue = [{ pos: start, steps: 0 }];
  const out = [];

  while (queue.length) {
    const current = queue.shift();
    out.push(current);
    if (current.steps >= maxSteps) continue;
    for (const next of neighbors(current.pos)) {
      const key = keyOf(next);
      if (seen.has(key)) continue;
      if (!isWalkable(snapshot, next, actor.id)) continue;
      seen.add(key);
      queue.push({ pos: next, steps: current.steps + 1 });
    }
  }

  return out;
}

export function nextStepToward(snapshot, actor, targetPos) {
  const start = actor.position;
  const seen = new Set([keyOf(start)]);
  const queue = neighbors(start)
    .filter((pos) => isWalkable(snapshot, pos, actor.id))
    .map((pos) => ({ pos, firstStep: pos }));

  for (const item of queue) seen.add(keyOf(item.pos));

  let best = queue[0] || null;
  while (queue.length) {
    const current = queue.shift();
    if (
      !best ||
      distance(current.pos, targetPos) < distance(best.pos, targetPos)
    ) {
      best = current;
    }
    if (current.pos.x === targetPos.x && current.pos.y === targetPos.y) {
      return current.firstStep;
    }
    for (const next of neighbors(current.pos)) {
      const key = keyOf(next);
      if (seen.has(key)) continue;
      if (!isWalkable(snapshot, next, actor.id)) continue;
      seen.add(key);
      queue.push({ pos: next, firstStep: current.firstStep });
    }
  }

  return best?.firstStep || null;
}

export function isAdjacentToBlocked(grid, pos) {
  return neighbors(pos).some((next) => inBounds(grid, next) && isBlocked(grid, next));
}

function bresenham(x0, y0, x1, y1) {
  const points = [];
  const dx = Math.abs(x1 - x0);
  const sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0);
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;

  while (true) {
    points.push({ x, y });
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }

  return points;
}
