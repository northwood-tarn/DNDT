import { isWalkable } from "./grid.js";
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
import { rollSaveModifier } from "./modifiers.js";
import { hasAuraConditionPrevention } from "./auras.js";
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
import { combatObjectsAt } from "./combatObjects.js";
import {
  applyGrantActionEffect,
  applyModifierEffect,
  applyTempHpEffect,
} from "./combatActionEffectHandlers.js";
import { applyLuckyToRoll } from "./luck.js";
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
  if (amount > 0) resolveConcentrationCheck(snapshot, target, amount, dice, log);
  markDefeated(snapshot, source, target, hpBefore, log);
}

export function applyDamage(snapshot, source, target, action, dice, log, { critical = false } = {}) {
  const rolled = rollActionDamage(source, action, dice, { critical });
  applyDamageAmount(snapshot, source, target, action, rolled, Math.max(0, rolled.total), dice, log);
  applyDamageRiders(snapshot, source, target, action, dice, log, { critical });
  applyDamageRetaliation(snapshot, source, target, action, dice, log);
}

export function applyHitEffects(snapshot, actor, target, action, log, dice = null) {
  applyActionEffects(snapshot, actor, target, action, log, "hit");
  applyFeatureRiders(snapshot, actor, target, action, "source_hits_with_attack_roll", dice, log);
}

export function applySaveFailureEffects(snapshot, actor, target, action, log, dice = null) {
  applyActionEffects(snapshot, actor, target, action, log, "failed_save");
  applyFeatureRiders(snapshot, actor, target, action, "source_forces_failed_save", dice, log);
}

export function applyActionResolvedEffects(snapshot, actor, target, action, log, dice = null) {
  applyActionEffects(snapshot, actor, target || actor, action, log, "action_resolved");
  applyFeatureRiders(snapshot, actor, target || actor, action, "source_resolves_action", dice, log);
}

