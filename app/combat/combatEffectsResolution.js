import {
  addCondition,
  removeCondition,
  spendActionUse,
} from "./actor.js";
import {
  conditionName,
  createConditionInstance,
  getConditionRules,
} from "./effects.js";
import { combatAuraEffectsAffectingActor, hasAuraConditionPrevention } from "./auras.js";
import { resolveDamageAmount } from "./damage.js";
import {
  collectFeatureDamageRiders,
  markFeatureDamageRiderUsed,
  resolveRiderDamageFormula,
  resolveRiderDamageType,
} from "./damageRiders.js";
import { applyFeatureEffectRiders } from "./featureEffectRiders.js";
import {
  resolveDamageReactionAdjustment,
  resolveReactionTriggers,
  resolveZeroHpReactionAdjustment,
} from "./reactions.js";
import {
  applyDeathWardEffect,
  applyDispelMagicEffect,
  applyGreaterRestorationEffect,
  applyGrantActionEffect,
  applyLightSourceEffect,
  applyMaxHpBonusEffect,
  applyModifierEffect,
  applyTempHpEffect,
} from "./combatActionEffectHandlers.js";
import { rollActionDamage, rollRiderDamage } from "./damageRolls.js";
import {
  beginConcentration,
  clearConcentrationIfNoLinkedEffects,
  resolveConcentrationCheck,
} from "./concentrationResolution.js";
import {
  isCriticalHitFromConditions,
  rollConditionSave,
  rollSaveD20,
} from "./combatRolls.js";
import {
  collectMatchedFeatureTriggers,
  grantTriggeredAction,
} from "./featureTriggers.js";
import { resolveForcedMovement } from "./forcedMovement.js";
import { resolveEffectSave, resolveInlineSave } from "./combatSaveResolution.js";

export {
  beginConcentration,
  clearConcentrationIfNoLinkedEffects,
  isCriticalHitFromConditions,
  rollConditionSave,
  rollSaveD20,
};

export function applyCollisionDamage(snapshot, source, target, action, collisionSquares, dice, log) {
  const rolls = [];
  let total = 0;
  for (let i = 0; i < collisionSquares; i++) {
    const rolled = dice.rollDamage(action.collisionDamage);
    rolls.push(...rolled.rolls);
    total += rolled.total;
  }
  const hpBefore = target.hp;
  const adjustment = resolveDamageAmount(source, target, {
    name: action.name,
    damageType: action.collisionDamageType,
  }, { total }, total, snapshot, dice);
  const amount = adjustment.amount;
  target.hp = Math.max(0, target.hp - amount);
  log.add("collision.damage", {
    round: snapshot.round,
    sourceId: source.id,
    sourceName: source.name,
    targetId: target.id,
    targetName: target.name,
    dice: `${collisionSquares}x ${action.collisionDamage}`,
    rolls,
    originalAmount: adjustment.originalAmount,
    amount,
    damageType: action.collisionDamageType,
    damageModifiers: adjustment.modifiers,
    hpBefore,
    hpAfter: target.hp,
    collisionSquares,
  });
  if (amount > 0) resolveConcentrationCheck(snapshot, target, amount, dice, log, source);
  markDefeated(snapshot, source, target, hpBefore, log);
}

export function applyDamage(snapshot, source, target, action, dice, log, { critical = false, attackRoll = null } = {}) {
  const rolled = rollActionDamage(source, action, dice, { critical });
  applyDamageAmount(snapshot, source, target, action, rolled, Math.max(0, rolled.total), dice, log);
  applyDamageRiders(snapshot, source, target, action, dice, log, { critical, attackRoll });
  applyDamageRetaliation(snapshot, source, target, action, dice, log);
}

export function applyHitEffects(snapshot, actor, target, action, log, dice = null) {
  applyActionEffects(snapshot, actor, target, action, log, "hit", dice);
  applyFeatureRiders(snapshot, actor, target, action, "source_hits_with_attack_roll", dice, log);
}

