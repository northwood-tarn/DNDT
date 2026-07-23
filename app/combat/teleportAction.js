import { actorAt, distance, hasLineOfSight, inBounds, isMovementBlocked } from "./grid.js";
import { blockingContainmentBoundary, combatObjectsAt } from "./combatObjects.js";
import { spendActionCost, spendActionUse, spendResourceUse } from "./actor.js";
import { spendActionSpellSlot } from "./spellSlots.js";
import { rollSaveD20 } from "./combatEffectsResolution.js";
import { rollSaveModifier } from "./modifiers.js";
import { applyLuckyToRoll } from "./luck.js";

export function resolveTeleport(snapshot, actor, action, targetPayload, log, dice = null) {
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
  const cage = teleportBoundary(snapshot, actor.position, to);
  if (cage && !resolveContainmentEscape(snapshot, actor, action, cage, dice, log)) {
    spendTeleportAction(actor, action);
    return false;
  }
  const from = { ...actor.position };
  actor.position = { ...to };
  spendTeleportAction(actor, action);
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

function teleportBoundary(snapshot, from, to) {
  const boundary = blockingContainmentBoundary(snapshot, from, to);
  return boundary?.blocksTeleport === true && combatObjectsAt(snapshot, from).includes(boundary) ? boundary : null;
}

function resolveContainmentEscape(snapshot, actor, action, cage, dice, log) {
  if (!dice) return false;
  const ability = cage.teleportSaveAbility || "cha";
  const dc = cage.spellSaveDC || 10;
  const saveAction = { name: `${cage.name} escape`, saveAbility: ability };
  const modifier = rollSaveModifier(snapshot, actor, ability, saveAction, dice);
  const baseBonus = actor.saves?.[ability] || 0;
  const bonus = baseBonus + modifier.total;
  const roll = applyLuckyToRoll({
    actor,
    roll: rollSaveD20(actor, saveAction, dice, snapshot, null),
    dice,
    log,
    context: { round: snapshot.round, type: "save", label: saveAction.name, targetNumber: dc, bonus },
  });
  const success = !roll.autoFail && roll.roll + bonus >= dc;
  log.add("save.roll", {
    round: snapshot.round, actorId: actor.id, actorName: actor.name, spellName: action.name,
    ability, roll: roll.roll, rolls: roll.rolls, mode: roll.mode, reasons: roll.reasons,
    lucky: roll.lucky, bonus, baseBonus, modifierReasons: modifier.reasons, cover: null,
    effectiveBonus: bonus, total: roll.roll + bonus, dc,
  });
  log.add("save.result", {
    round: snapshot.round, actorId: actor.id, actorName: actor.name,
    spellName: action.name, success, reason: `${cage.name} teleport escape`,
  });
  return success;
}

function spendTeleportAction(actor, action) {
  spendActionCost(actor, action.cost);
  spendActionSpellSlot(actor, action);
  spendActionUse(action);
  spendResourceUse(actor, action.resourceId);
  for (const resourceId of action.additionalResourceIds || []) spendResourceUse(actor, resourceId);
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
