import { isWalkable } from "./grid.js";
import { combatObjectsAt } from "./combatObjects.js";

export function resolveForcedMovement(snapshot, sourcePosition, target, effect) {
  const from = { ...target.position };
  let movedSquares = 0;
  let collisionSquares = 0;

  for (let i = 0; i < effect.distanceSquares; i++) {
    const next = nextForcedMovementStep(sourcePosition, target.position, effect.direction);
    if (!next) break;
    const blockedByTerrain = !isWalkable(snapshot, next, target.id);
    const blockedByObject = combatObjectsAt(snapshot, next).some((object) => object.blocksMovement);
    const blockedByActor = actorAt(snapshot, next, target.id);
    if (blockedByTerrain || blockedByObject) {
      collisionSquares = blockedByActor ? 0 : effect.distanceSquares - movedSquares;
      break;
    }
    target.position = next;
    movedSquares += 1;
  }

  return {
    from,
    to: { ...target.position },
    movedSquares,
    collisionSquares,
  };
}

function nextForcedMovementStep(source, target, direction) {
  const dx = Math.sign(target.x - source.x);
  const dy = Math.sign(target.y - source.y);
  const useX = Math.abs(target.x - source.x) >= Math.abs(target.y - source.y);
  const step = useX ? { x: dx || 0, y: 0 } : { x: 0, y: dy || 0 };
  if (direction === "toward_source") {
    step.x *= -1;
    step.y *= -1;
  }
  if (!step.x && !step.y) return null;
  return { x: target.x + step.x, y: target.y + step.y };
}

function actorAt(snapshot, position, exceptActorId = null) {
  return (snapshot.actors || []).find((actor) =>
    actor.id !== exceptActorId &&
    actor.hp > 0 &&
    actor.position?.x === position.x &&
    actor.position?.y === position.y
  ) || null;
}