export function applySaveFailureEffects(snapshot, actor, target, action, log, dice = null) {
  applyActionEffects(snapshot, actor, target, action, log, "failed_save", dice);
  applyFeatureRiders(snapshot, actor, target, action, "source_forces_failed_save", dice, log);
}

export function applyActionResolvedEffects(snapshot, actor, target, action, log, dice = null) {
  applyActionEffects(snapshot, actor, target || actor, action, log, "action_resolved", dice);
  applyFeatureRiders(snapshot, actor, target || actor, action, "source_resolves_action", dice, log);
}

function applyActionEffects(snapshot, actor, target, action, log, trigger, dice = null) {
  if (!Array.isArray(action.effects)) return;
  for (const effect of action.effects) {
    if ((effect.trigger || "hit") !== trigger) continue;
    if (target.hp <= 0 && effect.skipDefeated !== false) continue;
    if (effect.save && dice) {
      const saveEffect = {
        ...effect,
        name: effect.label || action.name,
        save: resolveEffectSave(effect.save, actor, action),
      };
      const saveResult = resolveInlineSave(snapshot, actor, target, saveEffect, dice, log);
      if (saveResult.success && ["negates", "negates_effect"].includes(saveResult.onSave)) continue;
    }
    if (effect.type === "modifier") {
      applyModifierEffect(snapshot, actor, target, action, effect, log);
      continue;
    }
    if (effect.type === "grant_action" && effect.action) {
      applyGrantActionEffect(snapshot, actor, target, action, effect, log);
      continue;
    }
    if (effect.type === "temp_hp") {
      applyTempHpEffect(snapshot, actor, target, action, effect, log);
      continue;
    }
    if (effect.type === "aura" && effect.aura) {
      if (!Array.isArray(target.auras)) target.auras = [];
      const aura = {
        ...structuredClone(effect.aura),
        sourceFeatureId: action.id,
        sourceActorId: actor.id,
        duration: effect.duration ? structuredClone(effect.duration) : null,
      };
      const existing = target.auras.find((item) => item.id === aura.id);
      if (existing) Object.assign(existing, aura);
      else target.auras.push(aura);
      log.add("effect.applied", {
        round: snapshot.round,
        sourceId: actor.id,
        sourceName: actor.name,
        targetId: target.id,
        targetName: target.name,
        effectId: aura.id,
        label: aura.name,
        actionName: action.name,
      });
      continue;
    }
    if (effect.type === "forced_movement") {
      applyForcedMovementEffect(snapshot, actor, target, action, effect, log, dice);
      continue;
    }
    if (effect.type === "remove_conditions") {
      applyRemoveConditionsEffect(snapshot, actor, target, action, effect, log);
      continue;
    }
    if (effect.type === "light_source") {
      applyLightSourceEffect(snapshot, actor, target, action, effect, log);
      continue;
    }
    if (effect.type === "max_hp_bonus") {
      applyMaxHpBonusEffect(snapshot, actor, target, action, effect, log);
      continue;
    }
    if (effect.type === "death_ward") {
      applyDeathWardEffect(snapshot, actor, target, action, effect, log);
      continue;
    }
    if (effect.type === "dispel_magic") {
      applyDispelMagicEffect(snapshot, actor, target, action, effect, log);
      continue;
    }
    if (effect.type === "greater_restoration") {
      applyGreaterRestorationEffect(snapshot, actor, target, action, effect, log);
      continue;
    }
    if (effect.type !== "condition" || !effect.condition) continue;
    const preventedBy = hasAuraConditionPrevention(snapshot, target, effect.condition, { source: actor, action });
    if (preventedBy) {
      log.add("condition.prevented", {
        round: snapshot.round,
        sourceId: actor.id,
        sourceName: actor.name,
        targetId: target.id,
        targetName: target.name,
        condition: effect.condition,
        label: conditionName(effect.condition),
        reason: preventedBy.label || preventedBy.id,
        actionName: action.name,
      });
      continue;
    }
    const added = addCondition(target, createConditionInstance(effect, actor, action));
    if (effect.consumeUseOnApply) spendActionUse(action);
    log.add("condition.applied", {
      round: snapshot.round,
      sourceId: actor.id,
      sourceName: actor.name,
      targetId: target.id,
      targetName: target.name,
      condition: effect.condition,
      label: conditionName(effect.condition),
      actionName: action.name,
      noSave: effect.noSave === true,
      alreadyPresent: !added,
    });
    applyConditionSideEffects(snapshot, actor, target, action, effect.condition, log);
  }
}

