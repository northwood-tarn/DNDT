import { actorAt, distance, hasLineOfSight, inBounds, isMovementBlocked } from "./grid.js";
import { combatObjectsAt } from "./combatObjects.js";
import { spendActionCost } from "./actor.js";

export function resolveTeleport(snapshot, actor, action, targetPayload, log) {
  const to = targetPayload?.anchor || targetPayload;
  const legality = canTeleportTo(snapshot, actor, action, to);
  if (!legality.ok) {
    log.add("target.invalid", {
      round: snapshot.round,
      actorId: actor.id,
      actorName: actor.name,
      targetName: "teleport destination",
      reason: legality.reason,
    });
    return false;
  }
  const from = { ...actor.position };
  actor.position = { ...to };
  spendActionCost(actor, action.cost);
  log.add("teleport", {
    round: snapshot.round,
    actorId: actor.id,
    actorName: actor.name,
    actionName: action.name,
    from,
    to: { ...to },
  });
  return true;
}

function canTeleportTo(snapshot, actor, action, to) {
  if (!to || !Number.isFinite(to.x) || !Number.isFinite(to.y)) return blocked("destination is missing");
  if (distance(actor.position, to) > action.range) return blocked(`out of range (${distance(actor.position, to)}/${action.range})`);
  if (!inBounds(snapshot.grid, to)) return blocked("destination is out of bounds");
  if (isMovementBlocked(snapshot.grid, to) || actorAt(snapshot, to, actor.id)) return blocked("destination is blocked or occupied");
  if (combatObjectsAt(snapshot, to).some((object) => object.blocksMovement)) return blocked("destination is blocked by combat object");
  if (action.requiresSight && !hasLineOfSight(snapshot.grid, actor.position, to)) return blocked("destination cannot be seen");
  return { ok: true, reason: null };
}

function blocked(reason) {
  return { ok: false, reason };
}
