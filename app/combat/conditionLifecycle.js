import { distance } from "./grid.js";
import { addCondition, hasCondition, removeCondition } from "./actor.js";
import {
  advanceConditionDuration,
  conditionName,
  createConditionInstance,
  getConditionRules,
  shouldRepeatSaveAt,
} from "./effects.js";
import { removeActiveEffect, rollSaveModifier } from "./modifiers.js";
import { clearConcentrationIfNoLinkedEffects, rollConditionSave } from "./combatResolution.js";
import { applyDamageAmount, rollSaveD20 } from "./combatEffectsResolution.js";
import { applyLuckyToRoll } from "./luck.js";
import { cleanupInvalidMarks, removeMark } from "./marks.js";

export function processOngoingEffects(snapshot, actor, timing, dice, log) {
  if (!actor || actor.hp <= 0) return;
  cleanupInvalidSourceConditions(snapshot, log);
  processMarkDurations(snapshot, actor, timing, log);
  processActiveEffectDurations(snapshot, actor, timing, log);
  const conditions = [...(actor.conditions || [])];
  for (const condition of conditions) {
    if (!hasCondition(actor, condition.id)) continue;
    processConditionOngoingEffects(snapshot, actor, condition, timing, dice, log);
    if (!hasCondition(actor, condition.id)) continue;
    if (shouldRepeatSaveAt(condition, timing)) {
      const removedBySave = resolveConditionRepeatSave(snapshot, actor, condition, dice, log);
      if (removedBySave) continue;
    }
    if (!hasCondition(actor, condition.id)) continue;
    const duration = advanceConditionDuration(condition, timing);
    if (!duration.expired) continue;
    removeCondition(actor, condition.id);
    log.add("condition.removed", {
      round: snapshot.round,
      actorId: actor.id,
      actorName: actor.name,
      condition: condition.id,
      reason: duration.reason,
    });
    clearConcentrationIfNoLinkedEffects(snapshot, condition, log, "all concentration-linked effects ended");
  }
  processCombatObjectDurations(snapshot, actor, timing, log);
}

function processConditionOngoingEffects(snapshot, actor, condition, timing, dice, log) {
  if (!dice || !Array.isArray(condition.ongoingEffects)) return;
  for (const effect of condition.ongoingEffects) {
    if ((effect.trigger || "turn_start") !== timing) continue;
    if (effect.type === "damage") {
      const saveResult = effect.save ? resolveOngoingEffectSave(snapshot, actor, condition, effect, dice, log) : null;
      if (saveResult?.success && ["negates", "negates_effect"].includes(saveResult.onSave)) {
        log.add("ongoing.effect", ongoingEffectDetail(snapshot, actor, condition, effect, { negated: true }));
        continue;
      }
      const rolled = dice.rollDamage(effect.damage);
      const amount = saveResult?.success && saveResult.onSave === "half"
        ? Math.floor(Math.max(0, rolled.total) / 2)
        : Math.max(0, rolled.total);
      applyDamageAmount(snapshot, sourceActorForCondition(snapshot, condition), actor, {
        id: condition.sourceActionId || condition.id,
        name: effect.label || conditionName(condition.id),
        damage: effect.damage,
        damageType: effect.damageType || "untyped",
      }, rolled, amount, dice, log);
      log.add("ongoing.effect", ongoingEffectDetail(snapshot, actor, condition, effect, { amount }));
    }
  }
}