function applyRemoveConditionsEffect(snapshot, actor, target, action, effect, log) {
  const conditions = Array.isArray(effect.conditions) ? effect.conditions : [];
  const maxRemoved = Math.max(1, effect.maxRemoved || conditions.length || 1);
  let removed = 0;
  for (const condition of conditions) {
    if (removed >= maxRemoved) break;
    if (!removeCondition(target, condition)) continue;
    removed += 1;
    log.add("condition.removed", {
      round: snapshot.round,
      actorId: target.id,
      actorName: target.name,
      condition,
      reason: action.name,
      sourceId: actor.id,
      sourceName: actor.name,
    });
  }
}

function applyForcedMovementEffect(snapshot, actor, target, action, effect, log, dice = null) {
  const movement = resolveForcedMovement(snapshot, actor.position, target, effect);
  if (movement.movedSquares) {
    log.add("forced.move", {
      round: snapshot.round,
      actorId: actor.id,
      actorName: actor.name,
      targetId: target.id,
      targetName: target.name,
      from: movement.from,
      to: movement.to,
      reason: action.name,
      movedSquares: movement.movedSquares,
    });
  }
  if (movement.collisionSquares > 0 && dice && effect.collisionDamage) {
    applyCollisionDamage(snapshot, actor, target, {
      ...action,
      collisionDamage: effect.collisionDamage,
      collisionDamageType: effect.collisionDamageType || "bludgeoning",
    }, movement.collisionSquares, dice, log);
  }
}

function applyConditionSideEffects(snapshot, actor, target, action, conditionIdValue, log) {
  const rules = getConditionRules(conditionIdValue);
  if (!rules.fallsProneOnApply) return;
  const added = addCondition(target, createConditionInstance({
    type: "condition",
    condition: "prone",
    duration: null,
    repeatSave: null,
  }, actor, action));
  log.add("condition.applied", {
    round: snapshot.round,
    sourceId: actor.id,
    sourceName: actor.name,
    targetId: target.id,
    targetName: target.name,
    condition: "prone",
    label: conditionName("prone"),
    actionName: action.name,
    noSave: true,
    alreadyPresent: !added,
    reason: `${conditionName(conditionIdValue)} side effect`,
  });
}

function applyFeatureRiders(snapshot, actor, target, action, trigger, dice, log) {
  applyFeatureEffectRiders({
    snapshot,
    actor,
    target,
    action,
    trigger,
    dice,
    log,
    resolveSave: (rider) => resolveInlineSave(snapshot, actor, target, rider, dice, log),
  });
}

