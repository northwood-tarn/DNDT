import { actorAt, inBounds, isMovementBlocked } from "./grid.js";
import {
  getMovementRemaining,
  getItemQuantity,
  getStandingCost,
  hasCondition,
  hasConditionRule,
  removeCondition,
  resetTurnEconomy,
  spendActionCost,
  spendItem,
  spendMovement,
  syncContextualActions,
  syncLegacyEconomyFields,
} from "./actor.js";
import { getConditionRules } from "./effects.js";
import { checkOutcome, currentActor, getActor, livingActors } from "./combatState.js";
import { cleanupInvalidSourceConditions, processOngoingEffects } from "./conditionLifecycle.js";
import { getMovementStepCost } from "./movementRules.js";
import { dispatchActorTrigger } from "./triggers.js";
import {
  resolveConsumable,
  resolveContextualEndEffect,
  resolveDash,
  resolveDodge,
  resolveSelfHeal,
} from "./basicActionResolvers.js";
import { resolveFeatureAction } from "./featureActionResolver.js";
import {
  applyActionResolvedEffects,
  applyCollisionDamage,
  beginConcentration,
  resolveAutoDamageSpell,
  resolveTargetSaveGate,
  resolveAreaSaveSpell,
  resolveObjectSpell,
  resolveAttack,
  resolveOpportunityAttacks,
  resolveSaveSpell,
} from "./combatResolution.js";
import { combatObjectsAt } from "./combatObjects.js";
import { canMoveTo, canTargetAction, canUseAction } from "./rules.js";
import { resolveTeleport } from "./teleportAction.js";
export { checkOutcome, currentActor, getActor, livingActors } from "./combatState.js";

export function startTurn(snapshot, actor, log, dice = null) {
  const droppedEnemyOnPreviousTurn = actor?.combatFlags?.droppedEnemyOnLastTurn === true;
  processOngoingEffects(snapshot, actor, "turn_start", dice, log);
  resetTurnEconomy(actor, snapshot);
  actor.turnFlags.droppedEnemyOnPreviousTurn = droppedEnemyOnPreviousTurn;
  actor.combatFlags ??= {};
  actor.combatFlags.droppedEnemyOnLastTurn = false;
  dispatchActorTrigger(snapshot, "turn_start", actor, dice, log);
  syncContextualActions(actor);
  log.add("turn.start", {
    round: snapshot.round,
    actorId: actor.id,
    actorName: actor.name,
    movementRemaining: getMovementRemaining(actor),
  });
}

export function endTurnEffects(snapshot, actor, dice, log) {
  if (!actor || actor.hp <= 0) return;
  dispatchActorTrigger(snapshot, "turn_end", actor, dice, log);
  processOngoingEffects(snapshot, actor, "turn_end", dice, log);
}

export function moveActor(snapshot, actor, to, log, { force = false, dice = null } = {}) {
  const from = { ...actor.position };
  syncLegacyEconomyFields(actor);
  if (!force) {
    if (hasCondition(actor, "prone")) {
      const standingCost = getStandingCost(actor);
      if (getMovementRemaining(actor) < standingCost + 1) {
        log.add("move.blocked", {
          round: snapshot.round,
          actorId: actor.id,
          actorName: actor.name,
          to,
          reason: `standing from prone requires ${standingCost} movement before moving`,
        });
        return false;
      }
      spendMovement(actor, standingCost);
      removeCondition(actor, "prone");
      log.add("condition.removed", {
        round: snapshot.round,
        actorId: actor.id,
        actorName: actor.name,
        condition: "prone",
        reason: "stood as part of movement",
        movementCost: standingCost,
        movementRemaining: getMovementRemaining(actor),
      });
    }

    const movement = canMoveTo(snapshot, actor, to);
    if (!movement.ok) {
      log.add("move.blocked", {
        round: snapshot.round,
        actorId: actor.id,
        actorName: actor.name,
        to,
        reason: movement.reason,
      });
      return false;
    }

    resolveOpportunityAttacks(snapshot, actor, from, to, dice, log);
    if (actor.hp <= 0) {
      log.add("move.blocked", {
        round: snapshot.round,
        actorId: actor.id,
        actorName: actor.name,
        to,
        reason: "movement stopped because the actor was defeated by an opportunity attack",
      });
      return false;
    }
  }

  if (!force) dispatchActorTrigger(snapshot, "leave_area", actor, dice, log, { from, to });

  actor.position = { ...to };
  if (!force) spendMovement(actor, getMovementStepCost(snapshot, actor, from, to));
  log.add("move", {
    round: snapshot.round,
    actorId: actor.id,
    actorName: actor.name,
    from,
    to: { ...actor.position },
    movementRemaining: getMovementRemaining(actor),
  });
  if (!force) dispatchActorTrigger(snapshot, "enter_area", actor, dice, log, { from, to });
  cleanupInvalidSourceConditions(snapshot, log);
  return true;
}

