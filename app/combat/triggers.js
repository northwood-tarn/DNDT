import { addCondition, removeCondition } from "./actor.js";
import { combatAuraEffectsAffectingActor, hasAuraConditionPrevention } from "./auras.js";
import { combatObjectsAffectingActor } from "./combatObjects.js";
import { applyDamageAmount, rollSaveD20 } from "./combatEffectsResolution.js";
import { conditionName, createConditionInstance } from "./effects.js";
import { addActiveEffect, rollSaveModifier } from "./modifiers.js";
import { applyLegendaryResistance } from "./legendaryResistance.js";
import { resolveForcedMovement } from "./forcedMovement.js";

export function dispatchActorTrigger(snapshot, trigger, actor, dice, log, context = {}) {
  if (!actor || actor.hp <= 0) return;
  const objects = combatObjectsAffectingActor(snapshot, actor);
  for (const object of objects) {
    if (context.sourceObjectId && object.id !== context.sourceObjectId) continue;
    for (const effect of object.effects || []) {
      if ((effect.trigger || "passive") !== trigger) continue;
      if (!effectAffectsActor(effect, object, actor)) continue;
      if (!effectRequirementsMet(effect, actor)) continue;
      applyTriggeredEffect(snapshot, object, actor, effect, dice, log, context);
    }
  }
  for (const effect of combatAuraEffectsAffectingActor(snapshot, actor)) {
    if ((effect.trigger || "passive") !== trigger) continue;
    if (!effectRequirementsMet(effect, actor)) continue;
    applyTriggeredEffect(snapshot, auraSourceFromEffect(effect), actor, effect, dice, log, context);
  }
}

function effectRequirementsMet(effect, actor) {
  if (!effect.requiresCondition) return true;
  return (actor.conditions || []).some((condition) => condition.id === effect.requiresCondition);
}

function effectAffectsActor(effect, source, actor) {
  const sourceTeam = effect.sourceTeam || source.sourceTeam;
  if (effect.type === "damage" && source.safeGeometry === true && source.sourceActionTags?.device === true && actor.team === sourceTeam) {
    return false;
  }
  if (!effect.affects || effect.affects === "all") return true;
  if (effect.affects === "allies") return actor.team === sourceTeam;
  if (effect.affects === "enemies") return actor.team !== sourceTeam;
  return true;
}

function applyTriggeredEffect(snapshot, source, actor, effect, dice, log, context) {
  if (effect.type === "damage") {
    if (!dice?.rollDamage) return;
    const saveResult = effect.save ? resolveTriggerSave(snapshot, source, actor, effect, dice, log) : null;
    const rolled = dice.rollDamage(effect.damage);
    const amount = saveResult?.success && saveResult.onSave === "half"
      ? Math.floor(Math.max(0, rolled.total) / 2)
      : Math.max(0, rolled.total);
    if (saveResult?.success && ["negates", "negates_effect"].includes(saveResult.onSave)) {
      log.add("trigger.fired", triggerDetail(snapshot, source, actor, effect, context));
      return;
    }
    applyDamageAmount(snapshot, sourceActor(snapshot, source), actor, {
      id: source.id,
      name: source.name,
      damage: effect.damage,
      damageType: effect.damageType || "untyped",
      tags: structuredClone(source.sourceActionTags || {}),
    }, rolled, amount, dice, log);
    if (!saveResult?.success && effect.conditionOnFail) {
      addCondition(actor, createConditionInstance({ type: "condition", condition: effect.conditionOnFail, duration: null }, sourceActor(snapshot, source), { id: source.sourceActionId || source.id, name: source.name }));
      log.add("condition.applied", { round: snapshot.round, sourceId: source.id, sourceName: source.name, targetId: actor.id, targetName: actor.name, condition: effect.conditionOnFail, label: conditionName(effect.conditionOnFail), actionName: source.name, noSave: true });
    }
    if (!saveResult?.success && effect.pushOnFailFt > 0) {
      const movement = resolveForcedMovement(snapshot, sourceActorPosition(snapshot, source), actor, { direction: "away_from_source", distanceSquares: Math.floor(effect.pushOnFailFt / 5) });
      if (movement.movedSquares) log.add("forced.move", { round: snapshot.round, actorId: source.sourceActorId || source.id, actorName: source.name, targetId: actor.id, targetName: actor.name, from: movement.from, to: movement.to, reason: source.name, movedSquares: movement.movedSquares });
    }
    log.add("trigger.fired", triggerDetail(snapshot, source, actor, effect, context));
    return;
  }

  if (effect.type === "modifier") {
    const id = `${source.id}_${effect.stat}_${actor.id}`;
    addActiveEffect(actor, {
      ...effect,
      id,
      label: effect.label || source.name,
      sourceObjectId: source.id,
      trigger: "passive",
    });
    log.add("trigger.fired", triggerDetail(snapshot, source, actor, effect, context));
    return;
  }

  if (effect.type === "temp_hp") {
    const before = actor.tempHp || 0;
    actor.tempHp = Math.max(before, effect.amount || 0);
    log.add("temp_hp.applied", {
      round: snapshot.round,
      sourceId: source.id,
      sourceName: source.name,
      targetId: actor.id,
      targetName: actor.name,
      actionName: source.name,
      amount: actor.tempHp,
      before,
    });
    log.add("trigger.fired", triggerDetail(snapshot, source, actor, effect, context));
    return;
  }

  if (effect.type === "remove_conditions") {
    const removed = [];
    for (const conditionId of effect.conditions || []) {
      if (!removeCondition(actor, conditionId)) continue;
      removed.push(conditionId);
      log.add("condition.removed", {
        round: snapshot.round,
        actorId: actor.id,
        actorName: actor.name,
        condition: conditionId,
        reason: source.name,
      });
    }
    if (removed.length) log.add("trigger.fired", triggerDetail(snapshot, source, actor, effect, { ...context, removed }));
    return;
  }

  if (effect.type === "condition" && effect.condition) {
    const saveResult = effect.save ? resolveTriggerSave(snapshot, source, actor, effect, dice, log) : null;
    if (saveResult?.success && ["negates", "negates_effect"].includes(saveResult.onSave)) {
      log.add("trigger.fired", triggerDetail(snapshot, source, actor, effect, context));
      return;
    }
    const preventedBy = hasAuraConditionPrevention(snapshot, actor, effect.condition, { source: sourceActor(snapshot, source) });
    if (preventedBy) {
      log.add("condition.prevented", {
        round: snapshot.round,
        sourceId: source.id,
        sourceName: source.name,
        targetId: actor.id,
        targetName: actor.name,
        condition: effect.condition,
        label: conditionName(effect.condition),
        reason: preventedBy.label || preventedBy.id,
        actionName: source.name,
      });
      return;
    }
    const condition = createConditionInstance(effect, sourceActor(snapshot, source), { id: source.sourceActionId || source.id, name: source.name, range: null });
    condition.sourceObjectId = source.id;
    condition.sourceActorId = source.sourceActorId || null;
    addCondition(actor, condition);
    log.add("condition.applied", {
      round: snapshot.round,
      sourceId: source.id,
      sourceName: source.name,
      targetId: actor.id,
      targetName: actor.name,
      condition: effect.condition,
      label: conditionName(effect.condition),
      actionName: source.name,
      noSave: true,
    });
    log.add("trigger.fired", triggerDetail(snapshot, source, actor, effect, context));
  }
}

