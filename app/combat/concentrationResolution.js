import { getActor } from "./combatState.js";
import { conditionName } from "./effects.js";
import { removeActiveEffect, rollSaveModifier } from "./modifiers.js";
import { applyLuckyToRoll } from "./luck.js";
import { rollSaveD20 } from "./combatRolls.js";

export function beginConcentration(snapshot, actor, action, log) {
  startConcentration(snapshot, actor, action, log);
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

export function resolveConcentrationCheck(snapshot, actor, damageAmount, dice, log, damageSource = null) {
  if (!actor?.concentration) return;
  const dc = Math.max(10, Math.floor(damageAmount / 2));
  const saveModifier = rollSaveModifier(snapshot, actor, "con", { name: "Concentration", saveAbility: "con" }, dice);
  const baseBonus = actor.saves?.con || 0;
  const bonus = baseBonus + saveModifier.total;
  const roll = applyLuckyToRoll({
    actor,
    roll: rollSaveD20(actor, { name: "Concentration", saveAbility: "con" }, dice, snapshot, null),
    dice,
    log,
    context: {
      round: snapshot.round,
      type: "save",
      label: "Concentration",
      targetNumber: dc,
      bonus,
    },
  });
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
    lucky: roll.lucky,
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
  if (success && damageSource && actor.concentrationSuccessRetaliation) {
    const baseAmount = actor.concentrationSuccessRetaliation.damageFrom === "charisma_modifier" ? Math.max(0, actor.abilityMods?.cha || 0) : 0;
    const damageType = actor.concentrationSuccessRetaliation.damageType || "necrotic";
    const amount = (damageSource.immunities || []).includes(damageType) ? 0 :
      (damageSource.resistances || []).includes(damageType) ? Math.floor(baseAmount / 2) : baseAmount;
    const hpBefore = damageSource.hp;
    damageSource.hp = Math.max(0, damageSource.hp - amount);
    damageSource.defeated = damageSource.hp <= 0;
    log.add("damage.applied", {
      round: snapshot.round, sourceId: actor.id, sourceName: actor.name, targetId: damageSource.id, targetName: damageSource.name,
      amount: hpBefore - damageSource.hp, originalAmount: baseAmount, damageModifiers: amount === baseAmount ? [] : ["resistance_or_immunity"], damageType,
      hpBefore, hpAfter: damageSource.hp, actionName: "Dead Hands Remember",
    });
  }
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
  actor.actions = (actor.actions || []).filter((action) => action.grantedByActionId !== concentration.actionId);
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
