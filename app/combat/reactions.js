import {
  hasReaction,
  spendReaction,
  spendResourceUse,
} from "./actor.js";
import { livingActors } from "./combatState.js";
import { distance } from "./grid.js";
import { resolveRiderDamageFormula } from "./damageRiders.js";
import { addActiveEffect } from "./modifiers.js";
import { isReactionPolicyRelevant, normalizeReactionPolicy } from "./reactionPolicy.js";
import { lowestAvailableSpellSlot, spendSpellSlot } from "./spellSlots.js";

const REACTION_PRIORITY = {
  survival: 100,
  crit_prevention: 90,
  hit_prevention: 80,
  miss_conversion: 70,
  damage_reduction: 60,
  retaliation: 40,
  rider: 20,
};

export class PendingReactionPrompt extends Error {
  constructor(prompt) {
    super(`Pending reaction: ${prompt?.name || "reaction"}`);
    this.name = "PendingReactionPrompt";
    this.prompt = prompt;
  }
}

export function isPendingReactionPrompt(error) {
  return error instanceof PendingReactionPrompt || error?.name === "PendingReactionPrompt";
}

export function resolveDamageReactionAdjustment(snapshot, context, dice, log) {
  if (!dice || !context?.target || context.amount <= 0) return context.amount;
  let amount = context.amount;
  const reaction = chooseAutomaticReaction(context.target, "takes_damage", context, (item) => item.damageReduction);
  if (!reaction) return amount;
  spendReactionUse(snapshot, context.target, reaction, log);
  const formula = resolveRiderDamageFormula(context.target, reaction.damageReduction);
  const rolled = dice.rollDamage(formula);
  const reduction = Math.max(0, rolled.total || 0);
  amount = Math.max(0, amount - reduction);
  log.add("reaction.resolve", reactionDetail(snapshot, context.target, reaction, {
    targetId: context.target.id,
    targetName: context.target.name,
    amount: reduction,
    dice: formula,
    rolls: rolled.rolls || [],
    result: `damage reduced to ${amount}`,
  }));
  return amount;
}

export function resolveSourceMissReactionAdjustment(snapshot, context, log) {
  if (!context?.source || context.hit || context.total >= context.effectiveAc) return context;
  const reaction = chooseAutomaticReaction(context.source, "source_misses_attack", context, (item) => {
    if (!Number.isFinite(item.attackRollBonus) || item.retryHitCheck !== true) return false;
    return context.total + item.attackRollBonus >= context.effectiveAc;
  });
  if (!reaction) return context;
  const adjustedTotal = context.total + reaction.attackRollBonus;
  spendReactionUse(snapshot, context.source, reaction, log);
  log.add("reaction.resolve", reactionDetail(snapshot, context.source, reaction, {
    targetId: context.target.id,
    targetName: context.target.name,
    attackRollBonus: reaction.attackRollBonus,
    originalTotal: context.total,
    adjustedTotal,
    result: "miss converted to hit",
  }));
  return { ...context, total: adjustedTotal, hit: true };
}

export function resolveCriticalReactionAdjustment(snapshot, context, log) {
  if (!context?.critical || !context?.target) return context.critical;
  const candidate = livingActors(snapshot)
    .filter((actor) => actor.id !== context.target.id && actor.team === context.target.team)
    .map((actor) => ({
      actor,
      reaction: chooseAutomaticReaction(actor, "ally_would_take_critical_hit", { ...context, target: context.target }, (item) => item.suppressCritical === true),
    }))
    .filter(({ reaction }) => reaction)
    .sort(compareReactionCandidates)[0];
  if (!candidate) return context.critical;

  spendReactionUse(snapshot, candidate.actor, candidate.reaction, log);
  log.add("reaction.resolve", reactionDetail(snapshot, candidate.actor, candidate.reaction, {
    targetId: context.target.id,
    targetName: context.target.name,
    sourceId: context.source?.id,
    sourceName: context.source?.name,
    result: "critical suppressed",
  }));
  return false;
}

export function resolveZeroHpReactionAdjustment(snapshot, context, log) {
  if (!context?.target || context.amount <= 0) return context.amount;
  const projectedHp = context.hpBefore - Math.max(0, context.amount - context.tempHpBefore);
  if (projectedHp > 0) return context.amount;
  for (const trigger of ["would_drop_to_zero", "would_drop_to_0_hp"]) {
    const reaction = chooseAutomaticReaction(context.target, trigger, context, (item) => Number.isFinite(reactionLeaveAtHp(item)));
    if (!reaction) continue;
    const leaveAtHp = reactionLeaveAtHp(reaction);
    spendReactionUse(snapshot, context.target, reaction, log);
    const restoredSlotLevel = restoreHighestExpendedSpellSlot(context.target, reaction.restoreSlotMaxLevel);
    const adjustedAmount = Math.max(0, context.tempHpBefore + context.hpBefore - leaveAtHp);
    log.add("reaction.resolve", reactionDetail(snapshot, context.target, reaction, {
      sourceId: context.source?.id,
      sourceName: context.source?.name,
      originalAmount: context.amount,
      adjustedAmount,
      restoredSlotLevel,
      result: `damage adjusted to leave ${leaveAtHp} HP`,
    }));
    return adjustedAmount;
  }
  return context.amount;
}

