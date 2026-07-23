import { getConditionRules } from "./effects.js";
import { combatObjectsAt } from "./combatObjects.js";
import { canTraverseElevation, resolveHazardEntry } from "./tacticalTerrain.js";

export function getMovementStepCost(snapshot, actor, from, to) {
  let cost = 1;
  if (isDifficultTerrain(snapshot, to) && actor?.movementRules?.ignoreDifficultTerrain !== true) cost += 1;
  if (hasConditionMechanic(actor, "crawlOnly")) cost += 1;
  const elevation=canTraverseElevation(snapshot.grid,from,to,{maxElevationStep:actor.maxElevationStep??1});
  if(!elevation.ok)return Infinity;
  cost+=elevation.cost;
  return cost;
}

export function getMovementEntryHazards(snapshot,actor,to){return resolveHazardEntry(snapshot.grid,to,actor)}

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
