import { spendActionCost, spendActionUse, spendResourceUse } from "./actor.js";
import { applyDamageAmount, applySaveFailureEffects, rollSaveD20 } from "./combatEffectsResolution.js";
import { createCombatObjectFromAction } from "./combatObjects.js";
import { getActor, livingActors } from "./combatState.js";
import { distance } from "./grid.js";
import { applyLuckyToRoll } from "./luck.js";
import { applyMark } from "./marks.js";
import { rollSaveModifier } from "./modifiers.js";

export function resolveFeatureAction(snapshot, actor, action, targetId, dice, log) {
  if (action.object) return resolveFeatureObjectAction(snapshot, actor, action, targetId, log);
  const targets = selectFeatureTargets(snapshot, actor, action, targetId);
  if (!targets.length) {
    log.add("target.invalid", {
      round: snapshot.round,
      actorId: actor.id,
      actorName: actor.name,
      targetName: action.name,
      reason: "no valid feature targets",
    });
    return false;
  }

  for (const target of targets) {
    if (action.saveAbility) resolveFeatureSave(snapshot, actor, target, action, dice, log);
    else applySaveFailureEffects(snapshot, actor, target, action, log, dice);
    if (action.mark) applyFeatureMark(snapshot, actor, target, action, log);
  }

  applyEconomyGrant(actor, action.economyGrant || {});
  spendActionCost(actor, action.cost);
  spendActionUse(action);
  spendResourceUse(actor, action.resourceId);
  log.add("feature.action", {
    round: snapshot.round,
    actorId: actor.id,
    actorName: actor.name,
    actionName: action.name,
    cost: action.cost || "action",
    targets: targets.map((target) => ({ id: target.id, name: target.name })),
  });
  return true;
}

function resolveFeatureObjectAction(snapshot, actor, action, targetPayload, log) {
  const anchor = targetPayload?.anchor || targetPayload || actor.position;
  if (!anchor || !Number.isFinite(anchor.x) || !Number.isFinite(anchor.y)) {
    log.add("target.invalid", {
      round: snapshot.round,
      actorId: actor.id,
      actorName: actor.name,
      targetName: action.name,
      reason: "missing object anchor",
    });
    return false;
  }
  const object = createCombatObjectFromAction(action, targetPayload?.cells ? targetPayload : anchor, actor);
  snapshot.combatObjects = [...(snapshot.combatObjects || []), object];
  spendActionCost(actor, action.cost);
  spendActionUse(action);
  spendResourceUse(actor, action.resourceId);
  log.add("object.created", {
    round: snapshot.round,
    actorId: actor.id,
    actorName: actor.name,
    actionId: action.id,
    actionName: action.name,
    objectId: object.id,
    objectName: object.name,
    anchor,
    cells: object.cells || null,
    shape: object.shape,
    radiusSquares: object.radiusSquares,
  });
  return true;
}

function applyFeatureMark(snapshot, actor, target, action, log) {
  const added = applyMark(target, action.mark, actor, action);
  log.add("mark.applied", {
    round: snapshot.round,
    sourceId: actor.id,
    sourceName: actor.name,
    targetId: target.id,
    targetName: target.name,
    markId: action.mark.id,
    markLabel: action.mark.label || action.mark.name || action.name,
    actionName: action.name,
    alreadyPresent: !added,
  });
}

function applyEconomyGrant(actor, economyGrant) {
  if (!economyGrant || typeof economyGrant !== "object" || !actor.economy) return;
  if (Number.isFinite(economyGrant.actions) && economyGrant.actions > 0) actor.economy.actionAvailable = true;
  if (Number.isFinite(economyGrant.bonusActions) && economyGrant.bonusActions > 0) actor.economy.bonusActionAvailable = true;
  if (Number.isFinite(economyGrant.reactions) && economyGrant.reactions > 0) actor.economy.reactionAvailable = true;
}

