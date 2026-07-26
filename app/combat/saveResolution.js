import { classifyCover } from "./cover.js";
import { conditionName, getConditionRules } from "./effects.js";
import { actorsInFootprint, buildFootprint } from "./footprints.js";
import { createCombatObjectFromAction } from "./combatObjects.js";
import { dispatchActorTrigger } from "./triggers.js";
import { getActor } from "./combatState.js";
import { applyDamage, applyDamageAmount, applySaveFailureEffects, rollSaveD20 } from "./combatEffectsResolution.js";
import { applyLuckyToRoll } from "./luck.js";
import { removeActiveEffect, rollSaveModifier } from "./modifiers.js";
import { combatAuraEffectsAffectingActor } from "./auras.js";
import { applyLegendaryResistance } from "./legendaryResistance.js";
import { spellBlockingGlobe } from "./rules.js";

export function resolveSaveSpell(snapshot, actor, target, action, dice, log) {
  const cover = classifyCover(snapshot, actor, target, action);
  const saveModifier = rollSaveModifier(snapshot, target, action.saveAbility, action, dice);
  const baseBonus = target.saves?.[action.saveAbility] || 0;
  const bonus = baseBonus + saveModifier.total + cover.bonus;
  const saveRoll = applyLuckyToRoll({
    actor: target,
    roll: rollSaveD20(target, action, dice, snapshot, actor),
    dice,
    log,
    context: {
      round: snapshot.round,
      type: "save",
      label: action.name,
      targetNumber: action.spellSaveDC,
      bonus,
    },
  });
  const total = saveRoll.roll + bonus;
  let success = !saveRoll.autoFail && total >= action.spellSaveDC;
  ({ success } = applyLegendaryResistance({ snapshot, target, success, action, log, total, dc: action.spellSaveDC }));

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
    bonus: baseBonus + saveModifier.total,
    baseBonus,
    modifierReasons: saveModifier.reasons,
    cover,
    effectiveBonus: bonus,
    total,
    dc: action.spellSaveDC,
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
  consumeSaveModifiers(snapshot, target, saveModifier, log, "used on saving throw");

  if (!success) {
    if (action.damage) applyDamage(snapshot, actor, target, resolveConditionalDamageAction(action, target), dice, log);
    applySaveFailureEffects(snapshot, actor, target, action, log, dice);
  } else if (action.damage && action.saveOnSuccess === "half") {
    const damageAction = resolveConditionalDamageAction(action, target);
    const rolled = dice.rollDamage(damageAction.damage);
    applyDamageAmount(snapshot, actor, target, damageAction, rolled, Math.floor(Math.max(0, rolled.total) / 2), dice, log);
  }
}

export function resolveAutoDamageSpell(snapshot, actor, target, action, dice, log) {
  const hits = Math.max(1, action.hits || 1);
  log.add("auto_damage.target", {
    round: snapshot.round,
    actorId: actor.id,
    actorName: actor.name,
    targetId: target.id,
    targetName: target.name,
    actionId: action.id,
    actionName: action.name,
    hits,
  });
  for (let i = 0; i < hits; i++) {
    if (target.hp <= 0) break;
    applyDamage(snapshot, actor, target, action, dice, log);
  }
}

export function resolveTargetSaveGate(snapshot, actor, target, action, dice, log) {
  if (!isHarmful(action) || !dice) return { ok: true, wasted: false };
  const gate = (target.conditions || [])
    .map((condition) => ({ condition, rules: getConditionRules(condition.id) }))
    .find(({ rules }) => rules.incomingTargetSaveGate);
  if (!gate) return { ok: true, wasted: false };

  const ability = gate.rules.incomingTargetSaveAbility || "wis";
  const dc = gate.condition.spellSaveDC || action.spellSaveDC || 10;
  const saveAction = { name: gate.rules.name || conditionName(gate.condition.id), saveAbility: ability };
  const modifier = rollSaveModifier(snapshot, actor, ability, saveAction, dice);
  const baseBonus = actor.saves?.[ability] || 0;
  const bonus = baseBonus + modifier.total;
  const roll = applyLuckyToRoll({
    actor,
    roll: rollSaveD20(actor, saveAction, dice, snapshot, target),
    dice,
    log,
    context: {
      round: snapshot.round,
      type: "save",
      label: saveAction.name,
      targetNumber: dc,
      bonus,
    },
  });
  const total = roll.roll + bonus;
  let success = !roll.autoFail && total >= dc;
  ({ success } = applyLegendaryResistance({ snapshot, target: actor, success, action: saveAction, effect: gate.condition, log, total, dc }));
  log.add("target_gate.save.roll", {
    round: snapshot.round,
    actorId: actor.id,
    actorName: actor.name,
    targetId: target.id,
    targetName: target.name,
    condition: gate.condition.id,
    ability,
    roll: roll.roll,
    rolls: roll.rolls,
    mode: roll.mode,
    reasons: roll.reasons,
    lucky: roll.lucky,
    bonus,
    baseBonus,
    modifierReasons: modifier.reasons,
    total,
    dc,
  });
  log.add("target_gate.save.result", {
    round: snapshot.round,
    actorId: actor.id,
    actorName: actor.name,
    targetId: target.id,
    targetName: target.name,
    condition: gate.condition.id,
    success,
  });
  return success ? { ok: true, wasted: false } : { ok: false, wasted: true };
}

