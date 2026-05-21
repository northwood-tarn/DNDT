import {
  hasReaction,
  spendReaction,
  spendResourceUse,
} from "./actor.js";
import { distance } from "./grid.js";
import { resolveRiderDamageFormula } from "./damageRiders.js";

export function resolveDamageReactionAdjustment(snapshot, context, dice, log) {
  if (!dice || !context?.target || context.amount <= 0) return context.amount;
  let amount = context.amount;
  for (const reaction of matchingReactions(context.target, "takes_damage", context)) {
    if (!reaction.damageReduction || amount <= 0) continue;
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
  }
  return amount;
}

export function resolveReactionTriggers(snapshot, trigger, context, dice, log, handlers = {}) {
  if (!dice || !context?.target) return;
  for (const reaction of matchingReactions(context.target, trigger, context)) {
    const target = reactionTarget(snapshot, reaction, context);
    if (!target) continue;
    spendReactionUse(snapshot, context.target, reaction, log);

    if (reaction.actionKind === "basic_melee_attack" && handlers.resolveAttack) {
      const action = basicMeleeAttack(context.target);
      if (!action) continue;
      log.add("reaction.resolve", reactionDetail(snapshot, context.target, reaction, {
        targetId: target.id,
        targetName: target.name,
        actionName: action.name,
      }));
      handlers.resolveAttack(snapshot, context.target, target, action, dice, log);
      continue;
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
  }
}

function matchingReactions(actor, trigger, context) {
  if (!hasReaction(actor)) return [];
  return reactionDefinitions(actor)
    .filter((reaction) => reaction.trigger === trigger)
    .filter((reaction) => hasReactionResource(actor, reaction))
    .filter((reaction) => reactionMatchesRange(actor, reaction, context))
    .filter((reaction) => reactionMatchesAction(reaction, context.action));
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
  const target = reactionTargetFromContext(context, reaction.target || "trigger_source");
  if (!target) return false;
  return distance(actor.position, target.position) <= Math.ceil(reaction.rangeFt / 5);
}

function reactionMatchesAction(reaction, action) {
  if (!action) return true;
  if (reaction.meleeOnly && !(action.tags?.melee === true || action.range <= 1)) return false;
  if (Array.isArray(reaction.actionTypes) && !reaction.actionTypes.includes(action.type)) return false;
  return true;
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
