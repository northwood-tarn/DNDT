import { addCondition } from "./actor.js";
import { combatObjectsAffectingActor } from "./combatObjects.js";
import { applyDamageAmount, rollSaveD20 } from "./combatEffectsResolution.js";
import { conditionName, createConditionInstance } from "./effects.js";
import { addActiveEffect, rollSaveModifier } from "./modifiers.js";

export function dispatchActorTrigger(snapshot, trigger, actor, dice, log, context = {}) {
  if (!actor || actor.hp <= 0) return;
  const objects = combatObjectsAffectingActor(snapshot, actor);
  for (const object of objects) {
    for (const effect of object.effects || []) {
      if ((effect.trigger || "passive") !== trigger) continue;
      applyTriggeredEffect(snapshot, object, actor, effect, dice, log, context);
    }
  }
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
    applyDamageAmount(snapshot, sourceActor(source), actor, {
      id: source.id,
      name: source.name,
      damage: effect.damage,
      damageType: effect.damageType || "untyped",
    }, rolled, amount, dice, log);
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

  if (effect.type === "condition" && effect.condition) {
    const saveResult = effect.save ? resolveTriggerSave(snapshot, source, actor, effect, dice, log) : null;
    if (saveResult?.success && ["negates", "negates_effect"].includes(saveResult.onSave)) {
      log.add("trigger.fired", triggerDetail(snapshot, source, actor, effect, context));
      return;
    }
    const condition = createConditionInstance(effect, sourceActor(source), { id: source.sourceActionId || source.id, name: source.name, range: null });
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
  const dc = effect.save.dc ?? source.spellSaveDC;
  const roll = rollSaveD20(actor, { name: source.name, saveAbility: ability }, dice);
  const modifier = rollSaveModifier(snapshot, actor, ability, { name: source.name, saveAbility: ability }, dice);
  const baseBonus = actor.saves?.[ability] || 0;
  const bonus = baseBonus + modifier.total;
  const total = roll.roll + bonus;
  const success = !roll.autoFail && total >= dc;
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

function sourceActor(source) {
  return {
    id: source.id,
    name: source.name,
  };
}