export function resolveIncomingHitReactionAdjustment(snapshot, context, log) {
  if (!context?.target || !context.hit || context.roll === 20) return context;
  const prompt = choosePromptedHitReaction(snapshot, context.target, context);
  if (!prompt) return context;
  const decision = reactionPromptDecision(snapshot, prompt);

  if (decision === undefined) {
    log.add("reaction.prompt", {
      round: snapshot.round,
      actorId: context.target.id,
      actorName: context.target.name,
      reactionId: prompt.id,
      reactionName: prompt.name,
      sourceId: context.source?.id,
      sourceName: context.source?.name,
      cost: prompt.cost,
      preview: prompt.preview,
      acceptLabel: prompt.acceptLabel,
      declineLabel: prompt.declineLabel,
    });
    throw new PendingReactionPrompt(prompt);
  }

  if (!snapshot.suppressReactionPromptLog) {
    log.add("reaction.prompt", {
      round: snapshot.round,
      actorId: context.target.id,
      actorName: context.target.name,
      reactionId: prompt.id,
      reactionName: prompt.name,
      sourceId: context.source?.id,
      sourceName: context.source?.name,
      cost: prompt.cost,
      preview: prompt.preview,
      acceptLabel: prompt.acceptLabel,
      declineLabel: prompt.declineLabel,
    });
  }
  delete snapshot.suppressReactionPromptLog;

  if (decision !== true) {
    log.add("reaction.decline", {
      round: snapshot.round,
      actorId: context.target.id,
      actorName: context.target.name,
      reactionId: prompt.id,
      reactionName: prompt.name,
    });
    return context;
  }

  if (!spendPromptReactionCost(context.target, prompt.cost)) {
    log.add("reaction.decline", {
      round: snapshot.round,
      actorId: context.target.id,
      actorName: context.target.name,
      reactionId: prompt.id,
      reactionName: prompt.name,
      reason: "cost unavailable",
    });
    return context;
  }

  spendReaction(context.target);
  applyPromptedReactionEffect(context.target, prompt);
  log.add("reaction.resolve", reactionDetail(snapshot, context.target, prompt, {
    sourceId: context.source?.id,
    sourceName: context.source?.name,
    result: "hit prevented",
    cost: prompt.cost,
  }));
  return { ...context, hit: false, shielded: true };
}

export function resolveReactionTriggers(snapshot, trigger, context, dice, log, handlers = {}) {
  if (!dice || !context?.target) return;
  const reaction = chooseAutomaticReaction(context.target, trigger, context, (item) => reactionTarget(snapshot, item, context));
  if (!reaction) return;
  const suppressed = matchingReactions(context.target, trigger, context)
    .filter((item) => item.id !== reaction.id && reactionMode(item) === "automatic");
  const target = reactionTarget(snapshot, reaction, context);
  if (!target) return;
  spendReactionUse(snapshot, context.target, reaction, log);

  if (reaction.actionKind === "basic_melee_attack" && handlers.resolveAttack) {
    const action = basicMeleeAttack(context.target);
    if (!action) return;
    log.add("reaction.resolve", reactionDetail(snapshot, context.target, reaction, {
      targetId: target.id,
      targetName: target.name,
      actionName: action.name,
    }));
    handlers.resolveAttack(snapshot, context.target, target, action, dice, log);
    logSuppressedReactions(snapshot, context.target, suppressed, reaction, log);
    return;
  }

  if (reaction.damage && handlers.applyDamageAmount) {
    const damage = resolveRiderDamageFormula(context.target, reaction.damage);
    const rolled = dice.rollDamage(damage);
    const amount = Math.max(0, rolled.total || 0);
    log.add("reaction.resolve", reactionDetail(snapshot, context.target, reaction, {
      targetId: target.id,
      targetName: target.name,
      amount,
      dice: damage,
      rolls: rolled.rolls || [],
    }));
    handlers.applyDamageAmount(snapshot, context.target, target, {
      id: reaction.id,
      name: reaction.name,
      damage,
      damageType: reaction.damageType || "untyped",
      reactionFeature: true,
    }, rolled, amount, dice, log);
  }
  logSuppressedReactions(snapshot, context.target, suppressed, reaction, log);
}

