export function createFeatureActionsFromFeatures(features = [], context = {}) {
  return features
    .flatMap((feature) => featureActionOptions(feature).map((option) => createFeatureAction(feature, option, context)))
    .filter(Boolean);
}

export function createFeatureAction(feature, option, context = {}) {
  const resource = option.resourceId
    ? (context.resources || []).find((item) => item.id === option.resourceId)
    : null;
  const base = {
    id: option.id,
    name: option.name || feature.name,
    cost: actionTypeToCost(option.actionType),
    requiresTarget: option.requiresTarget === true,
    resourceId: option.resourceId || null,
    uses: resource ? { max: resource.max, remaining: resource.current ?? resource.max, recovery: resource.recovery } : null,
    description: option.description || feature.description || "",
    tags: {
      feature: true,
      harmful: option.harmful === true || option.targetFilter?.team === "enemies" || Boolean(option.damage || option.damageByTargetProperty),
    },
  };
  if (option.healingFormula) {
    return {
      ...base,
      type: "self_heal",
      requiresTarget: false,
      healing: resolveFormula(option.healingFormula, context),
    };
  }
  if (option.actionKind === "dash") return { ...base, type: "dash", requiresTarget: false };
  if (option.actionKind === "dodge") return { ...base, type: "dodge", requiresTarget: false };
  if (option.actionKind === "push") {
    return {
      ...base,
      type: "push",
      requiresTarget: true,
      range: feetToSquares(option.rangeFt ?? option.range ?? 5),
      distanceSquares: feetToSquares(option.distanceFt ?? option.distance ?? 5),
      collisionDamage: option.collisionDamage || "1d4",
      collisionDamageType: option.collisionDamageType || "bludgeoning",
      requirement: structuredClone(option.requirement || option.requirements || null),
    };
  }
  return {
    ...base,
    type: "feature_action",
    range: feetToSquares(option.rangeFt ?? option.range ?? 0),
    saveAbility: normalizeAbility(option.save?.ability || option.saveAbility),
    spellSaveDC: resolveFeatureSaveDc(option, context),
    damage: resolveFormula(option.damage?.dice || option.damage, context),
    damageType: option.damage?.type || option.damageType || null,
    damageByTargetProperty: structuredClone(option.damageByTargetProperty || null),
    targeting: structuredClone(option.targeting || null),
    targetFilter: structuredClone(option.targetFilter || null),
    save: structuredClone(option.save || null),
    economyGrant: structuredClone(option.economyGrant || null),
    mark: structuredClone(option.mark || null),
    object: structuredClone(option.createsCombatObject || option.object || null),
    effects: structuredClone(option.effects || []),
  };
}

function featureActionOptions(feature) {
  return [
    ...(feature.effects?.actionOptions || []),
    ...(feature.grants?.actionOptions || []),
  ];
}

function actionTypeToCost(actionType) {
  if (actionType === "free" || actionType === "special") return "free";
  if (actionType === "bonus_action" || actionType === "bonus") return "bonus";
  if (actionType === "reaction") return "reaction";
  return "action";
}

function resolveFormula(formula, context) {
  if (!formula) return null;
  if (typeof context.resolveFormula === "function") return context.resolveFormula(formula);
  return String(formula).replace(/\s+/g, "");
}

function resolveFeatureSaveDc(option, context) {
  if (typeof context.resolveSaveDc === "function") return context.resolveSaveDc(option);
  return option.save?.dc || option.spellSaveDC || null;
}

function normalizeAbility(ability) {
  return ability ? String(ability).toLowerCase().slice(0, 3) : null;
}

function feetToSquares(feet) {
  return Math.max(0, Math.ceil((Number(feet) || 0) / 5));
}
