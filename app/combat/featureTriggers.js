export function hasCriticalHitTrigger(source, target, trigger) {
  return collectFeatureTriggers(source, trigger)
    .some((effect) => effect.criticalHit === true && triggerRequirementsMet(source, target, effect, trigger));
}

export function collectMatchedFeatureTriggers(source, target, trigger) {
  return collectFeatureTriggers(source, trigger)
    .filter((effect) => triggerRequirementsMet(source, target, effect, trigger))
    .filter((effect) => !triggerAlreadyUsed(source, effect));
}

export function markFeatureTriggerUsed(source, effect) {
  if (!source || !effect) return;
  if (effect.oncePerCombat || effect.limit) {
    source.combatFlags ??= {};
    source.combatFlags.triggeredEffects ??= {};
    source.combatFlags.triggeredEffects[effect.id] = true;
  }
}

export function grantTriggeredAction(snapshot, source, target, action, effect, log) {
  if (!effect.grantAction || effect.grantAction.kind !== "basic_melee_attack") return false;
  const base = (source.actions || []).find((item) =>
    item.range === 1 && (item.tags?.melee === true || item.type === "weapon_attack" || item.type === "melee_attack")
  );
  if (!base) return false;
  source.economy ??= {};
  if (effect.grantAction.actionType === "bonus_action") source.economy.bonusActionAvailable = true;
  const granted = {
    ...structuredClone(base),
    id: `triggered_${effect.id}`,
    name: effect.name || "Triggered Attack",
    cost: effect.grantAction.actionType === "bonus_action" ? "bonus" : "action",
    contextual: true,
    grantedByFeatureId: effect.featureId,
    excludedTargetId: target?.id || null,
  };
  source.actions = [...(source.actions || []).filter((item) => item.id !== granted.id), granted];
  markFeatureTriggerUsed(source, effect);
  log.add("action.granted", {
    round: snapshot.round,
    sourceId: source.id,
    sourceName: source.name,
    targetId: source.id,
    targetName: source.name,
    actionId: granted.id,
    actionName: granted.name,
    sourceActionId: action.id,
    featureId: effect.featureId,
  });
  return true;
}

function collectFeatureTriggers(source, trigger) {
  return (source?.features || []).flatMap((feature) =>
    (feature.effects?.triggeredEffects || [])
      .filter((effect) => effect.trigger === trigger)
      .map((effect) => ({
        ...effect,
        id: effect.id || `${feature.id}_${trigger}`,
        name: effect.name || feature.name,
        featureId: feature.id,
        featureName: feature.name,
      }))
  );
}

function triggerRequirementsMet(source, target, effect, trigger) {
  if (trigger === "source_hits_surprised_target" && !hasCondition(target, "surprised")) return false;
  if (effect.resourceId && getResourceUses(source, effect.resourceId) <= 0) return false;
  return true;
}

function triggerAlreadyUsed(source, effect) {
  return Boolean(source?.combatFlags?.triggeredEffects?.[effect.id]);
}

function hasCondition(actor, conditionId) {
  return (actor?.conditions || []).some((condition) => condition.id === conditionId);
}

function getResourceUses(actor, resourceId) {
  const resource = (actor?.resources || []).find((item) => item.id === resourceId);
  return resource?.current ?? resource?.max ?? 0;
}
