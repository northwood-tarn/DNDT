import { getConditionRules } from "./effects.js";
import { combatObjectsAt } from "./combatObjects.js";

export function getMovementStepCost(snapshot, actor, from, to) {
  let cost = 1;
  if (isDifficultTerrain(snapshot, to)) cost += 1;
  if (hasConditionMechanic(actor, "crawlOnly")) cost += 1;
  return cost;
}

export function canUseMovementMode(actor, mode) {
  if (mode === "walk" && hasConditionMechanic(actor, "cannotMove")) {
    return { ok: false, reason: "cannot move" };
  }
  return { ok: true, reason: null };
}

function isDifficultTerrain(snapshot, pos) {
  return snapshot.grid?.terrain?.get?.(`${pos.x},${pos.y}`) === "difficult" ||
    combatObjectsAt(snapshot, pos).some((object) => object.difficultTerrain);
}

function hasConditionMechanic(actor, mechanic) {
  return Array.isArray(actor?.conditions) && actor.conditions.some((condition) => {
    const id = typeof condition === "string" ? condition : condition.id;
    return Boolean(id && getConditionRules(id)[mechanic]);
  });
}
