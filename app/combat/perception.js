import { hasLineOfSight } from "./grid.js";
import { getConditionRules } from "./effects.js";
import { hasCombatObjectLineOfSight } from "./combatObjects.js";

export function canSeeActor(snapshot, observer, target) {
  if (!observer || !target || observer.hp <= 0 || target.hp <= 0) return blocked("actor is not visible");
  if (hasConditionMechanic(observer, "unaware")) return blocked(`${observer.name} is unaware`);
  if (hasConditionMechanic(observer, "cannotSee")) return blocked(`${observer.name} cannot see`);
  if (!hasLineOfSight(snapshot.grid, observer.position, target.position) ||
      !hasCombatObjectLineOfSight(snapshot, observer.position, target.position)) return blocked("line of sight blocked");
  if (hasConditionMechanic(target, "cannotBeSeen") && !hasSense(observer, "see_invisible")) {
    return blocked(`${target.name} cannot be seen`);
  }
  return allowed();
}

function hasSense(actor, sense) {
  return Array.isArray(actor?.senses) && actor.senses.includes(sense);
}

function hasConditionMechanic(actor, mechanic) {
  return Array.isArray(actor?.conditions) && actor.conditions.some((condition) => {
    const id = typeof condition === "string" ? condition : condition.id;
    return Boolean(id && getConditionRules(id)[mechanic]);
  });
}

function allowed() {
  return { ok: true, reason: null };
}

function blocked(reason) {
  return { ok: false, reason };
}