export function resolveAction(snapshot, actor, actionId, targetId, dice, log) {
  if (!actor || actor.hp <= 0 || snapshot.outcome) return false;
  syncLegacyEconomyFields(actor);
  syncContextualActions(actor);
  const action = actor.actions.find((item) => item.id === actionId) || actor.actions[0];
  if (!action) return false;

  const actionLegality = canUseAction(actor, action);
  if (!actionLegality.ok) {
    log.add("target.invalid", {
      round: snapshot.round,
      actorId: actor.id,
      actorName: actor.name,
      targetName: action.name,
      reason: actionLegality.reason,
    });
    return false;
  }
  if (!hasConsumableStock(actor, action, log, snapshot)) return false;

  if (action.type === "dash") {
    const resolved = resolveDash(snapshot, actor, action, log);
    cleanupInvalidSourceConditions(snapshot, log);
    return resolved;
  }
  if (action.type === "dodge") {
    const resolved = resolveDodge(snapshot, actor, action, log);
    cleanupInvalidSourceConditions(snapshot, log);
    return resolved;
  }
  if (action.type === "feature_action") {
    const resolved = resolveFeatureAction(snapshot, actor, action, targetId, dice, log);
    cleanupInvalidSourceConditions(snapshot, log);
    return resolved;
  }
  if (action.type === "consumable") {
    const resolved = resolveConsumable(snapshot, actor, action, dice, log);
    cleanupInvalidSourceConditions(snapshot, log);
    return resolved;
  }
  if (action.type === "contextual_end_effect") {
    const resolved = resolveContextualEndEffect(snapshot, actor, action, dice, log);
    cleanupInvalidSourceConditions(snapshot, log);
    return resolved;
  }
  if (action.type === "self_heal" || action.type === "spell_self_heal") {
    const resolved = resolveSelfHeal(snapshot, actor, action, dice, log);
    cleanupInvalidSourceConditions(snapshot, log);
    return resolved;
  }
  if (action.type === "spell_teleport") { const resolved = resolveTeleport(snapshot, actor, action, targetId, log); cleanupInvalidSourceConditions(snapshot, log); return resolved; }
  if (action.type === "spell_effect" && action.requiresTarget === false) {
    beginConcentrationForCast(snapshot, actor, action, log);
    applyActionResolvedEffects(snapshot, actor, actor, action, log);
    spendActionCost(actor, action.cost);
    spendConsumableForAction(actor, action);
    cleanupInvalidSourceConditions(snapshot, log);
    return true;
  }
  if (isAreaSaveAction(action, targetId)) {
    if (!hasAreaAnchor(targetId)) {
      const resolved = action.type === "spell_object"
        ? resolveObjectSpell(snapshot, actor, action, targetId, log)
        : resolveAreaSaveSpell(snapshot, actor, action, targetId, dice, log);
      return resolved;
    }
    beginConcentrationForCast(snapshot, actor, action, log);
    const resolved = action.type === "spell_object"
      ? resolveObjectSpell(snapshot, actor, action, targetId, log)
      : resolveAreaSaveSpell(snapshot, actor, action, targetId, dice, log);
    if (!resolved) return false;
    spendActionCost(actor, action.cost);
    spendConsumableForAction(actor, action);
    checkOutcome(snapshot, log);
    cleanupInvalidSourceConditions(snapshot, log);
    return true;
  }

  const target = getActor(snapshot, targetId);
  const targetLegality = canTargetAction(snapshot, actor, action, target);
  if (!targetLegality.ok) {
    log.add("target.invalid", {
      round: snapshot.round,
      actorId: actor.id,
      actorName: actor.name,
      targetName: target?.name || targetId || "target",
      reason: targetLegality.reason,
    });
    return false;
  }

  beginConcentrationForCast(snapshot, actor, action, log);
  const targetGate = resolveTargetSaveGate(snapshot, actor, target, action, dice, log);
  if (!targetGate.ok) {
    if (targetGate.wasted) spendActionCost(actor, action.cost);
    cleanupInvalidSourceConditions(snapshot, log);
    return false;
  }

  if (action.type === "push") {
    resolvePush(snapshot, actor, target, action, dice, log);
    spendActionCost(actor, action.cost);
    checkOutcome(snapshot, log);
    cleanupInvalidSourceConditions(snapshot, log);
    return true;
  }

  if (action.type === "spell_effect") {
    applyActionResolvedEffects(snapshot, actor, target, action, log);
    spendActionCost(actor, action.cost);
    spendConsumableForAction(actor, action);
    cleanupInvalidSourceConditions(snapshot, log);
    return true;
  }

  if (action.type === "spell_auto_damage") {
    resolveAutoDamageSpell(snapshot, actor, target, action, dice, log);
  } else if (action.type === "spell_save") {
    resolveSaveSpell(snapshot, actor, target, action, dice, log);
  } else {
    resolveAttack(snapshot, actor, target, action, dice, log);
  }

  spendActionCost(actor, action.cost);
  spendConsumableForAction(actor, action);
  clearOffenseEndedConditions(actor, action, log, snapshot);
  checkOutcome(snapshot, log);
  cleanupInvalidSourceConditions(snapshot, log);
  return true;
}