function selectFeatureTargets(snapshot, actor, action, targetId) {
  if (action.requiresTarget === false && !action.targeting?.mode) return [actor];

  if (action.targeting?.mode === "nearby_actors") {
    return livingActors(snapshot)
      .filter((target) => target.id !== actor.id)
      .filter((target) => distance(actor.position, target.position) <= (action.range || 0))
      .filter((target) => targetMatchesTeam(actor, target, action.targetFilter))
      .filter((target) => targetMatchesCreatureFilter(target, action.targetFilter));
  }

  const target = getActor(snapshot, targetId);
  if (!target || target.hp <= 0) return [];
  if (Number.isFinite(action.range) && distance(actor.position, target.position) > action.range) return [];
  if (!targetMatchesTeam(actor, target, action.targetFilter)) return [];
  if (!targetMatchesCreatureFilter(target, action.targetFilter)) return [];
  return [target];
}

function resolveFeatureSave(snapshot, actor, target, action, dice, log) {
  const dc = action.spellSaveDC || action.save?.dc || 10;
  const saveModifier = rollSaveModifier(snapshot, target, action.saveAbility, action, dice);
  const baseBonus = target.saves?.[action.saveAbility] || 0;
  const bonus = baseBonus + saveModifier.total;
  const saveRoll = applyLuckyToRoll({
    actor: target,
    roll: rollSaveD20(target, action, dice, snapshot, actor),
    dice,
    log,
    context: {
      round: snapshot.round,
      type: "save",
      label: action.name,
      targetNumber: dc,
      bonus,
    },
  });
  const total = saveRoll.roll + bonus;
  const success = !saveRoll.autoFail && total >= dc;

  log.add("save.roll", {
    round: snapshot.round,
    actorId: actor.id,
    actorName: actor.name,
    targetId: target.id,
    targetName: target.name,
    spellName: action.name,
    ability: action.saveAbility,
    roll: saveRoll.roll,
    rolls: saveRoll.rolls,
    mode: saveRoll.mode,
    reasons: saveRoll.reasons,
    lucky: saveRoll.lucky,
    bonus,
    baseBonus,
    modifierReasons: saveModifier.reasons,
    cover: null,
    effectiveBonus: bonus,
    total,
    dc,
  });
  log.add("save.result", {
    round: snapshot.round,
    actorId: actor.id,
    actorName: actor.name,
    targetId: target.id,
    targetName: target.name,
    spellName: action.name,
    success,
  });

  const damage = resolveFeatureDamage(action, target);
  if (damage) {
    const rolled = dice.rollDamage(damage);
    const halvesOnSuccess = action.save?.onSuccess === "half";
    const amount = success && halvesOnSuccess ? Math.floor(Math.max(0, rolled.total) / 2) : success ? 0 : Math.max(0, rolled.total);
    if (amount > 0) applyDamageAmount(snapshot, actor, target, action, rolled, amount, dice, log);
  }
  if (!success) applySaveFailureEffects(snapshot, actor, target, action, log, dice);
}

function resolveFeatureDamage(action, target) {
  if (!action.damageByTargetProperty) return action.damage || null;
  const property = action.damageByTargetProperty.property;
  const value = target?.[property];
  return action.damageByTargetProperty.values?.[value] || action.damageByTargetProperty.default || action.damage || null;
}

function targetMatchesTeam(actor, target, filter = {}) {
  if (!filter?.team || filter.team === "any") return true;
  if (filter.team === "enemies") return target.team !== actor.team;
  if (filter.team === "allies") return target.team === actor.team;
  return true;
}

function targetMatchesCreatureFilter(target, filter = {}) {
  const types = filter.creatureTypes || [];
  if (types.length && !types.includes(target.creatureType)) return false;
  const tags = filter.tags || [];
  if (tags.length && !tags.every((tag) => (target.tags || []).includes(tag))) return false;
  return true;
}