function matchingReactions(actor, trigger, context) {
  if (!hasReaction(actor)) return [];
  return reactionDefinitions(actor)
    .filter((reaction) => reaction.trigger === trigger)
    .filter((reaction) => hasReactionResource(actor, reaction))
    .filter((reaction) => reactionMatchesRange(actor, reaction, context))
    .filter((reaction) => reactionMatchesAction(reaction, context.action))
    .filter((reaction) => reactionMatchesCounters(actor, reaction, context))
    .sort(compareReactionPriority);
}

function reactionDefinitions(actor) {
  return (actor?.features || []).flatMap((feature) => [
    ...(feature.effects?.reactions || []),
    ...(feature.effects?.triggeredEffects || []).filter((effect) => effect.reaction === true),
  ].map((reaction) => ({
    ...reaction,
    id: reaction.id || `${feature.id}_reaction`,
    name: reaction.name || feature.name,
    featureId: feature.id,
    featureName: feature.name,
    reactionMode: reaction.reactionMode || "automatic",
    priority: reaction.priority ?? defaultReactionPriority(reaction),
  })));
}

function hasReactionResource(actor, reaction) {
  const resourceId = reaction.resourceId || reaction.id;
  const resource = (actor.resources || []).find((item) => item.id === resourceId);
  if (!resource) return true;
  return (resource.current ?? resource.max ?? 0) > 0;
}

function reactionMatchesRange(actor, reaction, context) {
  if (!Number.isFinite(reaction.rangeFt)) return true;
  const rangeTargetMode = reaction.trigger === "ally_would_take_critical_hit"
    ? "target"
    : reaction.target || "trigger_source";
  const target = reactionTargetFromContext(context, rangeTargetMode);
  if (!target) return false;
  return distance(actor.position, target.position) <= Math.ceil(reaction.rangeFt / 5);
}

function reactionMatchesAction(reaction, action) {
  if (!action) return true;
  if (reaction.meleeOnly && !(action.tags?.melee === true || action.range <= 1)) return false;
  if (Array.isArray(reaction.actionTypes) && !reaction.actionTypes.includes(action.type)) return false;
  return true;
}

function reactionMatchesCounters(actor, reaction) {
  if (Number.isFinite(reaction.minimumHitsTakenSinceLastTurn)) {
    const hits = actor.turnFlags?.hitsTakenSinceLastTurn || 0;
    if (hits < reaction.minimumHitsTakenSinceLastTurn) return false;
  }
  return true;
}

function chooseAutomaticReaction(actor, trigger, context, predicate = () => true) {
  return matchingReactions(actor, trigger, context)
    .filter((reaction) => reactionMode(reaction) === "automatic")
    .find(predicate) || null;
}

function choosePromptedHitReaction(snapshot, actor, context) {
  if (!hasReaction(actor)) return null;
  const candidates = (actor.actions || [])
    .map((action) => promptedHitReactionCandidate(actor, action, context))
    .filter(Boolean)
    .sort(compareReactionPriority);
  return candidates[0] || null;
}

function promptedHitReactionCandidate(actor, action, context) {
  const policy = normalizeReactionPolicy(action?.reactionPolicy);
  if (!policy || policy.trigger !== "would_be_hit_by_attack" || policy.reactionMode !== "prompt") return null;
  if (policy.effect?.preventsTriggeringHit !== true) return null;
  if (policy.effect?.kind !== "ac_bonus") return null;
  if (!isReactionPolicyRelevant(policy, context)) return null;
  const cost = resolvePromptReactionCost(actor, policy);
  if (!cost) return null;
  const name = action.name || policy.id;
  return {
    id: policy.id,
    actorId: actor.id,
    name,
    reactionMode: "prompt",
    priority: policy.priority ?? REACTION_PRIORITY.hit_prevention,
    cost,
    effect: policy.effect,
    preview: `${context.source?.name || "Attacker"} is going to hit ${actor.name}.`,
    acceptLabel: promptAcceptLabel(name, cost),
    declineLabel: "Take Hit",
  };
}

function reactionPromptDecision(snapshot, prompt) {
  const decisions = snapshot.reactionDecisions || {};
  if (Object.hasOwn(decisions, `${prompt.actorId}:${prompt.id}`)) return decisions[`${prompt.actorId}:${prompt.id}`];
  if (Object.hasOwn(decisions, prompt.id)) return decisions[prompt.id];
  return undefined;
}

function applyPromptedReactionEffect(actor, prompt) {
  if (prompt.effect?.kind !== "ac_bonus") return;
  addActiveEffect(actor, {
    id: `${prompt.id}_reaction`,
    label: prompt.name,
    type: "modifier",
    stat: "ac",
    amount: prompt.effect.amount || 0,
    duration: prompt.effect.duration || "turn_start",
  });
}