function applyActionEffects(snapshot, actor, target, action, log, trigger) {
  if (!Array.isArray(action.effects)) return;
  for (const effect of action.effects) {
    if ((effect.trigger || "hit") !== trigger) continue;
    if (target.hp <= 0 && effect.skipDefeated !== false) continue;
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
    if (effect.type === "forced_movement") {
      applyForcedMovementEffect(snapshot, actor, target, action, effect, log);
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

function applyForcedMovementEffect(snapshot, actor, target, action, effect, log) {
  const from = { ...target.position };
  let movedSquares = 0;
  for (let i = 0; i < effect.distanceSquares; i++) {
    const next = nextForcedMovementStep(actor.position, target.position, effect.direction);
    if (!next || !isWalkable(snapshot, next, target.id) || combatObjectsAt(snapshot, next).some((object) => object.blocksMovement)) break;
    target.position = next;
    movedSquares += 1;
  }
  if (!movedSquares) return;
  log.add("forced.move", {
    round: snapshot.round,
    actorId: actor.id,
    actorName: actor.name,
    targetId: target.id,
    targetName: target.name,
    from,
    to: { ...target.position },
    reason: action.name,
    movedSquares,
  });
}

function nextForcedMovementStep(source, target, direction) {
  const dx = Math.sign(target.x - source.x);
  const dy = Math.sign(target.y - source.y);
  const useX = Math.abs(target.x - source.x) >= Math.abs(target.y - source.y);
  const step = useX ? { x: dx || 0, y: 0 } : { x: 0, y: dy || 0 };
  if (direction === "toward_source") {
    step.x *= -1;
    step.y *= -1;
  }
  if (!step.x && !step.y) return null;
  return { x: target.x + step.x, y: target.y + step.y };
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

  if (appliedAmount > 0) resolveConcentrationCheck(snapshot, target, appliedAmount, dice, log);
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

function applyDamageRiders(snapshot, source, target, action, dice, log, { critical = false } = {}) {
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
    applyDamageRider(snapshot, source, target, {
      id: `${effect.id}_rider`,
      name: `${effect.label || effect.id} rider`,
      ...rider,
    }, dice, log, { critical });
  }
  for (const rider of collectFeatureDamageRiders(source, target, action, { trigger: "source_hits_with_attack_roll", critical, snapshot })) {
    if (applyDamageRider(snapshot, source, target, rider, dice, log, { critical, sourceAction: action })) {
      markFeatureDamageRiderUsed(source, rider);
    }
  }
  if ((target.conditions || []).some((condition) => condition.id === "surprised")) {
    for (const rider of collectFeatureDamageRiders(source, target, action, { trigger: "source_hits_surprised_target", critical, snapshot })) {
      if (applyDamageRider(snapshot, source, target, rider, dice, log, { critical, sourceAction: action })) {
        markFeatureDamageRiderUsed(source, rider);
      }
    }
  }
}

function applyPostDamageRiders(snapshot, source, target, action, dice, log) {
  if (!dice || target.hp <= 0) return;
  for (const rider of collectFeatureDamageRiders(source, target, action, { trigger: "source_deals_damage", snapshot })) {
    if (applyDamageRider(snapshot, source, target, rider, dice, log, { sourceAction: action })) {
      markFeatureDamageRiderUsed(source, rider);
    }
  }
}

function applyDamageRider(snapshot, source, target, rider, dice, log, { critical = false, sourceAction = null } = {}) {
  if (rider.save) {
    const save = resolveInlineSave(snapshot, source, target, rider, dice, log);
    if (save.success && ["negates", "negates_effect"].includes(save.onSave)) return false;
  }
  const damage = resolveRiderDamageFormula(source, rider.damage);
  const rolled = rollRiderDamage(damage, dice, { critical: rider.critical === false ? false : critical });
  applyDamageAmount(snapshot, source, target, {
    id: rider.id,
    name: rider.name,
    damage,
    damageType: resolveRiderDamageType(sourceAction, rider),
    featureDamageRider: rider.featureDamageRider === true,
  }, rolled, Math.max(0, rolled.total), dice, log);
  return true;
}

function resolveInlineSave(snapshot, source, target, effect, dice, log) {
  const ability = String(effect.save.ability || "").toLowerCase();
  const dc = effect.save.dc || 10;
  const saveModifier = rollSaveModifier(snapshot, target, ability, { name: effect.name, saveAbility: ability }, dice);
  const baseBonus = target.saves?.[ability] || 0;
  const bonus = baseBonus + saveModifier.total;
  const roll = applyLuckyToRoll({
    actor: target,
    roll: rollSaveD20(target, { name: effect.name, saveAbility: ability }, dice, snapshot, source),
    dice,
    log,
    context: {
      round: snapshot.round,
      type: "save",
      label: effect.name,
      targetNumber: dc,
      bonus,
    },
  });
  const total = roll.roll + bonus;
  const success = !roll.autoFail && total >= dc;
  log.add("save.roll", {
    round: snapshot.round,
    actorId: source.id,
    actorName: source.name,
    targetId: target.id,
    targetName: target.name,
    spellName: effect.name,
    ability,
    roll: roll.roll,
    rolls: roll.rolls,
    mode: roll.mode,
    reasons: roll.reasons,
    lucky: roll.lucky,
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
    actorId: source.id,
    actorName: source.name,
    targetId: target.id,
    targetName: target.name,
    spellName: effect.name,
    success,
  });
  return { success, onSave: effect.save.onSave };
}

function applyDamageRetaliation(snapshot, source, target, action, dice, log) {
  if (!dice || !isMeleeAttackAction(action) || source.hp <= 0) return;
  for (const condition of target.conditions || []) {
    const retaliation = condition.damageRetaliation;
    if (!retaliation || retaliation.trigger !== "hit_by_melee") continue;
    if (retaliation.requiresTempHp && !(target._tempHpBeforeLastDamage > 0)) continue;
    const rolled = dice.rollDamage(retaliation.damage);
    applyDamageAmount(snapshot, target, source, {
      id: `${condition.sourceActionId}_retaliation`,
      name: `${conditionName(condition.id)} retaliation`,
      damage: retaliation.damage,
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