export function applyDamageAmount(snapshot, source, target, action, rolled, amount, dice, log) {
  const adjustment = resolveDamageAmount(source, target, action, rolled, amount, snapshot, dice);
  let appliedAmount = adjustment.amount;
  appliedAmount = resolveDamageReactionAdjustment(snapshot, { source, target, action, rolled, amount: appliedAmount }, dice, log);
  const modifierText = rolled.modifier
    ? rolled.modifier > 0 ? `+ ${rolled.modifier}` : `- ${Math.abs(rolled.modifier)}`
    : "+ 0";
  const hpBefore = target.hp;
  const tempHpBefore = target.tempHp || 0;
  appliedAmount = resolveZeroHpReactionAdjustment(snapshot, { source, target, action, amount: appliedAmount, hpBefore, tempHpBefore }, log);
  target._hpBeforeLastDamage = hpBefore;
  target._tempHpBeforeLastDamage = tempHpBefore;
  const tempAbsorbed = Math.min(tempHpBefore, appliedAmount);
  target.tempHp = tempHpBefore - tempAbsorbed;
  target.hp = Math.max(0, target.hp - (appliedAmount - tempAbsorbed));

  log.add("damage.roll", {
    round: snapshot.round,
    sourceId: source.id,
    targetId: target.id,
    label: action.name,
    dice: action.damage,
    rolls: rolled.rolls,
    modifier: rolled.modifier,
    modifierText,
    total: rolled.total,
    originalAmount: adjustment.originalAmount,
    appliedAmount,
    damageModifiers: adjustment.modifiers,
    critical: rolled.critical === true,
    criticalRolls: rolled.criticalRolls || [],
    savageAttacker: rolled.savageAttacker || null,
    featureDamageHooks: rolled.featureDamageHooks || [],
  });
  log.add("damage.applied", {
    round: snapshot.round,
    sourceId: source.id,
    sourceName: source.name,
    targetId: target.id,
    targetName: target.name,
    amount: appliedAmount,
    originalAmount: adjustment.originalAmount,
    damageModifiers: adjustment.modifiers,
    damageType: action.damageType,
    hpBefore,
    tempHpBefore,
    tempHpAfter: target.tempHp || 0,
    hpAfter: target.hp,
  });

  if (appliedAmount > 0) resolveConcentrationCheck(snapshot, target, appliedAmount, dice, log, source);
  if (appliedAmount > 0 && source?.id && source.id !== target.id && action.tags?.attackRoll === true) {
    if (!target.turnFlags) target.turnFlags = {};
    target.turnFlags.hitsTakenSinceLastTurn = (target.turnFlags.hitsTakenSinceLastTurn || 0) + 1;
  }
  if (appliedAmount > 0 && !action.reactionFeature) {
    resolveReactionTriggers(snapshot, "takes_damage_from_creature", { source, target, action, amount: appliedAmount }, dice, log, { applyDamageAmount });
  }
  if (appliedAmount > 0 && !action.featureDamageRider) {
    applyPostDamageRiders(snapshot, source, target, action, dice, log);
  }
  markDefeated(snapshot, source, target, hpBefore, log);
}

function applyDamageRiders(snapshot, source, target, action, dice, log, { critical = false, attackRoll = null } = {}) {
  if (!dice || !isAttackRollAction(action)) return;
  for (const rider of action.damageRiders || []) {
    applyDamageRider(snapshot, source, target, rider, dice, log, { critical });
  }
  for (const condition of target.conditions || []) {
    const rider = condition.damageRider;
    if (!rider || rider.trigger !== "source_hits_with_attack_roll") continue;
    if (condition.sourceActorId !== source.id) continue;
    applyDamageRider(snapshot, source, target, {
      id: `${condition.sourceActionId}_rider`,
      name: `${conditionName(condition.id)} rider`,
      ...rider,
    }, dice, log, { critical });
  }
  for (const effect of source.activeEffects || []) {
    const rider = effect.damageRider;
    if (!rider || rider.trigger !== "source_hits_with_attack_roll") continue;
    if (rider.requiresConditionOnTarget && !(target.conditions || []).some((condition) => condition.id === rider.requiresConditionOnTarget)) continue;
    if (Array.isArray(rider.actionTags) && !rider.actionTags.every((tag) => action.tags?.[tag] === true)) continue;
    const result = applyDamageRider(snapshot, source, target, {
      id: `${effect.id}_rider`,
      name: `${effect.label || effect.id} rider`,
      ...rider,
    }, dice, log, { critical });
    if (result.triggered) consumeActiveEffectRider(snapshot, source, effect, log);
  }
  for (const effect of combatAuraEffectsAffectingActor(snapshot, source)) {
    const rider = effect.damageRider;
    if (!rider || rider.trigger !== "source_hits_with_attack_roll") continue;
    if (Array.isArray(rider.actionTags) && !rider.actionTags.every((tag) => action.tags?.[tag] === true)) continue;
    applyDamageRider(snapshot, source, target, {
      id: `${effect.auraId || effect.id}_rider`,
      name: effect.label || effect.auraId || "Aura rider",
      ...rider,
    }, dice, log, { critical, sourceAction: action });
  }
  for (const rider of collectFeatureDamageRiders(source, target, action, { trigger: "source_hits_with_attack_roll", critical, snapshot, attackRoll })) {
    if (applyDamageRider(snapshot, source, target, rider, dice, log, { critical, sourceAction: action }).triggered) {
      markFeatureDamageRiderUsed(source, rider);
    }
  }
  if ((target.conditions || []).some((condition) => condition.id === "surprised")) {
    for (const rider of collectFeatureDamageRiders(source, target, action, { trigger: "source_hits_surprised_target", critical, snapshot, attackRoll })) {
      if (applyDamageRider(snapshot, source, target, rider, dice, log, { critical, sourceAction: action }).triggered) {
        markFeatureDamageRiderUsed(source, rider);
      }
    }
  }
}

