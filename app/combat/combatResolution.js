import { distance } from "./grid.js";
import { classifyCover } from "./cover.js";
import {
  getActionUses,
  hasCondition,
  hasReaction,
  removeCondition,
  spendReaction,
} from "./actor.js";
import { conditionName, getConditionRules } from "./effects.js";
import {
  getEffectiveAc,
  rollAttackModifier,
  rollSaveModifier,
} from "./modifiers.js";
import { actorsInFootprint, buildFootprint } from "./footprints.js";
import { checkOutcome, getActor, livingActors } from "./combatState.js";
import { createCombatObjectFromAction } from "./combatObjects.js";
import {
  applyActionResolvedEffects,
  beginConcentration,
  applyCollisionDamage,
  applyDamage,
  applyDamageAmount,
  applyHitEffects,
  applySaveFailureEffects,
  clearConcentrationIfNoLinkedEffects,
  isCriticalHitFromConditions,
  rollConditionSave,
  rollSaveD20,
} from "./combatEffectsResolution.js";

export {
  applyCollisionDamage,
  applyActionResolvedEffects,
  beginConcentration,
  clearConcentrationIfNoLinkedEffects,
  rollConditionSave,
};

export function resolveOpportunityAttacks(snapshot, movingActor, from, to, dice, log) {
  if (!dice) return;
  const attackers = livingActors(snapshot)
    .filter((actor) => actor.team !== movingActor.team)
    .filter((actor) => hasReaction(actor))
    .filter((actor) => !(actor.conditions || []).some((condition) => getConditionRules(condition.id).blocksOpportunityAttacks))
    .map((actor) => ({ actor, action: getOpportunityAction(actor) }))
    .filter(({ action }) => action)
    .filter(({ actor, action }) => distance(actor.position, from) <= action.range)
    .filter(({ actor, action }) => distance(actor.position, to) > action.range);

  for (const { actor, action } of attackers) {
    if (movingActor.hp <= 0) break;
    spendReaction(actor);
    log.add("opportunity.attack", {
      round: snapshot.round,
      actorId: actor.id,
      actorName: actor.name,
      targetId: movingActor.id,
      targetName: movingActor.name,
      actionName: action.name,
    });
    log.add("reaction.spend", {
      round: snapshot.round,
      actorId: actor.id,
      actorName: actor.name,
      reactionAvailable: false,
      reason: "opportunity attack",
    });
    resolveAttack(snapshot, actor, movingActor, action, dice, log);
  }
  checkOutcome(snapshot, log);
}

export function resolveAttack(snapshot, actor, target, action, dice, log) {
  const attackRoll = rollAttackD20(actor, target, action, dice);
  const rollModifier = rollAttackModifier(snapshot, actor, target, action, dice);
  const attackBonus = (action.attackBonus || 0) + rollModifier.total;
  const total = attackRoll.roll + attackBonus;
  const cover = classifyCover(snapshot, actor, target, action);
  const ac = getEffectiveAc(snapshot, target, { source: actor, action });
  const effectiveAc = ac + cover.bonus;
  const hit = attackRoll.roll === 20 || (attackRoll.roll !== 1 && total >= effectiveAc);
  const critical = hit && isCriticalHitFromConditions(actor, target, action, attackRoll);

  log.add("attack.roll", {
    round: snapshot.round,
    actorId: actor.id,
    actorName: actor.name,
    targetId: target.id,
    targetName: target.name,
    actionId: action.id,
    actionName: action.name,
    roll: attackRoll.roll,
    rolls: attackRoll.rolls,
    mode: attackRoll.mode,
    reasons: attackRoll.reasons,
    bonus: attackBonus,
    baseBonus: action.attackBonus || 0,
    modifierReasons: rollModifier.reasons,
    total,
    ac,
    cover,
    effectiveAc,
  });
  log.add("attack.result", {
    round: snapshot.round,
    actorId: actor.id,
    actorName: actor.name,
    targetId: target.id,
    targetName: target.name,
    hit,
    critical,
  });
  consumeAttackRollConditions(snapshot, actor, target, attackRoll, log);

  if (hit) {
    applyDamage(snapshot, actor, target, action, dice, log, { critical });
    applyHitEffects(snapshot, actor, target, action, log);
  }
}