function resolvePromptReactionCost(actor, policy) {
  if (!policy.cost || policy.cost.type === "none") return { type: "none" };
  if (policy.cost.type !== "spell_slot") return null;
  if (policy.cost.policy !== "lowest_available") return null;
  const slotLevel = lowestAvailableSpellSlot(actor, policy.cost.minimumLevel || 1);
  return slotLevel ? { type: "spell_slot", level: slotLevel } : null;
}

function spendPromptReactionCost(actor, cost) {
  if (!cost || cost.type === "none") return true;
  if (cost.type === "spell_slot") return spendSpellSlot(actor, cost.level);
  return false;
}

function promptAcceptLabel(name, cost) {
  if (cost?.type === "spell_slot") return `${name} (${cost.level})`;
  return name;
}

function reactionTarget(snapshot, reaction, context) {
  return reactionTargetFromContext(context, reaction.target || "trigger_source");
}

function reactionTargetFromContext(context, targetMode) {
  if (["damage_source", "trigger_source", "attacker"].includes(targetMode)) return context.source;
  if (["self", "target"].includes(targetMode)) return context.target;
  return context.source;
}

function basicMeleeAttack(actor) {
  return (actor.actions || []).find((action) =>
    action.range === 1 &&
    (action.tags?.melee === true || action.type === "weapon_attack" || action.type === "melee_attack")
  ) || null;
}

function spendReactionUse(snapshot, actor, reaction, log) {
  spendReaction(actor);
  spendResourceUse(actor, reaction.resourceId || reaction.id);
  log.add("reaction.spend", {
    round: snapshot.round,
    actorId: actor.id,
    actorName: actor.name,
    reactionAvailable: false,
    reason: reaction.name,
  });
}

function logSuppressedReactions(snapshot, actor, suppressed, usedReaction, log) {
  for (const reaction of suppressed) {
    log.add("reaction.suppressed", reactionDetail(snapshot, actor, reaction, {
      reason: `reaction already spent by ${usedReaction.name}`,
      usedReactionId: usedReaction.id,
      usedReactionName: usedReaction.name,
    }));
  }
}

function reactionDetail(snapshot, actor, reaction, extra = {}) {
  return {
    round: snapshot.round,
    actorId: actor.id,
    actorName: actor.name,
    reactionId: reaction.id,
    reactionName: reaction.name,
    ...extra,
  };
}

function reactionLeaveAtHp(reaction) {
  if (Number.isFinite(reaction.leaveAtHp)) return reaction.leaveAtHp;
  if (reaction.outcome === "drop_to_1_hp") return 1;
  return null;
}

function reactionMode(reaction) {
  return reaction.reactionMode || "automatic";
}

function defaultReactionPriority(reaction) {
  if (reaction.leaveAtHp || reaction.outcome === "drop_to_1_hp") return REACTION_PRIORITY.survival;
  if (reaction.suppressCritical) return REACTION_PRIORITY.crit_prevention;
  if (reaction.attackRollBonus || reaction.retryHitCheck) return REACTION_PRIORITY.miss_conversion;
  if (reaction.damageReduction) return REACTION_PRIORITY.damage_reduction;
  if (reaction.damage || reaction.actionKind) return REACTION_PRIORITY.retaliation;
  return REACTION_PRIORITY.rider;
}

function compareReactionPriority(a, b) {
  return (b.priority || 0) - (a.priority || 0) || String(a.id).localeCompare(String(b.id));
}

function compareReactionCandidates(a, b) {
  return compareReactionPriority(a.reaction, b.reaction)
    || String(a.actor.id).localeCompare(String(b.actor.id));
}

function restoreHighestExpendedSpellSlot(actor, maximumLevel) {
  if (!Number.isFinite(maximumLevel)) return null;
  const slots = actor?.spellSlots || actor?.spellcasting?.slots || {};
  const levels = Object.keys(slots)
    .map(Number)
    .filter((level) => Number.isFinite(level) && level <= maximumLevel)
    .sort((a, b) => b - a);
  for (const level of levels) {
    const slot = slots[level] ?? slots[String(level)];
    if (Number.isFinite(slot)) continue;
    if (!slot || typeof slot !== "object") continue;
    if (Number.isFinite(slot.current) && Number.isFinite(slot.max) && slot.current < slot.max) {
      slot.current += 1;
      return level;
    }
    if (Number.isFinite(slot.remaining) && Number.isFinite(slot.max) && slot.remaining < slot.max) {
      slot.remaining += 1;
      return level;
    }
    if (Number.isFinite(slot.used) && slot.used > 0) {
      slot.used -= 1;
      return level;
    }
  }
  return null;
}