function resolveOngoingEffectSave(snapshot, actor, condition, effect, dice, log) {
  const ability = String(effect.save.ability || "").toLowerCase();
  const dc = effect.save.dc ?? condition.spellSaveDC ?? 10;
  const source = sourceActorForCondition(snapshot, condition);
  const roll = rollSaveD20(actor, { name: effect.label || conditionName(condition.id), saveAbility: ability }, dice, snapshot, source);
  const saveModifier = rollSaveModifier(snapshot, actor, ability, { name: effect.label || conditionName(condition.id), saveAbility: ability }, dice);
  const baseBonus = actor.saves?.[ability] || 0;
  const bonus = baseBonus + saveModifier.total;
  const total = roll.roll + bonus;
  const success = !roll.autoFail && total >= dc;
  log.add("save.roll", {
    round: snapshot.round,
    actorId: source.id,
    actorName: source.name,
    targetId: actor.id,
    targetName: actor.name,
    spellName: effect.label || conditionName(condition.id),
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
    targetId: actor.id,
    targetName: actor.name,
    spellName: effect.label || conditionName(condition.id),
    success,
  });
  return { success, onSave: effect.save.onSave };
}

function ongoingEffectDetail(snapshot, actor, condition, effect, extra = {}) {
  const source = sourceActorForCondition(snapshot, condition);
  return {
    round: snapshot.round,
    trigger: effect.trigger || "turn_start",
    sourceId: source.id,
    sourceName: source.name,
    actorId: actor.id,
    actorName: actor.name,
    condition: condition.id,
    effectType: effect.type,
    end: effect.end || null,
    ...extra,
  };
}

function sourceActorForCondition(snapshot, condition) {
  return snapshot.actors.find((actor) => actor.id === condition.sourceActorId) || {
    id: condition.sourceActorId || condition.id,
    name: condition.sourceActorId || conditionName(condition.id),
  };
}

export function processCombatObjectDurations(snapshot, actor, timing, log) {
  if (!actor || actor.hp <= 0) return;
  for (const object of [...(snapshot.combatObjects || [])]) {
    if (object.sourceActorId !== actor.id) continue;
    const duration = advanceConditionDuration(object, timing);
    if (!duration.expired) continue;
    snapshot.combatObjects = (snapshot.combatObjects || []).filter((item) => item.id !== object.id);
    log.add("object.removed", {
      round: snapshot.round,
      actorId: actor.id,
      actorName: actor.name,
      objectId: object.id,
      objectName: object.name,
      actionId: object.sourceActionId,
      reason: duration.reason,
    });
    clearConcentrationIfNoLinkedEffects(snapshot, object, log, "all concentration-linked effects ended");
  }
}

function processActiveEffectDurations(snapshot, actor, timing, log) {
  for (const effect of [...(actor.activeEffects || [])]) {
    const duration = advanceConditionDuration(effect, timing);
    if (!duration.expired) continue;
    removeActiveEffect(actor, effect.id);
    log.add("effect.removed", {
      round: snapshot.round,
      actorId: actor.id,
      actorName: actor.name,
      effectId: effect.id,
      label: effect.label || effect.id,
      reason: duration.reason,
    });
  }
}

function processMarkDurations(snapshot, actor, timing, log) {
  for (const mark of [...(actor.marks || [])]) {
    const duration = advanceConditionDuration(mark, timing);
    if (!duration.expired) continue;
    removeMark(actor, mark.id, mark.sourceActorId);
    log.add("mark.removed", {
      round: snapshot.round,
      actorId: actor.id,
      actorName: actor.name,
      markId: mark.id,
      markLabel: mark.label || mark.id,
      reason: duration.reason,
    });
  }
}

export function cleanupInvalidSourceConditions(snapshot, log) {
  cleanupInvalidMarks(snapshot, log);
  for (const actor of snapshot.actors) {
    for (const condition of [...(actor.conditions || [])]) {
      const cleanup = sourceCleanupReason(snapshot, actor, condition);
      if (!cleanup) continue;
      removeCondition(actor, condition.id);
      log.add("condition.removed", {
        round: snapshot.round,
        actorId: actor.id,
        actorName: actor.name,
        condition: condition.id,
        reason: cleanup.reason,
        sourceId: cleanup.source?.id || condition.sourceActorId || null,
        sourceName: cleanup.source?.name || null,
      });
      clearConcentrationIfNoLinkedEffects(snapshot, condition, log, "all concentration-linked effects ended");
    }
  }
}