function hasConsumableStock(actor, action, log, snapshot) {
  if (!action?.itemId || action.type === "consumable") return true;
  if (getItemQuantity(actor, action.itemId) > 0) return true;
  log.add("target.invalid", {
    round: snapshot.round,
    actorId: actor.id,
    actorName: actor.name,
    targetName: action.name,
    reason: `${action.name} is not in stock`,
  });
  return false;
}

function spendConsumableForAction(actor, action) {
  if (!action?.itemId || action.type === "consumable" || action.consumeOnResolve === false) return;
  spendItem(actor, action.itemId, 1);
}

function beginConcentrationForCast(snapshot, actor, action, log) { if (action?.concentration) beginConcentration(snapshot, actor, action, log); }

function hasAreaAnchor(targetPayload) {
  const anchor = targetPayload?.anchor || targetPayload;
  return Boolean(anchor && Number.isFinite(anchor.x) && Number.isFinite(anchor.y));
}

function isAreaSaveAction(action, targetPayload) {
  return action?.type === "spell_area_save" ||
    action?.type === "spell_object" ||
    (Boolean(targetPayload?.anchor) && Boolean(action?.targeting?.shape));
}

function resolvePush(snapshot, actor, target, action, dice, log) {
  const direction = pushDirection(actor.position, target.position);
  if (!direction) {
    log.add("target.invalid", {
      round: snapshot.round,
      actorId: actor.id,
      actorName: actor.name,
      targetName: target.name,
      reason: "push requires a straight adjacent target",
    });
    return false;
  }

  let movedSquares = 0;
  let collisionSquares = 0;
  let collisionAt = null;
  for (let i = 0; i < action.distanceSquares; i++) {
    const next = {
      x: target.position.x + direction.x,
      y: target.position.y + direction.y,
    };
    if (!canForcedMoveTo(snapshot, next, target.id)) {
      collisionAt = next;
      collisionSquares = action.distanceSquares - movedSquares;
      break;
    }
    const from = { ...target.position };
    target.position = next;
    movedSquares += 1;
    log.add("forced.move", {
      round: snapshot.round,
      actorId: actor.id,
      actorName: actor.name,
      targetId: target.id,
      targetName: target.name,
      from,
      to: { ...target.position },
      reason: action.name,
    });
  }

  log.add("push", {
    round: snapshot.round,
    actorId: actor.id,
    actorName: actor.name,
    targetId: target.id,
    targetName: target.name,
    movedSquares,
    intendedSquares: action.distanceSquares,
    collisionAt,
  });

  if (collisionSquares > 0) {
    applyCollisionDamage(snapshot, actor, target, action, collisionSquares, dice, log);
  }
  cleanupInvalidSourceConditions(snapshot, log);
}

function pushDirection(actorPos, targetPos) {
  const dx = targetPos.x - actorPos.x;
  const dy = targetPos.y - actorPos.y;
  if (Math.abs(dx) + Math.abs(dy) !== 1) return null;
  return { x: Math.sign(dx), y: Math.sign(dy) };
}

function canForcedMoveTo(snapshot, pos, targetId) {
  return inBounds(snapshot.grid, pos) &&
    !isMovementBlocked(snapshot.grid, pos) &&
    !combatObjectsAt(snapshot, pos).some((object) => object.blocksMovement) &&
    !actorAt(snapshot, pos, targetId);
}

function clearOffenseEndedConditions(actor, action, log, snapshot) {
  if (!isOffensiveAction(action)) return;
  for (const condition of [...(actor.conditions || [])]) {
    if (!hasConditionRule({ conditions: [condition] }, "endsOnOffense")) continue;
    removeCondition(actor, condition.id);
    log.add("condition.removed", {
      round: snapshot.round,
      actorId: actor.id,
      actorName: actor.name,
      condition: condition.id,
      reason: "actor used an offensive action",
    });
  }
}

function isOffensiveAction(action) {
  return action?.tags?.harmful === true || Boolean(action?.damage || action?.damageType || action?.attackBonus || action?.saveAbility);
}
