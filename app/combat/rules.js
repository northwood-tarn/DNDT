import { canPayActionCost, getActionUses, getMovementRemaining, hasBonusAction } from "./actor.js";
import { getConditionRules } from "./effects.js";
import { getActionTags } from "./actionTags.js";
import { distance, hasLineOfSight, isWalkable } from "./grid.js";
import { canUseMovementMode, getMovementStepCost } from "./movementRules.js";
import { canSeeActor } from "./perception.js";
import { combatObjectsAt, hasCombatObjectLineOfSight } from "./combatObjects.js";
import { canSpendSpellSlotThisTurn } from "./spellSlots.js";

export function canUseAction(actor, action) {
  if (!actor || actor.hp <= 0) return blocked("actor is not able to act");
  if (!action) return blocked("action is missing");
  if (getActionUses(action) <= 0) return blocked("no uses remaining");
  if (action.resourceId && getResourceUses(actor, action.resourceId) <= 0) return blocked("no resource uses remaining");
  for (const resourceId of action.additionalResourceIds || []) {
    if (getResourceUses(actor, resourceId) <= 0) return blocked(`no ${resourceId} uses remaining`);
  }
  const spellSlot = canSpendSpellSlotThisTurn(actor, action);
  if (!spellSlot.ok) return blocked(spellSlot.reason);
  const rig = action.deviceRig || {};
  if (rig.mode === "double_followup") {
    if (actor.turnFlags?.doubleRigFollowupAvailable !== true) return blocked("requires Double Rig follow-up");
    if (rig.immediateDamage && actor.turnFlags?.doubleRigImmediateDamageUsed === true) {
      return blocked("Double Rig already used an immediate-damage device");
    }
  }
  if (!canPayActionCost(actor, action.cost) && !canUseBonusDash(actor, action)) {
    return blocked(`${action.cost || "action"} already used`);
  }
  const tags = getActionTags(action);
  const requirement = action.requirement || action.requirements || {};
  if (requirement.equippedShield && !actor.equipment?.shieldId) return blocked("requires an equipped shield");
  if (requirement.attackActionThisTurn && actor.turnFlags?.attackActionResolved !== true) return blocked("requires an attack action earlier this turn");
  if (tags.requiresSpeech && hasConditionMechanic(actor, "cannotSpeak")) return blocked("cannot speak");
  if (tags.requiresHands && hasConditionMechanic(actor, "cannotUseHands")) return blocked("cannot use hands");
  return allowed();
}

function getResourceUses(actor, resourceId) {
  const resource = (actor.resources || []).find((item) => item.id === resourceId);
  return resource?.current ?? resource?.max ?? 0;
}

export function canMoveTo(snapshot, actor, to) {
  if (!actor || actor.hp <= 0) return blocked("actor is not able to move");
  if (hasConditionMechanic(actor, "speedZero")) return blocked("speed is 0");
  const mode = canUseMovementMode(actor, "walk");
  if (!mode.ok) return mode;
  if (!isWalkable(snapshot, to, actor.id)) return blocked("blocked, occupied, or out of bounds");
  if (combatObjectsAt(snapshot, to).some((object) => object.blocksMovement)) {
    return blocked("blocked by combat object");
  }
  if (distance(actor.position, to) !== 1) return blocked("movement must be orthogonal one square at a time");
  const cost = getMovementStepCost(snapshot, actor, actor.position, to);
  if (getMovementRemaining(actor) < cost) return blocked("no movement remaining");

  const sourceConstraint = movementSourceConstraint(snapshot, actor, to);
  if (!sourceConstraint.ok) return sourceConstraint;

  return allowed();
}

export function canTargetAction(snapshot, actor, action, target) {
  if (!actor || actor.hp <= 0) return blocked("actor is not able to act");
  if (!action) return blocked("action is missing");
  if (!target || (target.hp <= 0 && !action.allowDefeatedTarget)) return blocked("not a valid target");
  if (action.requiresDefeatedTarget && target.hp > 0) return blocked("target is not down");
  if (hasConditionMechanic(target, "untargetable")) return blocked("target cannot be targeted");
  if (isHarmfulAction(action) && target.team === actor.team) return blocked("not a valid enemy target");
  if (!isHarmfulAction(action) && target.team !== actor.team) return blocked("not a valid ally target");

  const sourceConstraint = targetSourceConstraint(actor, action, target);
  if (!sourceConstraint.ok) return sourceConstraint;

  const range = distance(actor.position, target.position);
  if (range > action.range) return blocked(`out of range (${range}/${action.range})`);
  const tags = getActionTags(action);
  const sightRequiredForTargeting = tags.requiresSight || (isHarmfulAction(action) && action.range > 1);
  if (sightRequiredForTargeting &&
      (!hasLineOfSight(snapshot.grid, actor.position, target.position) ||
        !hasCombatObjectLineOfSight(snapshot, actor.position, target.position))) {
    return blocked("line of sight blocked");
  }
  if (tags.requiresSight) {
    const sight = canSeeActor(snapshot, actor, target);
    if (!sight.ok) return sight;
  }

  return allowed();
}

export function isHarmfulAction(action) {
  return getActionTags(action).harmful === true;
}

function movementSourceConstraint(snapshot, actor, to) {
  for (const condition of actor.conditions || []) {
    const id = conditionId(condition);
    const rules = getConditionRules(id);
    if (!rules.cannotMoveCloserToSource || !condition.sourceActorId) continue;
    const source = snapshot.actors.find((item) => item.id === condition.sourceActorId);
    if (!source || source.hp <= 0) continue;
    if (rules.sourceLineOfSightAttackDisadvantage && !hasLineOfSight(snapshot.grid, actor.position, source.position)) continue;
    if (distance(to, source.position) < distance(actor.position, source.position)) {
      return blocked(`${rules.name} prevents moving closer to ${source.name}`);
    }
  }
  return allowed();
}

function targetSourceConstraint(actor, action, target) {
  if (!isHarmfulAction(action)) return allowed();
  for (const condition of actor.conditions || []) {
    const id = conditionId(condition);
    const rules = getConditionRules(id);
    if (!rules.cannotAttackSource || condition.sourceActorId !== target.id) continue;
    return blocked(`${rules.name} prevents targeting ${target.name} with harmful actions`);
  }
  return allowed();
}

function hasConditionMechanic(actor, ruleName) {
  return Array.isArray(actor?.conditions) && actor.conditions.some((condition) => {
    const id = conditionId(condition);
    return Boolean(id && getConditionRules(id)[ruleName]);
  });
}

function canUseBonusDash(actor, action) {
  return action?.type === "dash" && hasConditionMechanic(actor, "grantsBonusDash") && hasBonusAction(actor);
}

function conditionId(condition) {
  return typeof condition === "string" ? condition : condition?.id;
}

function allowed() {
  return { ok: true, reason: null };
}

function blocked(reason) {
  return { ok: false, reason };
}
