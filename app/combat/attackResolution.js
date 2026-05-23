import { getActionUses, hasCondition, hasReaction, removeCondition, spendReaction } from "./actor.js";
import { checkOutcome, livingActors } from "./combatState.js";
import { classifyCover } from "./cover.js";
import { conditionName, getConditionRules } from "./effects.js";
import { applyDamage, applyDamageAmount, applyHitEffects, isCriticalHitFromConditions } from "./combatEffectsResolution.js";
import { distance } from "./grid.js";
import { applyLuckyToRoll } from "./luck.js";
import { collectAttackRollModeDetails, getEffectiveAc, removeActiveEffect, rollAttackModifier } from "./modifiers.js";
import {
  resolveCriticalReactionAdjustment,
  resolveIncomingHitReactionAdjustment,
  resolveReactionTriggers,
  resolveSourceMissReactionAdjustment,
} from "./reactions.js";
import { hasCriticalHitTrigger } from "./featureTriggers.js";
import { prepareDamageRollHooksForAttack } from "./featureHooks.js";
import { weaponAttackAbilityModifier } from "./weaponMasteryResolution.js";
import { createCleaveSecondaryAttack, findCleaveTarget } from "./weaponMasteryActions.js";

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
  prepareDamageRollHooksForAttack(actor, action);
  const rollModifier = rollAttackModifier(snapshot, actor, target, action, dice);
  const attackBonus = (action.attackBonus || 0) + rollModifier.total;
  const cover = classifyCover(snapshot, actor, target, action);
  const ac = getEffectiveAc(snapshot, target, { source: actor, action });
  const effectiveAc = ac + cover.bonus;
  const attackRoll = applyLuckyToRoll({
    actor,
    roll: rollAttackD20(snapshot, actor, target, action, dice),
    dice,
    log,
    context: {
      round: snapshot.round,
      type: "attack",
      label: action.name,
      targetNumber: effectiveAc,
      bonus: attackBonus,
    },
  });
  let total = attackRoll.roll + attackBonus;
  let hit = attackRoll.roll === 20 || (attackRoll.roll !== 1 && total >= effectiveAc);
  if (!hit) {
    const adjusted = resolveSourceMissReactionAdjustment(snapshot, {
      source: actor,
      target,
      action,
      roll: attackRoll.roll,
      total,
      effectiveAc,
      hit,
    }, log);
    total = adjusted.total;
    hit = adjusted.hit;
  }
  if (hit) {
    const adjusted = resolveIncomingHitReactionAdjustment(snapshot, {
      source: actor,
      target,
      action,
      roll: attackRoll.roll,
      total,
      effectiveAc,
      hit,
    }, log);
    hit = adjusted.hit;
  }
  let critical = hit && (
    isCriticalHitFromConditions(actor, target, action, attackRoll) ||
    hasCriticalHitTrigger(actor, target, "source_hits_surprised_target")
  );
  critical = resolveCriticalReactionAdjustment(snapshot, { source: actor, target, action, critical }, log);

  log.add("attack.roll", {
    round: snapshot.round,
    actorId: actor.id,
    actorName: actor.name,
    targetId: target.id,
    targetName: target.name,
    actionId: action.id,
    actionName: action.name,
    actionType: action.type,
    roll: attackRoll.roll,
    rolls: attackRoll.rolls,
    mode: attackRoll.mode,
    reasons: attackRoll.reasons,
    lucky: attackRoll.lucky,
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
    actionId: action.id,
    actionName: action.name,
    actionType: action.type,
    hit,
    critical,
  });
  consumeAttackRollConditions(snapshot, actor, target, attackRoll, log);

  if (hit) {
    applyDamage(snapshot, actor, target, action, dice, log, { critical });
    applyHitEffects(snapshot, actor, target, action, log, dice);
    applyCleaveOnHit(snapshot, actor, target, action, dice, log);
  } else {
    applyGrazeOnMiss(snapshot, actor, target, action, dice, log);
    resolveReactionTriggers(snapshot, "missed_by_melee_attack", { source: actor, target, action }, dice, log, { resolveAttack, applyDamageAmount });
  }
}

function applyCleaveOnHit(snapshot, actor, target, action, dice, log) {
  if (action.weaponMastery !== "cleave" || action.weaponMasteryActive !== true || actor.turnFlags?.cleaveResolvedThisTurn || action.cleaveSecondary === true) return;
  const cleaveTarget = findCleaveTarget(snapshot, actor, target);
  if (!cleaveTarget) return;
  actor.turnFlags ??= {};
  actor.turnFlags.cleaveResolvedThisTurn = true;
  log.add("mastery.cleave", {
    round: snapshot.round,
    actorId: actor.id,
    actorName: actor.name,
    targetId: target.id,
    targetName: target.name,
    cleaveTargetId: cleaveTarget.id,
    cleaveTargetName: cleaveTarget.name,
    actionName: action.name,
  });
  resolveAttack(snapshot, actor, cleaveTarget, createCleaveSecondaryAttack(action), dice, log);
}

function applyGrazeOnMiss(snapshot, actor, target, action, dice, log) {
  if (action.weaponMastery !== "graze" || action.weaponMasteryActive !== true || target.hp <= 0) return;
  const amount = Math.max(0, weaponAttackAbilityModifier(actor, action));
  if (amount <= 0) return;
  applyDamageAmount(snapshot, actor, target, {
    id: `${action.id}_graze`,
    name: `${action.name} Graze`,
    damage: String(amount),
    damageType: action.damageType,
    weaponMastery: "graze",
  }, {
    dice: String(amount),
    rolls: [],
    modifier: amount,
    total: amount,
  }, amount, dice, log);
}

function getOpportunityAction(actor) {
  return actor.actions.find((action) =>
    getActionUses(action) > 0 &&
    action.range === 1 &&
    (action.type === "weapon_attack" || action.type === "melee_attack")
  ) || null;
}

function rollAttackD20(snapshot, actor, target, action, dice) {
  const reasons = [];
  const consumed = [];
  let advantage = 0;

  for (const modifier of collectAttackRollModeDetails(snapshot, actor, target, action)) {
    if (modifier.mode === "advantage") {
      advantage += 1;
      reasons.push(`ADV: ${modifier.label}`);
    }
    if (modifier.mode === "disadvantage") {
      advantage -= 1;
      reasons.push(`DIS: ${modifier.label}`);
    }
    if (modifier.consumeOn === "outgoing_attack" && modifier.stat === "attack_roll") {
      consumed.push({ actor, effectId: modifier.id });
    }
    if (modifier.consumeOn === "incoming_attack" && modifier.stat === "incoming_attack_roll") {
      consumed.push({ actor: target, effectId: modifier.id });
    }
  }

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
    if (item.effectId) {
      if (!removeActiveEffect(item.actor, item.effectId)) continue;
      log.add("effect.removed", {
        round: snapshot.round,
        actorId: item.actor.id,
        actorName: item.actor.name,
        effectId: item.effectId,
        reason: item.actor.id === actor.id
          ? "used on attack roll"
          : `used by ${actor.name}'s attack`,
        targetId: target.id,
        targetName: target.name,
      });
      continue;
    }
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
