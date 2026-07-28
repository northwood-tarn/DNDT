import { addCondition, spendResourceUse } from "./actor.js";
import { getActionTags } from "./actionTags.js";
import { conditionName, createConditionInstance, normalizeEffect } from "./effects.js";
import { distance } from "./grid.js";
import { addActiveEffect } from "./modifiers.js";
import { isHealingBlockedByCombatObject } from "./combatObjects.js";

export function applyFeatureEffectRiders({ snapshot, actor, target, action, trigger, dice, log, resolveSave }) {
  for (const rider of collectFeatureEffectRiders(actor, target, action, { trigger })) {
    if (rider.save && !dice) continue;
    if (rider.save && dice) {
      const save = resolveSave(rider);
      if (save.success && ["negates", "negates_effect", undefined].includes(save.onSave)) continue;
    }
    if (rider.type === "condition" && rider.condition) {
      applyFeatureConditionRider(snapshot, actor, target, action, rider, log);
      markFeatureEffectRiderUsed(actor, rider);
      continue;
    }
    if (rider.type === "modifier" && rider.stat) {
      applyFeatureModifierRider(snapshot, actor, target, action, rider, log);
      markFeatureEffectRiderUsed(actor, rider);
      continue;
    }
    if (rider.type === "healing") {
      applyFeatureHealingRider(snapshot, actor, action, rider, dice, log);
      markFeatureEffectRiderUsed(actor, rider);
    }
  }
}

export function collectFeatureEffectRiders(source, target, action, options = {}) {
  const trigger = options.trigger || "source_hits_with_attack_roll";
  return [
    ...featureRiders(source, trigger),
    ...activeEffectRiders(source, trigger),
  ].filter((rider) => effectRiderMatches(source, target, action, rider, { ...options, trigger }));
}

export function markFeatureEffectRiderUsed(source, rider) {
  if (!source || !rider?.featureEffectRider) return;
  if (rider.oncePerTurn) {
    source.turnFlags ??= {};
    source.turnFlags.effectRiders ??= {};
    source.turnFlags.effectRiders[rider.id] = true;
  }
  if (rider.oncePerCombat) {
    source.combatFlags ??= {};
    source.combatFlags.effectRiders ??= {};
    source.combatFlags.effectRiders[rider.id] = true;
  }
  if (rider.resourceId) spendResourceUse(source, rider.resourceId);
}

function featureRiders(source, trigger) {
  return (source?.features || []).flatMap((feature) => [
    ...(feature.effects?.conditionRiders || []).map((rider) => normalizeRider(feature, rider, "condition", trigger)),
    ...(feature.effects?.modifierRiders || []).map((rider) => normalizeRider(feature, rider, "modifier", trigger)),
    ...(feature.effects?.healingRiders || []).map((rider) => normalizeRider(feature, rider, "healing", trigger)),
  ]);
}

function activeEffectRiders(source, trigger) {
  return (source?.activeEffects || []).flatMap((effect) => [
    ...(effect.conditionRiders || []).map((rider) => normalizeRider(effect, rider, "condition", trigger)),
    ...(effect.modifierRiders || []).map((rider) => normalizeRider(effect, rider, "modifier", trigger)),
    ...(effect.healingRiders || []).map((rider) => normalizeRider(effect, rider, "healing", trigger)),
  ]);
}

function applyFeatureHealingRider(snapshot, actor, action, rider, dice, log) {
  const receiver = selectHealingReceiver(snapshot, actor, rider);
  if (!receiver || receiver.hp >= receiver.maxHp || isHealingBlockedByCombatObject(snapshot, receiver)) return;
  const amount = resolveHealingAmount(actor, rider, dice);
  const hpBefore = receiver.hp;
  receiver.hp = Math.min(receiver.maxHp, receiver.hp + Math.max(0, amount));
  log.add("healing.applied", {
    round: snapshot.round,
    actorId: receiver.id,
    actorName: receiver.name,
    sourceId: actor.id,
    sourceName: actor.name,
    label: rider.name || action.name,
    amount: receiver.hp - hpBefore,
    hpBefore,
    hpAfter: receiver.hp,
    remaining: null,
  });
}

function selectHealingReceiver(snapshot, actor, rider) {
  const range = Number.isFinite(rider.rangeSquares) ? rider.rangeSquares : Math.ceil((rider.rangeFt || 0) / 5);
  const candidates = (snapshot.actors || [])
    .filter((candidate) => candidate.team === actor.team && candidate.hp > 0 && candidate.hp < candidate.maxHp)
    .filter((candidate) => !isHealingBlockedByCombatObject(snapshot, candidate))
    .filter((candidate) => distance(actor.position, candidate.position) <= range);
  candidates.sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp));
  return candidates[0] || null;
}

