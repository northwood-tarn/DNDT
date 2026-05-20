import { distance, isWalkable } from "./grid.js";
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
import { removeActiveEffect, rollSaveModifier } from "./modifiers.js";
import { resolveDamageAmount } from "./damage.js";
import { getActor } from "./combatState.js";
import { combatObjectsAt } from "./combatObjects.js";
import {
  applyGrantActionEffect,
  applyModifierEffect,
  applyTempHpEffect,
} from "./combatActionEffectHandlers.js";

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
  const rolled = rollActionDamage(action, dice, { critical });
  applyDamageAmount(snapshot, source, target, action, rolled, Math.max(0, rolled.total), dice, log);
  applyDamageRiders(snapshot, source, target, action, dice, log, { critical });
  applyDamageRetaliation(snapshot, source, target, action, dice, log);
}

export function applyHitEffects(snapshot, actor, target, action, log) {
  applyActionEffects(snapshot, actor, target, action, log, "hit");
}

export function applySaveFailureEffects(snapshot, actor, target, action, log) {
  applyActionEffects(snapshot, actor, target, action, log, "failed_save");
}

export function applyActionResolvedEffects(snapshot, actor, target, action, log) {
  applyActionEffects(snapshot, actor, target || actor, action, log, "action_resolved");
}

export function beginConcentration(snapshot, actor, action, log) {
  startConcentration(snapshot, actor, action, log);
}

export function rollConditionSave(actor, condition, repeatSave, dice) {
  return rollSaveD20(actor, {
    name: conditionName(condition.id),
    saveAbility: repeatSave.ability,
  }, dice);
}

export function rollSaveD20(target, action, dice) {
  const reasons = [];
  const autoFail = getAutoFailSaveCondition(target, action.saveAbility);
  if (autoFail) {
    reasons.push(`${conditionName(autoFail)} automatically fails ${String(action.saveAbility).toUpperCase()} saves`);
    return { roll: 0, rolls: [], mode: "auto_fail", reasons, autoFail: true };
  }
  let advantage = 0;
  if (action.saveAbility === "dex") {
    for (const condition of target.conditions || []) {
      const id = conditionId(condition);
      const rules = getConditionRules(id);
      if (!rules.dexSaveDisadvantage) continue;
      advantage -= 1;
      reasons.push(`DIS: ${conditionName(id)} on DEX saves`);
    }
  }
  if (advantage === 0) {
    const d20 = dice.rollD20({ type: "save", label: action.name });
    return { roll: d20.roll, rolls: [d20.roll], mode: "normal", reasons, autoFail: false };
  }
  const first = dice.rollD20({ type: "save", label: action.name });
  const second = dice.rollD20({ type: "save", label: action.name });
  const rolls = [first.roll, second.roll];
  return {
    roll: advantage > 0 ? Math.max(...rolls) : Math.min(...rolls),
    rolls,
    mode: advantage > 0 ? "advantage" : "disadvantage",
    reasons,
    autoFail: false,
  };
}

export function isCriticalHitFromConditions(actor, target, action, attackRoll) {
  if (attackRoll.roll === 20) return true;
  if (!isMeleeAttackHit(actor, target, action)) return false;
  return (target.conditions || []).some((condition) => {
    const id = conditionId(condition);
    return Boolean(id && getConditionRules(id).meleeHitWithin5ftCritical);
  });
}