function applyPostDamageRiders(snapshot, source, target, action, dice, log) {
  if (!dice || target.hp <= 0) return;
  for (const rider of collectFeatureDamageRiders(source, target, action, { trigger: "source_deals_damage", snapshot })) {
    if (applyDamageRider(snapshot, source, target, rider, dice, log, { sourceAction: action }).triggered) {
      markFeatureDamageRiderUsed(source, rider);
    }
  }
}

function applyDamageRider(snapshot, source, target, rider, dice, log, { critical = false, sourceAction = null } = {}) {
  if (rider.oncePerRoundPerTarget && riderAlreadyAppliedToTargetThisRound(snapshot, source, target, rider)) {
    return { triggered: false, applied: false };
  }
  let saveResult = null;
  if (rider.save) {
    saveResult = resolveInlineSave(snapshot, source, target, rider, dice, log);
    if (saveResult.success && ["negates", "negates_effect"].includes(saveResult.onSave)) return { triggered: true, applied: false };
  }
  const damage = resolveRiderDamageFormula(source, rider.damage);
  const rolled = rollRiderDamage(damage, dice, { critical: rider.critical === false ? false : critical });
  const savedAmount = saveResult?.success && saveResult.onSave === "half"
    ? Math.floor(Math.max(0, rolled.total) / 2)
    : Math.max(0, rolled.total);
  const amount = savedAmount * targetDamageMultiplier(target, rider.targetMultipliers);
  applyDamageAmount(snapshot, source, target, {
    id: rider.id,
    name: rider.name,
    damage,
    damageType: resolveRiderDamageType(sourceAction, rider),
    featureDamageRider: rider.featureDamageRider === true,
  }, rolled, amount, dice, log);
  if (rider.oncePerRoundPerTarget) markRiderAppliedToTargetThisRound(snapshot, source, target, rider);
  applySplashConditionDamage(snapshot, source, target, rider, rolled, amount, dice, log, sourceAction);
  if (Array.isArray(rider.effects) && rider.effects.length) {
    applyActionEffects(snapshot, source, target, {
      id: rider.id,
      name: rider.name,
      spellSaveDC: rider.save?.dc ?? sourceAction?.spellSaveDC,
      effects: rider.effects,
    }, log, "hit", dice);
  }
  return { triggered: true, applied: amount > 0 };
}

function targetDamageMultiplier(target, targetMultipliers) {
  if (!targetMultipliers || typeof targetMultipliers !== "object") return 1;
  const tags = new Set([
    ...(Array.isArray(target?.tags) ? target.tags : []),
    target?.creatureType,
  ].filter(Boolean));
  return Object.entries(targetMultipliers).reduce((multiplier, [tag, value]) =>
    tags.has(tag) && Number.isFinite(value) ? multiplier * Math.max(0, value) : multiplier
  , 1);
}

