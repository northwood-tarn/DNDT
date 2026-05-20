import { buildFootprint } from "./footprints.js";

export function normalizeCombatObjects(objects = []) {
  return (Array.isArray(objects) ? objects : []).map((object, index) => ({
    id: object.id || `combat_object_${index + 1}`,
    name: object.name || object.id || `Combat Object ${index + 1}`,
    position: object.position ? { ...object.position } : null,
    origin: object.origin ? { ...object.origin } : null,
    cells: Array.isArray(object.cells) ? object.cells.map((cell) => ({ ...cell })) : null,
    shape: object.shape || object.area?.shape || "radius",
    radiusSquares: object.radiusSquares ?? feetToSquares(object.radiusFt ?? object.area?.size ?? 0),
    innerRadiusSquares: object.innerRadiusSquares ?? feetToSquares(object.innerRadiusFt ?? 0),
    outerRadiusSquares: object.outerRadiusSquares ?? feetToSquares(object.outerRadiusFt ?? object.radiusFt ?? object.area?.size ?? 0),
    lengthSquares: object.lengthSquares ?? feetToSquares(object.lengthFt ?? object.area?.length ?? object.area?.size ?? 0),
    sizeSquares: object.sizeSquares ?? feetToSquares(object.sizeFt ?? object.area?.size ?? object.area?.width ?? 0),
    blocksMovement: object.blocksMovement === true,
    blocksLineOfSight: object.blocksLineOfSight === true,
    difficultTerrain: object.difficultTerrain === true,
    visual: object.visual || null,
    followsSource: object.followsSource === true,
    sourceActorId: object.sourceActorId || null,
    sourceActionId: object.sourceActionId || null,
    spellSaveDC: object.spellSaveDC ?? null,
    duration: object.duration ? structuredClone(object.duration) : null,
    effects: Array.isArray(object.effects) ? structuredClone(object.effects) : [],
  }));
}

export function createCombatObjectFromAction(action, anchor, source) {
  const object = action.object || {};
  const position = anchor?.anchor || anchor?.cells?.[0] || anchor;
  return normalizeCombatObjects([{
    ...object,
    id: `${action.id}_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    name: object.name || action.name,
    position: position ? { ...position } : null,
    cells: Array.isArray(anchor?.cells) ? anchor.cells : object.cells,
    origin: source?.position ? { ...source.position } : null,
    sourceActorId: source?.id || null,
    sourceActionId: action.id,
    spellSaveDC: action.spellSaveDC ?? null,
  }])[0];
}

export function combatObjectsAt(snapshot, position) {
  return (snapshot.combatObjects || []).filter((object) => combatObjectContains(snapshot, object, position));
}

export function combatObjectsAffectingActor(snapshot, actor) {
  if (!actor?.position) return [];
  return combatObjectsAt(snapshot, actor.position);
}

export function combatObjectContains(snapshot, object, position) {
  if (!combatObjectPosition(snapshot, object) || !position) return false;
  const cells = combatObjectCells(snapshot, object);
  return cells.some((cell) => cell.x === position.x && cell.y === position.y);
}

export function combatObjectCells(snapshot, object) {
  if (Array.isArray(object?.cells)) return object.cells.map((cell) => ({ ...cell }));
  const position = combatObjectPosition(snapshot, object);
  if (!position) return [];
  return buildFootprint(snapshot.grid, object.shape || "radius", position, {
    origin: object.origin || position,
    radiusSquares: object.radiusSquares || 0,
    innerRadiusSquares: object.innerRadiusSquares || 0,
    outerRadiusSquares: object.outerRadiusSquares || object.radiusSquares || 0,
    lengthSquares: object.lengthSquares || 0,
    sizeSquares: object.sizeSquares || 0,
  });
}

function combatObjectPosition(snapshot, object) {
  if (!object?.followsSource) return object?.position || null;
  const source = (snapshot.actors || []).find((actor) => actor.id === object.sourceActorId && actor.hp > 0);
  return source?.position || object.position || null;
}

export function hasCombatObjectLineOfSight(snapshot, from, to) {
  const blockers = (snapshot.combatObjects || []).filter((object) => object.blocksLineOfSight);
  if (!blockers.length) return true;
  const points = bresenham(from.x, from.y, to.x, to.y);
  for (let i = 1; i < points.length - 1; i++) {
    if (blockers.some((object) => combatObjectContains(snapshot, object, points[i]))) return false;
  }
  return true;
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

function feetToSquares(feet) {
  return Math.max(0, Math.ceil((Number(feet) || 0) / 5));
}