export function clearConcentrationIfNoLinkedEffects(snapshot, condition, log, reason) {
  if (!condition?.sourceActorId || !condition?.sourceActionId) return;
  const caster = getActor(snapshot, condition.sourceActorId);
  if (!caster?.concentration || caster.concentration.actionId !== condition.sourceActionId) return;
  const stillLinked = snapshot.actors.some((actor) =>
    (actor.conditions || []).some((item) =>
      item.sourceActorId === condition.sourceActorId && item.sourceActionId === condition.sourceActionId
    ) ||
    (actor.activeEffects || []).some((item) =>
      item.sourceActorId === condition.sourceActorId && item.sourceActionId === condition.sourceActionId
    )
  ) || (snapshot.combatObjects || []).some((object) =>
    object.sourceActorId === condition.sourceActorId && object.sourceActionId === condition.sourceActionId
  );
  if (!stillLinked) endConcentration(snapshot, caster, log, reason);
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

export function applyDamageAmount(snapshot, source, target, action, rolled, amount, dice, log) {
  const adjustment = resolveDamageAmount(source, target, action, rolled, amount, snapshot, dice);
  const appliedAmount = adjustment.amount;
  const modifierText = rolled.modifier
    ? rolled.modifier > 0 ? `+ ${rolled.modifier}` : `- ${Math.abs(rolled.modifier)}`
    : "+ 0";
  const hpBefore = target.hp;
  const tempHpBefore = target.tempHp || 0;
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
}

function applyDamageRider(snapshot, source, target, rider, dice, log, { critical = false } = {}) {
  if (rider.save) {
    const save = resolveInlineSave(snapshot, source, target, rider, dice, log);
    if (save.success && ["negates", "negates_effect"].includes(save.onSave)) return;
  }
  const rolled = rollRiderDamage(rider.damage, dice, { critical: rider.critical === false ? false : critical });
  applyDamageAmount(snapshot, source, target, {
    id: rider.id,
    name: rider.name,
    damage: rider.damage,
    damageType: rider.damageType || "untyped",
  }, rolled, Math.max(0, rolled.total), dice, log);
}

function rollRiderDamage(damage, dice, { critical = false } = {}) {
  if (typeof damage === "number") return { total: damage, rolls: [], modifier: damage, dice: String(damage), critical: false, criticalRolls: [] };
  return rollActionDamage({ damage }, dice, { critical });
}

function resolveInlineSave(snapshot, source, target, effect, dice, log) {
  const ability = String(effect.save.ability || "").toLowerCase();
  const dc = effect.save.dc || 10;
  const roll = rollSaveD20(target, { name: effect.name, saveAbility: ability }, dice);
  const saveModifier = rollSaveModifier(snapshot, target, ability, { name: effect.name, saveAbility: ability }, dice);
  const baseBonus = target.saves?.[ability] || 0;
  const bonus = baseBonus + saveModifier.total;
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

function startConcentration(snapshot, actor, action, log) {
  if (!action.concentration) return;
  endConcentration(snapshot, actor, log, "new concentration started");
  actor.concentration = {
    actionId: action.id,
    actionName: action.name,
  };
  log.add("concentration.start", {
    round: snapshot.round,
    actorId: actor.id,
    actorName: actor.name,
    actionId: action.id,
    actionName: action.name,
  });
}

function endConcentration(snapshot, actor, log, reason) {
  if (!actor?.concentration) return false;
  const concentration = actor.concentration;
  actor.concentration = null;
  for (const target of snapshot.actors) {
    const before = target.conditions?.length || 0;
    target.conditions = (target.conditions || []).filter((condition) =>
      condition.sourceActorId !== actor.id || condition.sourceActionId !== concentration.actionId
    );
    if ((target.conditions?.length || 0) !== before) {
      log.add("condition.removed", {
        round: snapshot.round,
        actorId: target.id,
        actorName: target.name,
        condition: "concentration-linked effects",
        reason,
      });
    }
    for (const effect of [...(target.activeEffects || [])]) {
      if (effect.sourceActorId !== actor.id || effect.sourceActionId !== concentration.actionId) continue;
      removeActiveEffect(target, effect.id);
      log.add("effect.removed", {
        round: snapshot.round,
        actorId: target.id,
        actorName: target.name,
        effectId: effect.id,
        label: effect.label || effect.id,
        reason,
      });
    }
  }
  const beforeObjects = snapshot.combatObjects?.length || 0;
  snapshot.combatObjects = (snapshot.combatObjects || []).filter((object) =>
    object.sourceActorId !== actor.id || object.sourceActionId !== concentration.actionId
  );
  if ((snapshot.combatObjects?.length || 0) !== beforeObjects) {
    log.add("object.removed", {
      round: snapshot.round,
      actorId: actor.id,
      actorName: actor.name,
      actionId: concentration.actionId,
      actionName: concentration.actionName,
      reason,
    });
  }
  log.add("concentration.end", {
    round: snapshot.round,
    actorId: actor.id,
    actorName: actor.name,
    actionId: concentration.actionId,
    actionName: concentration.actionName,
    reason,
  });
  return true;
}

function resolveConcentrationCheck(snapshot, actor, damageAmount, dice, log) {
  if (!actor?.concentration) return;
  const dc = Math.max(10, Math.floor(damageAmount / 2));
  const roll = rollSaveD20(actor, { name: "Concentration", saveAbility: "con" }, dice);
  const saveModifier = rollSaveModifier(snapshot, actor, "con", { name: "Concentration", saveAbility: "con" }, dice);
  const baseBonus = actor.saves?.con || 0;
  const bonus = baseBonus + saveModifier.total;
  const total = roll.roll + bonus;
  const success = !roll.autoFail && total >= dc;
  log.add("concentration.save.roll", {
    round: snapshot.round,
    actorId: actor.id,
    actorName: actor.name,
    actionId: actor.concentration.actionId,
    actionName: actor.concentration.actionName,
    damageAmount,
    roll: roll.roll,
    rolls: roll.rolls,
    mode: roll.mode,
    reasons: roll.reasons,
    bonus,
    baseBonus,
    modifierReasons: saveModifier.reasons,
    total,
    dc,
  });
  log.add("concentration.save.result", {
    round: snapshot.round,
    actorId: actor.id,
    actorName: actor.name,
    actionId: actor.concentration.actionId,
    actionName: actor.concentration.actionName,
    success,
  });
  if (!success) endConcentration(snapshot, actor, log, "failed concentration save");
}

function markDefeated(snapshot, source, target, hpBefore, log) {
  if (hpBefore <= 0 || target.hp !== 0) return;
  target.defeated = true;
  log.add("actor.defeated", {
    round: snapshot.round,
    sourceId: source.id,
    sourceName: source.name,
    targetId: target.id,
    targetName: target.name,
  });
}

function conditionId(condition) {
  return typeof condition === "string" ? condition : condition?.id;
}

function getAutoFailSaveCondition(actor, ability) {
  const normalizedAbility = String(ability || "").toLowerCase();
  for (const condition of actor.conditions || []) {
    const id = conditionId(condition);
    const rules = getConditionRules(id);
    if (Array.isArray(rules.autoFailSaves) && rules.autoFailSaves.includes(normalizedAbility)) return id;
  }
  return null;
}

function isMeleeAttackHit(actor, target, action) {
  if (distance(actor.position, target.position) > 1) return false;
  return action.melee === true || action.type === "melee_attack" || action.range <= 1;
}

function rollActionDamage(action, dice, { critical = false } = {}) {
  const base = dice.rollDamage(action.damage);
  if (!critical) return { ...base, critical: false, criticalRolls: [] };

  const extraDice = criticalDamageDice(action.damage);
  if (!extraDice) return { ...base, critical: true, criticalRolls: [] };

  const extra = dice.rollDamage(extraDice);
  return {
    ...base,
    total: base.total + extra.total,
    rolls: [...(base.rolls || []), ...(extra.rolls || [])],
    critical: true,
    criticalRolls: extra.rolls || [],
  };
}

function criticalDamageDice(diceText) {
  const match = String(diceText || "").match(/(\d*)d(\d+)/i);
  if (!match) return null;
  const count = Number(match[1] || 1);
  const sides = Number(match[2]);
  if (!Number.isFinite(count) || !Number.isFinite(sides) || count <= 0 || sides <= 0) return null;
  return `${count}d${sides}`;
}
