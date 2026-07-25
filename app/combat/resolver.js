import { actorAt, distance, inBounds, isMovementBlocked } from "./grid.js";
import {
  getMovementRemaining,
  getItemQuantity,
  getStandingCost,
  hasCondition,
  hasConditionRule,
  removeCondition,
  resetTurnEconomy,
  spendActionCost,
  spendResourceUse,
  spendItem,
  spendMovement,
  syncContextualActions,
  syncLegacyEconomyFields,
} from "./actor.js";
import { getConditionRules } from "./effects.js";
import { checkOutcome, currentActor, getActor, livingActors } from "./combatState.js";
import { cleanupInvalidSourceConditions, processOngoingEffects } from "./conditionLifecycle.js";
import { getMovementEntryHazards, getMovementStepCost } from "./movementRules.js";
import { dispatchActorTrigger } from "./triggers.js";
import {
  resolveConsumable,
  resolveContextualEndEffect,
  resolveDash,
  resolveDodge,
  resolveHealingAction,
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
import { blockingContainmentBoundary, combatObjectContains, combatObjectsAt } from "./combatObjects.js";
import { applyDamageAmount, rollSaveD20 } from "./combatEffectsResolution.js";
import { rollRiderDamage } from "./damageRolls.js";
import { rollSaveModifier } from "./modifiers.js";
import { canMoveTo, canTargetAction, canUseAction } from "./rules.js";
import { applySpellCastEndEffects } from "./spellCastEndEffects.js";
import { spendActionSpellSlot } from "./spellSlots.js";
import { resolveTeleport } from "./teleportAction.js";
import { resolveCompoundWeaponAttack } from "./weaponMasteryActions.js";
import { getLanterna, setOil } from "../systems/lanternaSystem.js";
export { checkOutcome, currentActor, getActor, livingActors } from "./combatState.js";

export function startTurn(snapshot, actor, log, dice = null) {
  const droppedEnemyOnPreviousTurn = actor?.combatFlags?.droppedEnemyOnLastTurn === true;
  processOngoingEffects(snapshot, actor, "turn_start", dice, log);
  resolveLastLightOverloads(snapshot, actor, dice, log);
  resetTurnEconomy(actor, snapshot);
  actor.turnFlags.droppedEnemyOnPreviousTurn = droppedEnemyOnPreviousTurn;
  actor.combatFlags ??= {};
  actor.combatFlags.droppedEnemyOnLastTurn = false;
  dispatchActorTrigger(snapshot, "turn_start", actor, dice, log);
  syncLastLightCollapseActions(snapshot, actor);
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
  if (!force) trackMovementStep(actor, from, to);
  log.add("move", {
    round: snapshot.round,
    actorId: actor.id,
    actorName: actor.name,
    from,
    to: { ...actor.position },
    movementRemaining: getMovementRemaining(actor),
  });
  if (!force) {
    for (const hazard of getMovementEntryHazards(snapshot, actor, to)) {
      log.add("hazard.entered", {
        round: snapshot.round,
        actorId: actor.id,
        actorName: actor.name,
        position: { ...to },
        hazardId: hazard.hazardId,
        save: hazard.save,
        damage: hazard.damage,
        condition: hazard.condition,
      });
    }
  }
  if (!force) dispatchActorTrigger(snapshot, "enter_area", actor, dice, log, { from, to });
  cleanupInvalidSourceConditions(snapshot, log);
  return true;
}

export function resolveAction(snapshot, actor, actionId, targetId, dice, log) {
  if (!actor || actor.hp <= 0 || snapshot.outcome) return false;
  syncLegacyEconomyFields(actor);
  syncContextualActions(actor);
  const baseAction = actor.actions.find((item) => item.id === actionId) || actor.actions[0];
  const action = actionWithTargetChoices(baseAction, targetId);
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

  if (action.type === "relic_revivify") {
    const target = getActor(snapshot, targetActorId(targetId));
    const legality = canTargetAction(snapshot, actor, action, target);
    if (!legality.ok) return false;
    target.hp = 1;
    target.defeated = false;
    spendActionCost(actor, action.cost);
    action.uses.remaining = Math.max(0, (action.uses.remaining ?? action.uses.max ?? 1) - 1);
    const backlash = dice.rollDamage("3d10");
    const hpBefore = actor.hp;
    actor.hp = Math.max(0, actor.hp - backlash.total);
    actor.defeated = actor.hp <= 0;
    log.add("actor.revive", { round: snapshot.round, actorId: target.id, actorName: target.name, sourceId: actor.id, sourceName: actor.name, hp: 1, reason: action.name });
    log.add("damage.applied", { round: snapshot.round, sourceId: actor.id, sourceName: actor.name, targetId: actor.id, targetName: actor.name, amount: hpBefore - actor.hp, originalAmount: backlash.total, damageModifiers: [], damageType: "necrotic", hpBefore, hpAfter: actor.hp, unavoidable: true });
    checkOutcome(snapshot, log);
    return true;
  }

  if (action.type === "dash") {
    const resolved = resolveDash(snapshot, actor, action, log);
    cleanupInvalidSourceConditions(snapshot, log);
    return resolved;
  }
  if (action.type === "feature_action" && action.actionKind === "staff_of_the_adder_transform") {
    actor.activeEffects ??= [];
    actor.activeEffects.push({
      id: "staff_of_the_adder_awakened", label: "Awakened Adder",
      duration: { kind: "rounds", rounds: 10, remaining: 10, tick: "turn_end" },
      damageRider: {
        id: "staff_of_the_adder_poison", trigger: "source_hits_with_attack_roll", damage: "1d6", damageType: "poison", actionTags: ["weapon"],
        effects: [{ type: "condition", trigger: "hit", condition: "opportunity_attacks_blocked", noSave: true, duration: { kind: "until", point: "source_turn_start" } }],
      },
    });
    spendActionCost(actor, action.cost);
    spendResourceUse(actor, action.resourceId);
    log.add("effect.applied", { round: snapshot.round, sourceId: actor.id, sourceName: actor.name, targetId: actor.id, targetName: actor.name, effectId: "staff_of_the_adder_awakened", label: "Awakened Adder", actionName: action.name });
    return true;
  }
  if (action.type === "dodge") {
    const resolved = resolveDodge(snapshot, actor, action, log);
    cleanupInvalidSourceConditions(snapshot, log);
    return resolved;
  }
  if (action.type === "feature_action") {
    if (action.actionKind === "collapse_combat_object") {
      const resolved = resolveCollapseCombatObject(snapshot, actor, action, dice, log);
      cleanupInvalidSourceConditions(snapshot, log);
      return resolved;
    }
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
  if (action.type === "spell_post_hit") {
    const target = getActor(snapshot, targetActorId(targetId));
    if (!action.contextual || !target || target.id !== action.postHitTargetId) return false;
    let damage = action.damage;
    const creatureType = String(target.creatureType || "").toLowerCase();
    if ((action.bonusAgainstCreatureTypes || []).includes(creatureType) && action.bonusDamage === "1d8") {
      const match = String(damage).match(/^(\d+)d8$/);
      if (match) damage = `${Number(match[1]) + 1}d8`;
    }
    const rolled = rollRiderDamage(damage, dice, { critical: action.postHitCritical === true });
    applyDamageAmount(snapshot, actor, target, { ...action, damage }, rolled, Math.max(0, rolled.total), dice, log);
    spendActionCost(actor, action.cost);
    spendActionLinkedResources(actor, action);
    actor.turnFlags.contextualActions = (actor.turnFlags.contextualActions || []).filter((item) => item.type !== "spell_post_hit");
    syncContextualActions(actor);
    afterResolvedAction(snapshot, actor, action, log);
    checkOutcome(snapshot, log);
    return true;
  }
  if (action.type === "self_heal") {
    const resolved = resolveSelfHeal(snapshot, actor, action, dice, log);
    cleanupInvalidSourceConditions(snapshot, log);
    return resolved;
  }
  if (action.type === "spell_self_heal" && !(Number.isFinite(action.maxTargets) && action.maxTargets > 1)) {
    const target = action.requiresTarget === false ? actor : getActor(snapshot, targetActorId(targetId));
    const targetLegality = action.requiresTarget === false
      ? { ok: true }
      : canTargetAction(snapshot, actor, action, target);
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
    const resolved = resolveHealingAction(snapshot, actor, target, action, dice, log);
    cleanupInvalidSourceConditions(snapshot, log);
    return resolved;
  }
  if (action.type === "spell_teleport") {
    const resolved = resolveTeleport(snapshot, actor, action, targetId, log, dice);
    if (resolved) afterResolvedAction(snapshot, actor, action, log);
    cleanupInvalidSourceConditions(snapshot, log);
    return resolved;
  }
  if (action.type === "move_spell_area") {
    const anchor = targetId?.anchor || targetId;
    const object = (snapshot.combatObjects || []).find((item) => item.sourceActorId === actor.id && item.sourceActionId === action.objectSourceActionId);
    if (!object || !anchor || !Number.isFinite(anchor.x) || !Number.isFinite(anchor.y)) return false;
    const from = object.position ? { ...object.position } : null;
    object.position = { x: anchor.x, y: anchor.y };
    spendActionCost(actor, action.cost);
    log.add("object.moved", { round: snapshot.round, actorId: actor.id, actorName: actor.name, actionName: action.name, objectId: object.id, objectName: object.name, from, to: object.position });
    cleanupInvalidSourceConditions(snapshot, log);
    return true;
  }
  if (action.type === "spell_effect" && action.requiresTarget === false) {
    beginConcentrationForCast(snapshot, actor, action, log);
    applyActionResolvedEffects(snapshot, actor, actor, action, log);
    spendActionCost(actor, action.cost);
    spendActionLinkedResources(actor, action);
    spendConsumableForAction(actor, action);
    afterResolvedAction(snapshot, actor, action, log);
    cleanupInvalidSourceConditions(snapshot, log);
    return true;
  }
  if (isAreaSaveAction(action, targetId)) {
    if (!hasAreaAnchor(targetId)) {
      const resolved = action.type === "spell_object"
        ? resolveObjectSpell(snapshot, actor, action, targetId, log, dice)
        : resolveAreaSaveSpell(snapshot, actor, action, targetId, dice, log);
      return resolved;
    }
    beginConcentrationForCast(snapshot, actor, action, log);
    const resolved = action.type === "spell_object"
      ? resolveObjectSpell(snapshot, actor, action, targetId, log, dice)
      : resolveAreaSaveSpell(snapshot, actor, action, targetId, dice, log);
    if (!resolved) return false;
    applySpellCastEndEffects(snapshot, actor, action, log, log.events.length);
    spendActionCost(actor, action.cost);
    spendActionLinkedResources(actor, action);
    spendConsumableForAction(actor, action);
    afterResolvedAction(snapshot, actor, action, log);
    checkOutcome(snapshot, log);
    cleanupInvalidSourceConditions(snapshot, log);
    return true;
  }

  if (isIndividualMultiTargetAction(action)) {
    const rawTargetIds = targetActorIds(targetId);
    const targetIds = (!isExplicitTargetList(targetId) && action.targetAssignments === "per_hit" && rawTargetIds.length === 1)
      ? Array(action.maxTargets).fill(rawTargetIds[0])
      : rawTargetIds.slice(0, action.maxTargets);
    const targets = targetIds
      .map((id) => getActor(snapshot, id))
      .filter(Boolean);
    const selectedTargets = action.allowRepeatedTargets ? targets : uniqueActors(targets).slice(0, action.maxTargets);
    const linkedRangeInvalid = action.linkedTargetRange && selectedTargets.length > 1
      ? selectedTargets.slice(1).find((target) => distance(selectedTargets[0].position, target.position) > action.linkedTargetRange)
      : null;
    const invalidTarget = selectedTargets.find((target) => !canTargetAction(snapshot, actor, action, target).ok);
    if (!selectedTargets.length || invalidTarget || linkedRangeInvalid) {
      const targetLegality = linkedRangeInvalid
        ? { reason: `secondary target is more than ${action.linkedTargetRange * 5} feet from the primary target` }
        : invalidTarget ? canTargetAction(snapshot, actor, action, invalidTarget) : { reason: "no valid targets selected" };
      log.add("target.invalid", {
        round: snapshot.round,
        actorId: actor.id,
        actorName: actor.name,
        targetName: invalidTarget?.name || "targets",
        reason: targetLegality.reason,
      });
      return false;
    }
    beginConcentrationForCast(snapshot, actor, action, log);
    const startEventIndex = log.events.length;
    const tempHpShare = action.tempHpPool ? Math.floor(action.tempHpPool / selectedTargets.length) : null;
    for (const [index, target] of selectedTargets.entries()) {
      const gate = resolveTargetSaveGate(snapshot, actor, target, action, dice, log);
      if (!gate.ok) continue;
      if (action.type === "spell_effect") {
        const resolvedAction = tempHpShare == null ? action : {
          ...action,
          effects: action.effects.map((effect) => effect.type === "temp_hp" ? { ...effect, amount: tempHpShare } : effect),
        };
        applyActionResolvedEffects(snapshot, actor, target, resolvedAction, log);
      } else if (action.type === "spell_self_heal") {
        resolveHealingAction(snapshot, actor, target, action, dice, log, { spend: false });
      } else if (action.type === "spell_save") {
        resolveSaveSpell(snapshot, actor, target, action, dice, log);
      } else if (action.type === "spell_auto_damage") {
        resolveAutoDamageSpell(snapshot, actor, target, {
          ...action,
          id: `${action.id}_${index + 1}`,
          name: `${action.name} ${index + 1}`,
          hits: action.targetAssignments === "per_hit" ? 1 : action.hits,
        }, dice, log);
      } else if (action.type === "spell_attack") {
        resolveAttack(snapshot, actor, target, {
          ...action,
          id: `${action.id}_${index + 1}`,
          name: `${action.name} ${index + 1}`,
          repeatAttacks: action.targetAssignments === "per_hit" ? 1 : action.repeatAttacks,
          singleRepeatedAttack: true,
        }, dice, log);
      }
    }
    applySpellCastEndEffects(snapshot, actor, action, log, startEventIndex);
    spendActionCost(actor, action.cost);
    spendActionLinkedResources(actor, action);
    spendConsumableForAction(actor, action);
    afterResolvedAction(snapshot, actor, action, log);
    clearOffenseEndedConditions(actor, action, log, snapshot);
    checkOutcome(snapshot, log);
    cleanupInvalidSourceConditions(snapshot, log);
    return true;
  }

  const target = getActor(snapshot, targetActorId(targetId));
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
    spendActionLinkedResources(actor, action);
    afterResolvedAction(snapshot, actor, action, log);
    checkOutcome(snapshot, log);
    cleanupInvalidSourceConditions(snapshot, log);
    return true;
  }

  if (action.type === "spell_effect") {
    applyActionResolvedEffects(snapshot, actor, target, action, log);
    spendActionCost(actor, action.cost);
    spendActionLinkedResources(actor, action);
    spendConsumableForAction(actor, action);
    afterResolvedAction(snapshot, actor, action, log);
    cleanupInvalidSourceConditions(snapshot, log);
    return true;
  }

  const spellEventStart = log.events.length;
  if (action.type === "spell_auto_damage") {
    resolveAutoDamageSpell(snapshot, actor, target, action, dice, log);
  } else if (action.type === "compound_weapon_attack") {
    resolveCompoundWeaponAttack(snapshot, actor, target, action, dice, log, { resolveAttack });
  } else if (action.type === "spell_save") {
    resolveSaveSpell(snapshot, actor, target, action, dice, log);
  } else {
    resolveAttack(snapshot, actor, target, action, dice, log);
  }
  applySpellCastEndEffects(snapshot, actor, action, log, spellEventStart);

  markActionResolvedForTurn(actor, action);
  spendActionCost(actor, action.cost);
  spendActionLinkedResources(actor, action);
  spendConsumableForAction(actor, action);
  afterResolvedAction(snapshot, actor, action, log);
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

function spendActionLinkedResources(actor, action) {
  spendActionSpellSlot(actor, action);
  spendResourceUse(actor, action.resourceId);
  for (const resourceId of action.additionalResourceIds || []) spendResourceUse(actor, resourceId);
  const oilCost = Math.max(0, Math.floor(Number(action.lanternaOilCost) || 0));
  if (oilCost) setOil(getLanterna().oil - oilCost);
}

function afterResolvedAction(snapshot, actor, action, log) {
  applyEquipmentSpellCastEffects(snapshot, actor, action, log);
  if (action.consumesEquippedItemId) {
    if (actor.equipment?.headwearId === action.consumesEquippedItemId) actor.equipment.headwearId = null;
    if (Array.isArray(actor.equipment?.itemIds)) actor.equipment.itemIds = actor.equipment.itemIds.filter((id) => id !== action.consumesEquippedItemId);
    actor.actions = (actor.actions || []).filter((candidate) => candidate.consumesEquippedItemId !== action.consumesEquippedItemId);
  }
  if (action.forbiddenTranscriptionRepeat) {
    clearForbiddenTranscriptionRepeat(actor);
    return;
  }
  if (shouldOfferForbiddenTranscription(actor, action)) {
    grantForbiddenTranscriptionRepeat(snapshot, actor, action, log);
    return;
  }
  clearForbiddenTranscriptionRepeat(actor);
}

function applyEquipmentSpellCastEffects(snapshot, actor, action, log) {
  if (!action?.type?.startsWith("spell_") || action.grantedByActionId) return;
  for (const effect of actor.equipmentTraits?.onSpellCast || []) {
    if (effect.kind !== "heal_wearer") continue;
    const amount = effect.amountFrom === "spell_level" ? Math.max(0, Number(action.spellLevel) || 0) : Math.max(0, Number(effect.amount) || 0);
    if (amount <= 0 || actor.hp >= actor.maxHp) continue;
    const before = actor.hp;
    actor.hp = Math.min(actor.maxHp, actor.hp + amount);
    log.add("healing.applied", {
      round: snapshot.round,
      sourceId: actor.id,
      sourceName: actor.name,
      targetId: actor.id,
      targetName: actor.name,
      actionName: action.name,
      sourceItemId: effect.sourceItemId,
      sourceItemName: effect.sourceItemName,
      amount: actor.hp - before,
      before,
    });
  }
}

function shouldOfferForbiddenTranscription(actor, action) {
  if (!action?.type?.startsWith("spell_")) return false;
  if (action.forbiddenTranscriptionRepeat) return false;
  if (action.spellLevel <= 0) return false;
  if (actor.role !== "warlock") return false;
  return (actor.resources || []).some((resource) => resource.id === "forbidden_transcription" && (resource.current ?? resource.max ?? 0) > 0);
}

function grantForbiddenTranscriptionRepeat(snapshot, actor, action, log) {
  actor.turnFlags ??= {};
  actor.turnFlags.contextualActions = [createForbiddenTranscriptionAction(action)];
  syncContextualActions(actor);
  log.add("action.granted", {
    round: snapshot.round,
    sourceId: actor.id,
    sourceName: actor.name,
    targetId: actor.id,
    targetName: actor.name,
    actionId: actor.turnFlags.contextualActions[0].id,
    actionName: actor.turnFlags.contextualActions[0].name,
    sourceActionId: action.id,
  });
}

function createForbiddenTranscriptionAction(action) {
  return {
    ...structuredClone(action),
    id: `forbidden_transcription_${action.id}`,
    name: `Forbidden Transcription: ${action.name}`,
    cost: "free",
    resourceId: "forbidden_transcription",
    uses: null,
    contextual: true,
    forbiddenTranscriptionRepeat: true,
    description: `Cast ${action.name} again without expending a spell slot.`,
  };
}

function clearForbiddenTranscriptionRepeat(actor) {
  if (!actor.turnFlags?.contextualActions?.length) return;
  actor.turnFlags.contextualActions = actor.turnFlags.contextualActions
    .filter((action) => !action.forbiddenTranscriptionRepeat);
  syncContextualActions(actor);
}

function syncLastLightCollapseActions(snapshot, actor) {
  const actions = (actor.turnFlags?.contextualActions || []).filter((action) => action.actionKind !== "collapse_combat_object");
  for (const object of snapshot.combatObjects || []) {
    if (object.sourceActorId !== actor.id || object.sourceActionId !== "last_light" || !object.collapse?.manual) continue;
    const manualTimer = timerForCollapse(object, object.collapse.manual);
    if (!manualTimer || manualTimer.active === false) continue;
    actions.push({
      id: `collapse_${object.id}`,
      name: "Collapse Last Light",
      type: "feature_action",
      actionKind: "collapse_combat_object",
      cost: "bonus",
      requiresTarget: false,
      objectId: object.id,
      contextual: true,
      tags: { feature: true, harmful: true },
    });
  }
  actor.turnFlags ??= {};
  actor.turnFlags.contextualActions = actions;
}

function resolveLastLightOverloads(snapshot, actor, dice, log) {
  if (!dice) return;
  for (const object of [...(snapshot.combatObjects || [])]) {
    if (object.sourceActorId !== actor.id || object.sourceActionId !== "last_light") continue;
    const collapse = object.collapse?.automatic;
    const timer = timerForCollapse(object, collapse);
    if (!collapse || !timer?.active || !Number.isFinite(timer.explodesAtDice) || timer.currentDice < timer.explodesAtDice) continue;
    const action = {
      id: `overload_${object.id}`,
      name: `${object.name} Overload`,
      spellSaveDC: object.spellSaveDC,
    };
    const damage = damageForCollapse(object, collapse);
    const targets = collapseTargets(snapshot, actor, object, collapse);
    for (const target of targets) resolveCollapseDamage(snapshot, actor, target, action, object, collapse, damage, dice, log);
    timer.active = false;
    if (collapse.removeObject !== false) {
      snapshot.combatObjects = (snapshot.combatObjects || []).filter((item) => item.id !== object.id);
    }
    log.add("object.removed", {
      round: snapshot.round,
      actorId: actor.id,
      actorName: actor.name,
      objectId: object.id,
      objectName: object.name,
      actionId: action.id,
      reason: "overloaded",
    });
  }
}

function resolveCollapseCombatObject(snapshot, actor, action, dice, log) {
  const object = (snapshot.combatObjects || []).find((item) => item.id === action.objectId);
  if (!object || object.sourceActorId !== actor.id) {
    log.add("target.invalid", {
      round: snapshot.round,
      actorId: actor.id,
      actorName: actor.name,
      targetName: action.name,
      reason: "missing combat object",
    });
    return false;
  }
  const collapse = object.collapse?.manual || {};
  const timer = timerForCollapse(object, collapse);
  if (timer?.active === false) {
    log.add("target.invalid", {
      round: snapshot.round,
      actorId: actor.id,
      actorName: actor.name,
      targetName: action.name,
      reason: "timer inactive",
    });
    return false;
  }
  const damage = damageForCollapse(object, collapse);
  const targets = collapseTargets(snapshot, actor, object, collapse);
  for (const target of targets) {
    resolveCollapseDamage(snapshot, actor, target, action, object, collapse, damage, dice, log);
  }
  snapshot.combatObjects = (snapshot.combatObjects || []).filter((item) => item.id !== object.id);
  spendActionCost(actor, action.cost);
  actor.turnFlags.contextualActions = (actor.turnFlags.contextualActions || []).filter((item) => item.id !== action.id);
  syncContextualActions(actor);
  log.add("object.removed", {
    round: snapshot.round,
    actorId: actor.id,
    actorName: actor.name,
    objectId: object.id,
    objectName: object.name,
    actionId: action.id,
    reason: "collapsed",
  });
  return true;
}

function timerForCollapse(object, collapse) {
  const timerId = collapse?.timer || collapse?.damage?.diceFromTimer;
  if (!timerId) return null;
  return object.timers?.[timerId] || null;
}

function damageForCollapse(object, collapse) {
  const timer = timerForCollapse(object, collapse);
  if (timer) return `${timer.currentDice || timer.startDice || 4}${timer.die || "d8"}`;
  return `${object.intensity?.currentDice || object.intensity?.startDice || 4}${object.intensity?.die || "d8"}`;
}

function collapseTargets(snapshot, actor, object, collapse) {
  return livingActors(snapshot)
    .filter((target) => collapse.target !== "enemies_in_area" || target.team !== actor.team)
    .filter((target) => combatObjectContains(snapshot, object, target.position));
}

function resolveCollapseDamage(snapshot, actor, target, action, object, collapse, damage, dice, log) {
  if (!dice) return;
  const save = collapse.save || {};
  const ability = String(save.ability || "constitution").slice(0, 3).toLowerCase();
  const dc = object.spellSaveDC || action.spellSaveDC || 10;
  const saveModifier = rollSaveModifier(snapshot, target, ability, { name: action.name, saveAbility: ability }, dice);
  const baseBonus = target.saves?.[ability] || 0;
  const bonus = baseBonus + saveModifier.total;
  const roll = rollSaveD20(target, { name: action.name, saveAbility: ability }, dice, snapshot, actor);
  const total = roll.roll + bonus;
  const success = !roll.autoFail && total >= dc;
  log.add("save.roll", {
    round: snapshot.round,
    actorId: actor.id,
    actorName: actor.name,
    targetId: target.id,
    targetName: target.name,
    spellName: action.name,
    ability,
    roll: roll.roll,
    rolls: roll.rolls,
    mode: roll.mode,
    reasons: roll.reasons,
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
  const rolled = dice.rollDamage(damage);
  const amount = success && save.onSave === "half" ? Math.floor(Math.max(0, rolled.total) / 2) : Math.max(0, rolled.total);
  applyDamageAmount(snapshot, actor, target, {
    id: action.id,
    name: action.name,
    damage,
    damageType: collapse.damage?.type || "radiant",
  }, rolled, amount, dice, log);
}

function beginConcentrationForCast(snapshot, actor, action, log) { if (action?.concentration) beginConcentration(snapshot, actor, action, log); }

function hasAreaAnchor(targetPayload) {
  const anchor = targetPayload?.anchor || targetPayload;
  return Boolean(anchor && Number.isFinite(anchor.x) && Number.isFinite(anchor.y));
}

function targetActorId(targetPayload) {
  if (typeof targetPayload === "string") return targetPayload;
  return targetPayload?.targetId || null;
}

function targetActorIds(targetPayload) {
  if (Array.isArray(targetPayload)) return targetPayload;
  if (Array.isArray(targetPayload?.targetIds)) return targetPayload.targetIds;
  const single = targetActorId(targetPayload);
  return single ? [single] : [];
}

function isExplicitTargetList(targetPayload) {
  return Array.isArray(targetPayload) || Array.isArray(targetPayload?.targetIds);
}

function isIndividualMultiTargetAction(action) {
  return action?.requiresTarget !== false &&
    Number.isFinite(action.maxTargets) &&
    action.maxTargets > 1 &&
    !action.targeting?.shape &&
    ["spell_effect", "spell_save", "spell_attack", "spell_auto_damage", "spell_self_heal"].includes(action.type);
}

function uniqueActors(targets) {
  const seen = new Set();
  return targets.filter((target) => {
    if (seen.has(target.id)) return false;
    seen.add(target.id);
    return true;
  });
}

function actionWithTargetChoices(action, targetPayload) {
  const choices = targetPayload?.choices || {};
  let resolved = action;
  if (choices.damageType && Array.isArray(action?.damageTypeChoices) && action.damageTypeChoices.includes(choices.damageType)) {
    resolved = {
      ...resolved,
      damageType: choices.damageType,
      damageParts: Array.isArray(resolved.damageParts)
        ? resolved.damageParts.map((part) => part.damageTypeChoices?.includes(choices.damageType) ? { ...part, damageType: choices.damageType } : part)
        : resolved.damageParts,
    };
  }
  if (choices.saveAbility && Array.isArray(action?.saveAbilityChoices) && action.saveAbilityChoices.includes(String(choices.saveAbility).toUpperCase())) {
    resolved = {
      ...resolved,
      effects: resolved.effects.map((effect) => effect.type === "modifier" && effect.stat === "save"
        ? { ...effect, ability: String(choices.saveAbility).toLowerCase() }
        : effect),
    };
  }
  return resolved;
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
      collisionSquares = collisionDealsDamage(snapshot, next, target.id)
        ? action.distanceSquares - movedSquares
        : 0;
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

function trackMovementStep(actor, from, to) {
  actor.turnFlags ??= {};
  actor.turnFlags.movementSteps ??= [];
  actor.turnFlags.movementSteps.push({
    from,
    to,
    dx: Math.sign(to.x - from.x),
    dy: Math.sign(to.y - from.y),
  });
}

function markActionResolvedForTurn(actor, action) {
  actor.turnFlags ??= {};
  actor.turnFlags.actionsResolved ??= {};
  actor.turnFlags.actionsResolved[action.id] = true;
  if (action.type === "weapon_attack" || action.type === "melee_attack" || action.type === "compound_weapon_attack") {
    actor.turnFlags.attackActionResolved = true;
  }
}

function pushDirection(actorPos, targetPos) {
  const dx = targetPos.x - actorPos.x;
  const dy = targetPos.y - actorPos.y;
  if (Math.abs(dx) + Math.abs(dy) !== 1) return null;
  return { x: Math.sign(dx), y: Math.sign(dy) };
}

function canForcedMoveTo(snapshot, pos, targetId) {
  const target = getActor(snapshot, targetId);
  return inBounds(snapshot.grid, pos) &&
    !isMovementBlocked(snapshot.grid, pos) &&
    !combatObjectsAt(snapshot, pos).some((object) => object.blocksMovement) &&
    !blockingContainmentBoundary(snapshot, target?.position, pos) &&
    !actorAt(snapshot, pos, targetId);
}

function collisionDealsDamage(snapshot, pos, targetId) {
  return !actorAt(snapshot, pos, targetId);
}

function clearOffenseEndedConditions(actor, action, log, snapshot) {
  for (const condition of [...(actor.conditions || [])]) {
    const endsOn = condition.endsOn || [];
    const endsOnAttack = isOffensiveAction(action) && (endsOn.includes("attack") || hasConditionRule({ conditions: [condition] }, "endsOnOffense"));
    const endsOnSomaticSpell = action?.tags?.spell === true && action?.tags?.requiresHands === true && endsOn.includes("cast_spell_with_somatic_component");
    if (!endsOnAttack && !endsOnSomaticSpell) continue;
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