function resolveTriggerSave(snapshot, source, actor, effect, dice, log) {
  if (!dice?.rollD20) return { success: false, onSave: effect.save.onSave };
  const ability = String(effect.save.ability || "").toLowerCase();
  const dc = effect.save.dc ?? effect.spellSaveDC ?? source.spellSaveDC;
  const roll = rollSaveD20(actor, { name: source.name, saveAbility: ability }, dice, snapshot, sourceActor(snapshot, source));
  const modifier = rollSaveModifier(snapshot, actor, ability, { name: source.name, saveAbility: ability }, dice);
  const baseBonus = actor.saves?.[ability] || 0;
  const bonus = baseBonus + modifier.total;
  const total = roll.roll + bonus;
  let success = !roll.autoFail && total >= dc;
  ({ success } = applyLegendaryResistance({ snapshot, target: actor, success, action: { id: source.sourceActionId || source.id, name: source.name, effects: [effect] }, effect, log, total, dc }));
  log.add("save.roll", {
    round: snapshot.round,
    actorId: source.id,
    actorName: source.name,
    targetId: actor.id,
    targetName: actor.name,
    spellName: source.name,
    ability,
    roll: roll.roll,
    rolls: roll.rolls,
    mode: roll.mode,
    reasons: roll.reasons,
    bonus,
    baseBonus,
    modifierReasons: modifier.reasons,
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
    spellName: source.name,
    success,
  });
  return { success, onSave: effect.save.onSave };
}

function triggerDetail(snapshot, source, actor, effect, context) {
  return {
    round: snapshot.round,
    trigger: effect.trigger,
    sourceId: source.id,
    sourceName: source.name,
    actorId: actor.id,
    actorName: actor.name,
    effectType: effect.type,
    context,
  };
}

function sourceActor(snapshot, source) {
  return (snapshot.actors || []).find((actor) => actor.id === source.sourceActorId) || {
    id: source.sourceActorId || source.id,
    name: source.name,
    team: source.team || null,
    tags: source.tags || [],
    creatureType: source.creatureType || null,
  };
}

function sourceActorPosition(snapshot, source) {
  return (snapshot.actors || []).find((actor) => actor.id === (source.sourceActorId || source.id))?.position || source.position || { x: 0, y: 0 };
}

function auraSourceFromEffect(effect) {
  return {
    id: effect.sourceId || effect.id,
    name: effect.label || effect.sourceId || "Aura",
    sourceActorId: effect.sourceActorId || null,
    sourceActionId: effect.sourceFeatureId || null,
    spellSaveDC: effect.spellSaveDC ?? null,
    team: effect.sourceTeam || null,
    tags: effect.sourceTags || [],
    creatureType: effect.sourceCreatureType || null,
  };
}