export function resolveAreaSaveSpell(snapshot, actor, action, targetPayload, dice, log) {
  const anchor = action.selfCenteredArea ? actor.position : targetPayload?.anchor || targetPayload;
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

  const shape = action.targeting?.shape || "radius";
  const cells = buildFootprint(snapshot.grid, shape, anchor, {
    origin: actor.position,
    radiusSquares: action.targeting?.radiusSquares ?? 2,
    lengthSquares: action.targeting?.lengthSquares ?? 6,
    sizeSquares: action.targeting?.sizeSquares ?? 6,
  });
  const targets = actorsInFootprint(snapshot.actors, cells)
    .map((target) => getActor(snapshot, target.id))
    .filter(Boolean)
    .filter((target) => areaTargetMatches(actor, target, action))
    .filter((target) => !spellBlockingGlobe(snapshot, actor, action, target));

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
    resolveAreaSaveAgainstTarget(snapshot, actor, target, action, dice, log);
  }
  return true;
}

function areaTargetMatches(actor, target, action) {
  if (target.hp <= 0) return false;
  if (action.targetTeamFilter === "enemies") return target.team !== actor.team;
  if (action.targetTeamFilter === "allies") return target.team === actor.team;
  return true;
}

export function resolveObjectSpell(snapshot, actor, action, targetPayload, log, dice = null) {
  const anchor = targetPayload?.anchor || targetPayload;
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
    lengthSquares: object.lengthSquares,
    sizeSquares: object.sizeSquares,
    blocksMovement: object.blocksMovement,
    blocksLineOfSight: object.blocksLineOfSight,
    difficultTerrain: object.difficultTerrain,
  });
  for (const target of snapshot.actors || []) dispatchActorTrigger(snapshot, "area_created", target, dice, log, { action });
  return true;
}

function resolveAreaSaveAgainstTarget(snapshot, actor, target, action, dice, log) {
  action = actionWithRandomDamageType(action, dice, log, snapshot, actor, target);
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
      targetNumber: action.spellSaveDC,
      bonus,
    },
  });
  const total = saveRoll.roll + bonus;
  let success = !saveRoll.autoFail && total >= action.spellSaveDC;
  ({ success } = applyLegendaryResistance({ snapshot, target, success, action, log, total, dc: action.spellSaveDC }));

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
    dc: action.spellSaveDC,
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
  consumeSaveModifiers(snapshot, target, saveModifier, log, "used on saving throw");

  if (Array.isArray(action.damageParts) && action.damageParts.length) {
    for (const part of action.damageParts) {
      const damageAction = { ...action, damage: part.damage, damageType: part.damageType };
      const rolled = dice.rollDamage(damageAction.damage);
      const evades = success && action.saveOnSuccess === "half" && hasSaveEvasion(snapshot, target, action);
      const amount = evades ? 0 : success ? Math.floor(Math.max(0, rolled.total) / 2) : Math.max(0, rolled.total);
      applyDamageAmount(snapshot, actor, target, damageAction, rolled, amount, dice, log);
    }
  } else if (action.damage) {
    const damageAction = resolveConditionalDamageAction(action, target);
    const rolled = dice.rollDamage(damageAction.damage);
    const evades = success && action.saveOnSuccess === "half" && hasSaveEvasion(snapshot, target, action);
    const amount = evades ? 0 : success ? Math.floor(Math.max(0, rolled.total) / 2) : Math.max(0, rolled.total);
    applyDamageAmount(snapshot, actor, target, damageAction, rolled, amount, dice, log);
  }
  if (!success) applySaveFailureEffects(snapshot, actor, target, action, log, dice);
}

function actionWithRandomDamageType(action, dice, log, snapshot, actor, target) {
  const choices = action.randomDamageTypeChoices;
  if (!Array.isArray(choices) || !choices.length || !dice?.rollDamage) return action;
  const rolled = dice.rollDamage(`1d${choices.length}`);
  const damageType = choices[Math.max(0, Math.min(choices.length - 1, rolled.total - 1))];
  log.add("damage.type.random", { round: snapshot.round, actorId: actor.id, actorName: actor.name, targetId: target.id, targetName: target.name, actionName: action.name, damageType });
  return { ...action, damageType };
}

function hasSaveEvasion(snapshot, target, action) {
  const effects = combatAuraEffectsAffectingActor(snapshot, target);
  return effects.some((effect) => effect.type === "save_evasion" && (!effect.tags?.length || effect.tags.some((tag) => action.tags?.[tag] === true)));
}

function resolveConditionalDamageAction(action, target) {
  const conditional = action?.conditionalDamage;
  if (!conditional?.alternate) return action;
  if (conditional.condition === "if_damaged" && Number.isFinite(target.hp) && Number.isFinite(target.maxHp) && target.hp < target.maxHp) {
    return { ...action, damage: conditional.alternate };
  }
  return conditional.base ? { ...action, damage: conditional.base } : action;
}

function consumeSaveModifiers(snapshot, actor, saveModifier, log, reason) {
  for (const detail of saveModifier?.details || []) {
    if (detail.consumeOn !== "outgoing_save") continue;
    if (!removeActiveEffect(actor, detail.id)) continue;
    log.add("effect.removed", {
      round: snapshot.round,
      actorId: actor.id,
      actorName: actor.name,
      effectId: detail.id,
      reason,
    });
  }
}

function isHarmful(action) {
  return action?.tags?.harmful === true || Boolean(action?.damage || action?.damageType || action?.attackBonus || action?.saveAbility);
}