function resolveHealingAmount(actor, rider, dice) {
  if (Number.isFinite(rider.amount)) return rider.amount;
  if (rider.amountFormula === "charisma_modifier") return actor.abilityMods?.cha || 0;
  if (rider.amountFormula === "wisdom_modifier") return actor.abilityMods?.wis || 0;
  if (rider.healing && dice?.rollDamage) return dice.rollDamage(rider.healing).total;
  return 0;
}

function normalizeRider(owner, rider, type, trigger) {
  return {
    ...rider,
    type,
    id: rider.id || `${owner.id}_${type}_rider`,
    name: rider.name || owner.name || owner.label || owner.id,
    trigger: rider.trigger || trigger,
    featureId: owner.id,
    featureName: owner.name || owner.label || owner.id,
    featureEffectRider: true,
  };
}

function effectRiderMatches(source, target, action, rider, options) {
  if (!rider || rider.trigger !== options.trigger) return false;
  if (rider.oncePerTurn && source?.turnFlags?.effectRiders?.[rider.id]) return false;
  if (rider.oncePerCombat && source?.combatFlags?.effectRiders?.[rider.id]) return false;
  if (rider.resourceId && getResourceUses(source, rider.resourceId) <= 0) return false;
  if (rider.requiresSourceCondition && !(source?.conditions || []).some((condition) => condition.id === rider.requiresSourceCondition)) return false;
  if (Array.isArray(rider.actionIds) && !rider.actionIds.includes(action?.id)) return false;
  if (Array.isArray(rider.actionTypes) && !rider.actionTypes.includes(action?.type)) return false;
  if (Array.isArray(rider.actionTags) && !matchesActionTags(action, rider.actionTags)) return false;
  if (Array.isArray(rider.damageTypes) && !rider.damageTypes.includes(action?.damageType)) return false;
  if (rider.targetHpBelowFraction != null && !targetHpBelowFraction(target, rider.targetHpBelowFraction)) return false;
  return true;
}

function matchesActionTags(action, requiredTags) {
  const tags = getActionTags(action);
  return requiredTags.every((tag) => tags[tag] === true);
}

function targetHpBelowFraction(target, fraction) {
  if (!target || !Number.isFinite(target.hp) || !Number.isFinite(target.maxHp) || target.maxHp <= 0) return false;
  return target.hp / target.maxHp <= fraction;
}

function getResourceUses(actor, resourceId) {
  const resource = (actor?.resources || []).find((item) => item.id === resourceId);
  return resource?.current ?? resource?.max ?? 0;
}

function applyFeatureConditionRider(snapshot, actor, target, action, rider, log) {
  const receiver = rider.target === "self" ? actor : target;
  const effect = normalizeEffect({
    type: "condition",
    trigger: "hit",
    condition: rider.condition,
    duration: rider.duration,
    repeatSave: rider.repeatSave,
    noSave: !rider.save,
    skipDefeated: rider.skipDefeated,
  });
  const added = addCondition(receiver, createConditionInstance(effect, actor, riderActionFor(action, rider)));
  log.add("condition.applied", {
    round: snapshot.round,
    sourceId: actor.id,
    sourceName: actor.name,
    targetId: receiver.id,
    targetName: receiver.name,
    condition: rider.condition,
    label: conditionName(rider.condition),
    actionName: rider.name,
    noSave: !rider.save,
    alreadyPresent: !added,
  });
}

function applyFeatureModifierRider(snapshot, actor, target, action, rider, log) {
  const receiver = rider.target === "self" ? actor : target;
  const id = `${rider.id}_${receiver.id}`;
  const added = addActiveEffect(receiver, {
    ...rider,
    id,
    label: rider.name,
    type: "modifier",
    trigger: "passive",
    sourceActionId: action.id,
    sourceActorId: actor.id,
  });
  log.add("effect.applied", {
    round: snapshot.round,
    sourceId: actor.id,
    sourceName: actor.name,
    targetId: receiver.id,
    targetName: receiver.name,
    actionName: rider.name,
    effectId: id,
    stat: rider.stat,
    amount: rider.amount,
    die: rider.die,
    alreadyPresent: !added,
  });
}

function riderActionFor(action, rider) {
  return {
    ...action,
    id: rider.id,
    name: rider.name,
    spellSaveDC: rider.save?.dc || action.spellSaveDC || 10,
  };
}