function applySplashConditionDamage(snapshot, source, primaryTarget, rider, rolled, amount, dice, log, sourceAction) {
  if (!rider.splashCondition || amount <= 0) return;
  const targets = (snapshot.actors || [])
    .filter((actor) => actor.id !== primaryTarget.id && actor.hp > 0)
    .filter((actor) => (actor.conditions || []).some((condition) =>
      condition.id === rider.splashCondition && (!condition.sourceActorId || condition.sourceActorId === source.id)
    ));
  for (const target of targets) {
    if (rider.oncePerRoundPerTarget && riderAlreadyAppliedToTargetThisRound(snapshot, source, target, rider)) continue;
    applyDamageAmount(snapshot, source, target, {
      id: `${rider.id}_splash`,
      name: rider.name,
      damage: rider.damage,
      damageType: resolveRiderDamageType(sourceAction, rider),
      featureDamageRider: rider.featureDamageRider === true,
    }, rolled, amount, dice, log);
    if (rider.oncePerRoundPerTarget) markRiderAppliedToTargetThisRound(snapshot, source, target, rider);
  }
}

function riderAlreadyAppliedToTargetThisRound(snapshot, source, target, rider) {
  const tracker = source?.combatFlags?.damageRiderTargetsByRound?.[rider.id];
  return tracker?.round === snapshot.round && tracker.targetIds?.includes(target.id);
}

function markRiderAppliedToTargetThisRound(snapshot, source, target, rider) {
  source.combatFlags ??= {};
  source.combatFlags.damageRiderTargetsByRound ??= {};
  const existing = source.combatFlags.damageRiderTargetsByRound[rider.id];
  const tracker = existing?.round === snapshot.round ? existing : { round: snapshot.round, targetIds: [] };
  if (!tracker.targetIds.includes(target.id)) tracker.targetIds.push(target.id);
  source.combatFlags.damageRiderTargetsByRound[rider.id] = tracker;
}

function consumeActiveEffectRider(snapshot, source, effect, log) {
  if (!effect || !Number.isFinite(effect.remainingHits)) return;
  effect.remainingHits = Math.max(0, effect.remainingHits - 1);
  log.add("effect.charge_spent", {
    round: snapshot.round,
    actorId: source.id,
    actorName: source.name,
    effectId: effect.id,
    label: effect.label || effect.id,
    remainingHits: effect.remainingHits,
  });
  if (effect.remainingHits > 0 || effect.removeWhenSpent !== true) return;
  source.activeEffects = (source.activeEffects || []).filter((item) => item !== effect);
  log.add("effect.removed", {
    round: snapshot.round,
    actorId: source.id,
    actorName: source.name,
    effectId: effect.id,
    label: effect.label || effect.id,
    reason: "spent",
  });
}

function applyDamageRetaliation(snapshot, source, target, action, dice, log) {
  if (!dice || !isMeleeAttackAction(action) || source.hp <= 0) return;
  for (const condition of target.conditions || []) {
    const retaliation = condition.damageRetaliation;
    if (!retaliation || retaliation.trigger !== "hit_by_melee") continue;
    if (retaliation.requiresTempHp && !(target._tempHpBeforeLastDamage > 0)) continue;
    const damage = resolveRiderDamageFormula(target, retaliation.damage);
    const rolled = dice.rollDamage(damage);
    applyDamageAmount(snapshot, target, source, {
      id: `${condition.sourceActionId}_retaliation`,
      name: `${conditionName(condition.id)} retaliation`,
      damage,
      damageType: retaliation.damageType || "untyped",
    }, rolled, Math.max(0, rolled.total), dice, log);
  }
}

function isAttackRollAction(action) {
  return action?.tags?.attackRoll === true || ["weapon_attack", "melee_attack", "spell_attack"].includes(action?.type);
}

function isMeleeAttackAction(action) {
  return isAttackRollAction(action) && (action?.tags?.melee === true || action?.range <= 1);
}

function markDefeated(snapshot, source, target, hpBefore, log) {
  if (hpBefore <= 0 || target.hp !== 0) return;
  target.defeated = true;
  source.combatFlags ??= {};
  source.combatFlags.droppedEnemyOnLastTurn = true;
  for (const effect of collectMatchedFeatureTriggers(source, target, "source_reduces_target_to_zero")) {
    grantTriggeredAction(snapshot, source, target, { id: effect.id, name: effect.name }, effect, log);
  }
  log.add("actor.defeated", {
    round: snapshot.round,
    sourceId: source.id,
    sourceName: source.name,
    targetId: target.id,
    targetName: target.name,
  });
}
