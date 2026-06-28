import { addCondition, increaseMovementMax, spendActionCost, spendActionUse, spendResourceUse } from "./actor.js";
import { resolveAttack } from "./attackResolution.js";
import { applyDamageAmount, applySaveFailureEffects, rollSaveD20 } from "./combatEffectsResolution.js";
import { combatObjectsAt, createCombatObjectFromAction } from "./combatObjects.js";
import { getActor, livingActors } from "./combatState.js";
import { normalizeEffectDuration } from "./effects.js";
import { actorsInFootprint, buildFootprint } from "./footprints.js";
import { actorAt, hasLineOfSight, inBounds, isMovementBlocked, distance } from "./grid.js";
import { applyLuckyToRoll } from "./luck.js";
import { applyMark } from "./marks.js";
import { addActiveEffect } from "./modifiers.js";
import { rollSaveModifier } from "./modifiers.js";

export function resolveFeatureAction(snapshot, actor, action, targetId, dice, log) {
  if (action.actionKind === "disengage") return resolveDisengageFeature(snapshot, actor, action, log);
  if (action.actionKind === "hide") return resolveHideFeature(snapshot, actor, action, log);
  if (action.actionKind === "basic_weapon_attack") return resolveFeatureWeaponAttack(snapshot, actor, action, targetId, dice, log);
  if (["spell_slot", "warlock_spell_slot"].includes(action.restoresResource) ||
      ["spell_slot", "warlock_spell_slot"].includes(action.resourceRestore?.resourceId)) {
    return resolveSpellSlotRestore(snapshot, actor, action, log);
  }
  if (action.object) return resolveFeatureObjectAction(snapshot, actor, action, targetId, log);
  if (action.targeting?.shape) return resolveFeatureAreaAction(snapshot, actor, action, targetId, dice, log);
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

  applyFeatureSideEffects(snapshot, actor, action, dice, log);
  applyEconomyGrant(actor, action.economyGrant || {});
  spendFeatureActionCosts(actor, action);
  markDeviceRig(actor, action);
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

function resolveFeatureAreaAction(snapshot, actor, action, targetPayload, dice, log) {
  const anchor = targetPayload?.anchor || targetPayload;
  if (!anchor || !Number.isFinite(anchor.x) || !Number.isFinite(anchor.y)) {
    log.add("target.invalid", {
      round: snapshot.round,
      actorId: actor.id,
      actorName: actor.name,
      targetName: action.name,
      reason: "missing area anchor",
    });
    return false;
  }

  const shape = action.targeting.shape || "radius";
  const cells = buildFootprint(snapshot.grid, shape, anchor, {
    origin: actor.position,
    radiusSquares: action.targeting.radiusSquares ?? 2,
    lengthSquares: action.targeting.lengthSquares ?? 3,
    sizeSquares: action.targeting.sizeSquares ?? 3,
  });
  const targets = actorsInFootprint(snapshot.actors, cells)
    .map((target) => getActor(snapshot, target.id))
    .filter(Boolean)
    .filter((target) => target.id !== actor.id)
    .filter((target) => target.hp > 0)
    .filter((target) => targetMatchesTeam(actor, target, action.targetFilter))
    .filter((target) => targetMatchesCreatureFilter(target, action.targetFilter));

  log.add("area.target", {
    round: snapshot.round,
    actorId: actor.id,
    actorName: actor.name,
    actionId: action.id,
    actionName: action.name,
    shape,
    anchor,
    cells,
    targets: targets.map((target) => ({ id: target.id, name: target.name })),
  });

  for (const target of targets) {
    if (action.saveAbility) resolveFeatureSave(snapshot, actor, target, action, dice, log);
    else applySaveFailureEffects(snapshot, actor, target, action, log, dice);
    if (action.mark) applyFeatureMark(snapshot, actor, target, action, log);
  }

  applyFeatureSideEffects(snapshot, actor, action, dice, log);
  applyEconomyGrant(actor, action.economyGrant || {});
  spendFeatureActionCosts(actor, action);
  markDeviceRig(actor, action);
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
  if (action.teleportFt && !resolveFeatureTeleport(snapshot, actor, action, anchor, log)) return false;
  const object = createCombatObjectFromAction(action, targetPayload?.cells ? targetPayload : anchor, actor);
  snapshot.combatObjects = [...(snapshot.combatObjects || []), object];
  applyFeatureSideEffects(snapshot, actor, action, null, log);
  spendFeatureActionCosts(actor, action);
  markDeviceRig(actor, action);
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

function applyFeatureSideEffects(snapshot, actor, action, dice, log) {
  applyTemporaryHp(snapshot, actor, action, dice, log);
  applyDashGrant(snapshot, actor, action, log);
  applySelfCondition(actor, action);
  applyActiveEffect(actor, action);
  applyPactWeaponDamageBonus(actor, action);
}

function applyDashGrant(snapshot, actor, action, log) {
  if (!action.grantsDash) return;
  increaseMovementMax(actor, actor.speed);
  log.add("dash", {
    round: snapshot.round,
    actorId: actor.id,
    actorName: actor.name,
    addedMovement: actor.speed,
    movementBefore: null,
    movementAfter: actor.movementRemaining,
    reason: action.name,
  });
}

function applyTemporaryHp(snapshot, actor, action, dice, log) {
  if (!action.temporaryHpFormula) return;
  const rolled = dice?.rollDamage ? dice.rollDamage(action.temporaryHpFormula) : null;
  const amount = Math.max(0, rolled?.total ?? Number(action.temporaryHpFormula) ?? 0);
  const before = actor.tempHp || 0;
  actor.tempHp = Math.max(before, amount);
  log.add("temp_hp.applied", {
    round: snapshot.round,
    sourceId: actor.id,
    sourceName: actor.name,
    targetId: actor.id,
    targetName: actor.name,
    actionName: action.name,
    amount: actor.tempHp,
    before,
  });
}

function applySelfCondition(actor, action) {
  if (!action.selfCondition?.id) return;
  addCondition(actor, {
    id: action.selfCondition.id,
    label: action.selfCondition.label || action.name,
    sourceActionId: action.id,
    sourceActorId: actor.id,
    duration: normalizeEffectDuration(action.selfCondition.duration || action.duration),
    damageRetaliation: structuredClone(action.selfCondition.damageRetaliation || null),
  });
}

function applyActiveEffect(actor, action) {
  if (!action.activeEffectOnResolve) return;
  addActiveEffect(actor, {
    ...structuredClone(action.activeEffectOnResolve),
    id: action.activeEffectOnResolve.id || `${action.id}_active`,
    label: action.activeEffectOnResolve.label || action.name,
    sourceActionId: action.id,
    sourceActorId: actor.id,
    duration: normalizeEffectDuration(action.activeEffectOnResolve.duration || action.duration),
  });
}

function applyPactWeaponDamageBonus(actor, action) {
  const bonus = action.pactWeaponDamageBonus;
  if (!bonus?.dice) return;
  const damageType = action.damageType || bonus.damageType || bonus.damageTypeChoice?.[0] || "untyped";
  addActiveEffect(actor, {
    id: `${action.id}_pact_weapon_damage`,
    label: action.name,
    sourceActionId: action.id,
    sourceActorId: actor.id,
    duration: normalizeEffectDuration(action.duration || { rounds: 10, tick: "turn_end" }),
    damageRider: {
      trigger: "source_hits_with_attack_roll",
      damage: bonus.dice,
      damageType,
      actionTags: ["weapon"],
    },
  });
}

function resolveFeatureTeleport(snapshot, actor, action, to, log) {
  const range = Math.ceil((Number(action.teleportFt) || 0) / 5);
  const legality = canFeatureTeleportTo(snapshot, actor, action, to, range);
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

function canFeatureTeleportTo(snapshot, actor, action, to, range) {
  if (!to || !Number.isFinite(to.x) || !Number.isFinite(to.y)) return { ok: false, reason: "destination is missing" };
  if (distance(actor.position, to) > range) return { ok: false, reason: `out of range (${distance(actor.position, to)}/${range})` };
  if (!inBounds(snapshot.grid, to)) return { ok: false, reason: "destination is out of bounds" };
  if (isMovementBlocked(snapshot.grid, to) || actorAt(snapshot, to, actor.id)) return { ok: false, reason: "destination is blocked or occupied" };
  if (combatObjectsAt(snapshot, to).some((object) => object.blocksMovement)) return { ok: false, reason: "destination is blocked by combat object" };
  if (action.requiresSight && !hasLineOfSight(snapshot.grid, actor.position, to)) return { ok: false, reason: "destination cannot be seen" };
  return { ok: true, reason: null };
}

function resolveDisengageFeature(snapshot, actor, action, log) {
  actor.turnFlags ??= {};
  actor.turnFlags.disengaged = true;
  spendFeatureActionCosts(actor, action);
  log.add("feature.action", {
    round: snapshot.round,
    actorId: actor.id,
    actorName: actor.name,
    actionName: action.name,
    cost: action.cost || "action",
    targets: [{ id: actor.id, name: actor.name }],
    effect: "disengage",
  });
  return true;
}

function resolveHideFeature(snapshot, actor, action, log) {
  addCondition(actor, {
    id: "hidden",
    label: "Hidden",
    sourceActionId: action.id,
    sourceActorId: actor.id,
    duration: normalizeEffectDuration("turn_start"),
  });
  spendFeatureActionCosts(actor, action);
  log.add("feature.action", {
    round: snapshot.round,
    actorId: actor.id,
    actorName: actor.name,
    actionName: action.name,
    cost: action.cost || "action",
    targets: [{ id: actor.id, name: actor.name }],
    effect: "hidden",
  });
  return true;
}

function resolveFeatureWeaponAttack(snapshot, actor, action, targetId, dice, log) {
  const [target] = selectFeatureTargets(snapshot, actor, action, targetId);
  if (!target) {
    log.add("target.invalid", {
      round: snapshot.round,
      actorId: actor.id,
      actorName: actor.name,
      targetName: action.name,
      reason: "no valid weapon attack target",
    });
    return false;
  }
  const weaponAction = findFeatureWeaponAction(actor, target);
  if (!weaponAction) {
    log.add("target.invalid", {
      round: snapshot.round,
      actorId: actor.id,
      actorName: actor.name,
      targetName: target.name,
      reason: "no weapon attack available",
    });
    return false;
  }
  resolveAttack(snapshot, actor, target, { ...weaponAction, cost: action.cost }, dice, log);
  spendFeatureActionCosts(actor, action);
  log.add("feature.action", {
    round: snapshot.round,
    actorId: actor.id,
    actorName: actor.name,
    actionName: action.name,
    cost: action.cost || "action",
    targets: [{ id: target.id, name: target.name }],
    resolvedActionId: weaponAction.id,
    resolvedActionName: weaponAction.name,
  });
  return true;
}

function findFeatureWeaponAction(actor, target) {
  const weaponActions = (actor.actions || []).filter((item) =>
    (item.type === "weapon_attack" || item.type === "melee_attack" || item.type === "compound_weapon_attack") &&
    getActionRange(item) >= distance(actor.position, target.position)
  );
  return weaponActions[0] || null;
}

function getActionRange(action) {
  return Number.isFinite(action?.range) ? action.range : 1;
}

function resolveSpellSlotRestore(snapshot, actor, action, log) {
  const amount = Number(action.resourceRestore?.amount ?? action.amount ?? 1) || 1;
  const restored = restoreSpellSlots(actor, amount);
  if (!restored.length) {
    log.add("target.invalid", {
      round: snapshot.round,
      actorId: actor.id,
      actorName: actor.name,
      targetName: action.name,
      reason: "no expended spell slot to restore",
    });
    return false;
  }
  spendFeatureActionCosts(actor, action);
  log.add("resource.restore", {
    round: snapshot.round,
    actorId: actor.id,
    actorName: actor.name,
    actionName: action.name,
    resourceId: "spell_slot",
    restored,
  });
  return true;
}

function restoreSpellSlots(actor, amount) {
  const slots = actor.spellSlots || {};
  const restored = [];
  const levels = Object.keys(slots)
    .map((level) => Number(level))
    .filter(Number.isFinite)
    .sort((a, b) => b - a);
  for (let remaining = amount; remaining > 0; remaining -= 1) {
    const level = levels.find((slotLevel) => {
      const slot = slots[slotLevel];
      return slot && Number.isFinite(slot.max) && Number.isFinite(slot.current) && slot.current < slot.max;
    });
    if (!level) break;
    slots[level].current += 1;
    restored.push({ level, current: slots[level].current, max: slots[level].max });
  }
  return restored;
}

function spendFeatureActionCosts(actor, action) {
  spendActionCost(actor, action.cost);
  spendActionUse(action);
  spendResourceUse(actor, action.resourceId);
  for (const resourceId of action.additionalResourceIds || []) {
    spendResourceUse(actor, resourceId);
  }
}

function markDeviceRig(actor, action) {
  const rig = action.deviceRig || {};
  if (!rig.mode) return;
  actor.turnFlags ??= {};
  if (rig.mode === "double_first") {
    actor.turnFlags.doubleRigFollowupAvailable = true;
    actor.turnFlags.doubleRigImmediateDamageUsed = rig.immediateDamage === true;
  }
  if (rig.mode === "double_followup") {
    actor.turnFlags.doubleRigFollowupAvailable = false;
    if (rig.immediateDamage) actor.turnFlags.doubleRigImmediateDamageUsed = true;
  }
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
  filter ||= {};
  if (!filter?.team || filter.team === "any") return true;
  if (filter.team === "enemies") return target.team !== actor.team;
  if (filter.team === "allies") return target.team === actor.team;
  return true;
}

function targetMatchesCreatureFilter(target, filter = {}) {
  filter ||= {};
  const types = filter.creatureTypes || [];
  if (types.length && !types.includes(target.creatureType)) return false;
  const tags = filter.tags || [];
  if (tags.length && !tags.every((tag) => (target.tags || []).includes(tag))) return false;
  return true;
}