export function resolveSaveSpell(snapshot, actor, target, action, dice, log) {
  const saveRoll = rollSaveD20(target, action, dice);
  const cover = classifyCover(snapshot, actor, target, action);
  const saveModifier = rollSaveModifier(snapshot, target, action.saveAbility, action, dice);
  const baseBonus = target.saves?.[action.saveAbility] || 0;
  const bonus = baseBonus + saveModifier.total + cover.bonus;
  const total = saveRoll.roll + bonus;
  const success = !saveRoll.autoFail && total >= action.spellSaveDC;

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

  if (!success) {
    if (action.damage) applyDamage(snapshot, actor, target, action, dice, log);
    applySaveFailureEffects(snapshot, actor, target, action, log);
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
  const roll = rollSaveD20(actor, saveAction, dice);
  const modifier = rollSaveModifier(snapshot, actor, ability, saveAction, dice);
  const baseBonus = actor.saves?.[ability] || 0;
  const bonus = baseBonus + modifier.total;
  const total = roll.roll + bonus;
  const success = !roll.autoFail && total >= dc;
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

  const shape = action.targeting?.shape || "radius";
  const cells = buildFootprint(snapshot.grid, shape, anchor, {
    origin: actor.position,
    radiusSquares: action.targeting?.radiusSquares ?? 2,
    lengthSquares: action.targeting?.lengthSquares ?? 6,
    sizeSquares: action.targeting?.sizeSquares ?? 6,
  });
  const targets = actorsInFootprint(snapshot.actors, cells)
    .map((target) => getActor(snapshot, target.id))
    .filter(Boolean);

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

function isHarmful(action) {
  return action?.tags?.harmful === true || Boolean(action?.damage || action?.damageType || action?.attackBonus || action?.saveAbility);
}

export function resolveObjectSpell(snapshot, actor, action, targetPayload, log) {
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
  return true;
}

function resolveAreaSaveAgainstTarget(snapshot, actor, target, action, dice, log) {
  const saveRoll = rollSaveD20(target, action, dice);
  const saveModifier = rollSaveModifier(snapshot, target, action.saveAbility, action, dice);
  const baseBonus = target.saves?.[action.saveAbility] || 0;
  const bonus = baseBonus + saveModifier.total;
  const total = saveRoll.roll + bonus;
  const success = !saveRoll.autoFail && total >= action.spellSaveDC;

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

  if (action.damage) {
    const rolled = dice.rollDamage(action.damage);
    const amount = success ? Math.floor(Math.max(0, rolled.total) / 2) : Math.max(0, rolled.total);
    applyDamageAmount(snapshot, actor, target, action, rolled, amount, dice, log);
  }
  if (!success) applySaveFailureEffects(snapshot, actor, target, action, log);
}

function getOpportunityAction(actor) {
  return actor.actions.find((action) =>
    getActionUses(action) > 0 &&
    action.range === 1 &&
    (action.type === "weapon_attack" || action.type === "melee_attack")
  ) || null;
}

function rollAttackD20(actor, target, action, dice) {
  const reasons = [];
  const consumed = [];
  let advantage = 0;

  for (const condition of actor.conditions || []) {
    const id = conditionId(condition);
    const rules = getConditionRules(id);
    if (rules.outgoingAttackAdvantage) {
      advantage += 1;
      reasons.push(`ADV: ${conditionName(id)}`);
      if (rules.consumeOn === "outgoing_attack") consumed.push({ actor, condition: id });
    }
    if (rules.outgoingAttackDisadvantage) {
      advantage -= 1;
      reasons.push(`DIS: ${conditionName(id)}`);
      if (rules.consumeOn === "outgoing_attack") consumed.push({ actor, condition: id });
    }
  }

  for (const condition of target.conditions || []) {
    const id = conditionId(condition);
    const rules = getConditionRules(id);
    if (rules.incomingAttackAdvantage) {
      advantage += 1;
      reasons.push(`ADV: ${conditionName(id)}`);
      if (rules.consumeOn === "incoming_attack") consumed.push({ actor: target, condition: id });
    }
    if (rules.incomingAttackDisadvantage) {
      advantage -= 1;
      reasons.push(`DIS: ${conditionName(id)}`);
      if (rules.consumeOn === "incoming_attack") consumed.push({ actor: target, condition: id });
    }
  }

  if (hasCondition(target, "prone")) {
    if (distance(actor.position, target.position) <= 1) {
      advantage += 1;
      reasons.push(`ADV: ${target.name} is prone and attacker is adjacent`);
    } else {
      advantage -= 1;
      reasons.push(`DIS: ${target.name} is prone and attacker is not adjacent`);
    }
  }

  if (advantage === 0) {
    const d20 = dice.rollD20({ type: "attack", label: action.name });
    return { roll: d20.roll, rolls: [d20.roll], mode: "normal", reasons, consumed };
  }

  const first = dice.rollD20({ type: "attack", label: action.name });
  const second = dice.rollD20({ type: "attack", label: action.name });
  const rolls = [first.roll, second.roll];
  return {
    roll: advantage > 0 ? Math.max(...rolls) : Math.min(...rolls),
    rolls,
    mode: advantage > 0 ? "advantage" : "disadvantage",
    reasons,
    consumed,
  };
}

function consumeAttackRollConditions(snapshot, actor, target, attackRoll, log) {
  for (const item of attackRoll.consumed || []) {
    if (!removeCondition(item.actor, item.condition)) continue;
    log.add("condition.removed", {
      round: snapshot.round,
      actorId: item.actor.id,
      actorName: item.actor.name,
      condition: item.condition,
      reason: item.actor.id === actor.id
        ? "used on attack roll"
        : `used by ${actor.name}'s attack`,
      targetId: target.id,
      targetName: target.name,
    });
  }
}

function conditionId(condition) {
  return typeof condition === "string" ? condition : condition?.id;
}