function resolveConditionRepeatSave(snapshot, actor, condition, dice, log) {
  const repeatSave = condition.repeatSave;
  if (!repeatSave || !dice) return false;
  const saveModifier = rollSaveModifier(snapshot, actor, repeatSave.ability, { name: condition.id, saveAbility: repeatSave.ability }, dice);
  const baseBonus = actor.saves?.[repeatSave.ability] || 0;
  const bonus = baseBonus + saveModifier.total;
  const roll = applyLuckyToRoll({
    actor,
    roll: rollConditionSave(actor, condition, repeatSave, dice),
    dice,
    log,
    context: {
      round: snapshot.round,
      type: "save",
      label: condition.id,
      targetNumber: repeatSave.dc,
      bonus,
    },
  });
  const total = roll.roll + bonus;
  const success = !roll.autoFail && total >= repeatSave.dc;
  log.add("condition.save.roll", {
    round: snapshot.round,
    actorId: actor.id,
    actorName: actor.name,
    condition: condition.id,
    ability: repeatSave.ability,
    roll: roll.roll,
    rolls: roll.rolls,
    mode: roll.mode,
    reasons: roll.reasons,
    lucky: roll.lucky,
    bonus,
    baseBonus,
    modifierReasons: saveModifier.reasons,
    total,
    dc: repeatSave.dc,
  });
  log.add("condition.save.result", {
    round: snapshot.round,
    actorId: actor.id,
    actorName: actor.name,
    condition: condition.id,
    success,
  });
  if (success && repeatSave.removeOnSuccess) {
    removeCondition(actor, condition.id);
    log.add("condition.removed", {
      round: snapshot.round,
      actorId: actor.id,
      actorName: actor.name,
      condition: condition.id,
      reason: "successful end-of-turn save",
    });
    clearConcentrationIfNoLinkedEffects(snapshot, condition, log, "all concentration-linked effects ended");
    return true;
  }
  if (!success && repeatSave.onFailureCondition) {
    removeCondition(actor, condition.id);
    addCondition(actor, createConditionInstance({
      type: "condition",
      condition: repeatSave.onFailureCondition,
      duration: condition.duration,
      repeatSave: null,
    }, {
      id: condition.sourceActorId,
      name: condition.sourceActorId,
    }, {
      id: condition.sourceActionId,
      name: condition.sourceActionId,
      range: condition.sourceReach,
    }));
    log.add("condition.applied", {
      round: snapshot.round,
      sourceId: condition.sourceActorId,
      sourceName: condition.sourceActorId,
      targetId: actor.id,
      targetName: actor.name,
      condition: repeatSave.onFailureCondition,
      label: conditionName(repeatSave.onFailureCondition),
      actionName: condition.sourceActionId,
      noSave: false,
      reason: `failed ${condition.id} repeat save`,
    });
    return true;
  }
  return false;
}

function sourceCleanupReason(snapshot, actor, condition) {
  if (condition?.sourceObjectId) {
    const object = (snapshot.combatObjects || []).find((item) => item.id === condition.sourceObjectId) || null;
    return object ? null : { reason: "source object no longer exists", source: null };
  }
  if (!condition?.sourceActorId) return null;
  const rules = getConditionRules(condition.id);
  const source = snapshot.actors.find((item) => item.id === condition.sourceActorId) || null;
  if (!source) return { reason: "source no longer exists", source };

  if (rules.endsIfSourceIncapacitated && isIncapacitated(source)) {
    return { reason: `${source.name} is incapacitated`, source };
  }
  if (rules.endsIfSourceReachBroken) {
    const reach = condition.sourceReach ?? condition.reach ?? 1;
    if (distance(actor.position, source.position) > reach) {
      return { reason: `${source.name} is out of reach`, source };
    }
  }
  return null;
}

function isIncapacitated(actor) {
  if (!actor || actor.hp <= 0) return true;
  return (actor.conditions || []).some((condition) => {
    const id = typeof condition === "string" ? condition : condition.id;
    return Boolean(id && getConditionRules(id).blocksActions);
  });
}
