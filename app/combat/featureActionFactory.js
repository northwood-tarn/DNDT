export function createFeatureActionsFromFeatures(features = [], context = {}) {
  return features
    .flatMap((feature) => featureActionOptions(feature).map((option) => createFeatureAction(feature, option, context)))
    .filter(Boolean);
}

export function createFeatureAction(feature, option, context = {}) {
  const resolvedOption = resolveContextualOption(option, context);
  const resourceId = resolvedOption.resourceId || inferredResourceId(resolvedOption, context);
  const resource = resourceId
    ? (context.resources || []).find((item) => item.id === resourceId)
    : null;
  const base = {
    id: resolvedOption.id,
    iconId: resolvedOption.iconId || null,
    name: resolvedOption.name || feature.name,
    cost: actionTypeToCost(resolvedOption.actionType),
    requiresTarget: resolvedOption.requiresTarget === true,
    resourceId,
    uses: resource ? { max: resource.max, remaining: resource.current ?? resource.max, recovery: resource.recovery } : null,
    description: resolvedOption.description || feature.description || "",
    choiceParentResourceId: resolvedOption.choiceParentResourceId || null,
    choiceParentName: resolvedOption.choiceParentName || null,
    choiceParentDescription: resolvedOption.choiceParentDescription || null,
    choiceLabel: resolvedOption.choiceLabel || null,
    secondaryChoice: resolvedOption.secondaryChoice ? structuredClone(resolvedOption.secondaryChoice) : null,
    tags: {
      feature: true,
      harmful: resolvedOption.harmful === true || resolvedOption.targetFilter?.team === "enemies" || Boolean(resolvedOption.damage || resolvedOption.damageByTargetProperty),
      ...(Array.isArray(resolvedOption.tags) ? Object.fromEntries(resolvedOption.tags.map((tag) => [tag, true])) : {}),
      ...(resolvedOption.tags && !Array.isArray(resolvedOption.tags) && typeof resolvedOption.tags === "object" ? resolvedOption.tags : {}),
    },
  };
  if (resolvedOption.healingFormula) {
    return {
      ...base,
      type: "self_heal",
      requiresTarget: false,
      healing: resolveFormula(resolvedOption.healingFormula, context),
    };
  }
  if (resolvedOption.actionKind === "dash") return { ...base, type: "dash", requiresTarget: false };
  if (resolvedOption.actionKind === "dodge") return { ...base, type: "dodge", requiresTarget: false };
  if (resolvedOption.actionKind === "disengage") return { ...base, type: "feature_action", actionKind: "disengage", requiresTarget: false };
  if (resolvedOption.actionKind === "hide") return { ...base, type: "feature_action", actionKind: "hide", requiresTarget: false };
  if (resolvedOption.teleportFt && !(resolvedOption.createsCombatObject || resolvedOption.object)) {
    return {
      ...base,
      type: "spell_teleport",
      requiresTarget: true,
      range: feetToSquares(resolvedOption.teleportFt),
      requiresSight: resolvedOption.requiresSight === true,
      targeting: {
        shape: "radius",
        radiusSquares: feetToSquares(resolvedOption.teleportFt),
        radiusFt: resolvedOption.teleportFt,
      },
    };
  }
  if (resolvedOption.actionKind === "push") {
    return {
      ...base,
      type: "push",
      requiresTarget: true,
      range: feetToSquares(resolvedOption.rangeFt ?? resolvedOption.range ?? 5),
      distanceSquares: feetToSquares(resolvedOption.distanceFt ?? resolvedOption.distance ?? 5),
      collisionDamage: resolvedOption.collisionDamage || "1d4",
      collisionDamageType: resolvedOption.collisionDamageType || "bludgeoning",
      saveAbility: normalizeAbility(resolvedOption.save?.ability || resolvedOption.saveAbility),
      spellSaveDC: resolveFeatureSaveDc(resolvedOption, context),
      requirement: structuredClone(resolvedOption.requirement || resolvedOption.requirements || null),
    };
  }
  return {
    ...base,
    type: "feature_action",
    actionKind: resolvedOption.actionKind || null,
    requiresTarget: resolvedOption.actionKind === "basic_weapon_attack" || resolvedOption.targeting?.shape ? true : base.requiresTarget,
    range: feetToSquares(resolvedOption.rangeFt ?? resolvedOption.range ?? 0),
    saveAbility: normalizeAbility(resolvedOption.save?.ability || resolvedOption.saveAbility),
    spellSaveDC: resolveFeatureSaveDc(resolvedOption, context),
    damage: resolveDamage(resolvedOption, context),
    damageType: resolvedOption.damage?.type || resolvedOption.damageType || null,
    damageTypeChoices: structuredClone(resolvedOption.damageTypeChoices || null),
    reactionPolicy: structuredClone(resolvedOption.reactionPolicy || null),
    requirement: structuredClone(resolvedOption.requirement || resolvedOption.requirements || null),
    teleportFt: resolvedOption.teleportFt || null,
    requiresSight: resolvedOption.requiresSight === true,
    temporaryHpFormula: resolvedOption.temporaryHpFormula ? resolveFormula(resolvedOption.temporaryHpFormula, context) : null,
    grantsDash: resolvedOption.grantsDash === true,
    pactWeaponDamageBonus: structuredClone(resolvedOption.pactWeaponDamageBonus || null),
    activeEffectOnResolve: structuredClone(resolvedOption.activeEffectOnResolve || null),
    selfCondition: structuredClone(resolvedOption.selfCondition || null),
    damageByTargetProperty: resolveDamageByTargetProperty(resolvedOption.damageByTargetProperty, context),
    targeting: structuredClone(resolvedOption.targeting || null),
    selfCenteredArea: resolvedOption.targeting?.mode === "nearby_actors" || null,
    targetFilter: structuredClone(resolvedOption.targetFilter || null),
    save: structuredClone(resolvedOption.save || null),
    duration: structuredClone(resolvedOption.duration || null),
    deviceEffect: structuredClone(resolvedOption.deviceEffect || null),
    economyGrant: structuredClone(resolvedOption.economyGrant || null),
    resourceRestore: structuredClone(resolvedOption.resourceRestore || null),
    additionalResourceIds: structuredClone(resolvedOption.additionalResourceIds || []),
    deviceRig: structuredClone(resolvedOption.deviceRig || null),
    repeatResolutionCount: Math.max(1, Number(resolvedOption.repeatResolutionCount) || 1),
    restoresResource: resolvedOption.restoresResource || null,
    amount: resolvedOption.amount || null,
    mark: structuredClone(resolvedOption.mark || null),
    object: structuredClone(resolvedOption.createsCombatObject || resolvedOption.object || null),
    effects: structuredClone(resolvedOption.effects || []),
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

function resolveContextualOption(option, context) {
  const variants = option.variantsByLineage?.[context.lineageId] || option.variantsBySpecies?.[context.speciesId] || null;
  if (!variants) return option;
  return mergeOption(option, variants);
}

function mergeOption(base, variant) {
  const merged = { ...base, ...variant };
  if (base.save || variant.save) merged.save = { ...(base.save || {}), ...(variant.save || {}) };
  if (base.targeting || variant.targeting) merged.targeting = { ...(base.targeting || {}), ...(variant.targeting || {}) };
  if (base.targetFilter || variant.targetFilter) merged.targetFilter = { ...(base.targetFilter || {}), ...(variant.targetFilter || {}) };
  if (base.tags || variant.tags) merged.tags = mergeTags(base.tags, variant.tags);
  if (base.effects || variant.effects) merged.effects = [...(base.effects || []), ...(variant.effects || [])];
  return merged;
}

function mergeTags(base, variant) {
  if (Array.isArray(base) || Array.isArray(variant)) return [...(base || []), ...(variant || [])];
  return { ...(base || {}), ...(variant || {}) };
}

function inferredResourceId(option, context) {
  return (context.resources || []).some((resource) => resource.id === option.id) ? option.id : null;
}

function resolveDamage(option, context) {
  const dice = option.damage?.dice || option.damage;
  const base = resolveFormula(dice, context);
  const additions = (option.damageScaling || [])
    .filter((entry) => !Number.isFinite(entry.minLevel) || (context.level || 1) >= entry.minLevel)
    .map((entry) => resolveFormula(entry.add, context))
    .filter(Boolean);
  return [base, ...additions].filter(Boolean).join("+") || null;
}

function resolveDamageByTargetProperty(payload, context) {
  if (!payload) return null;
  const bonusDice = (payload.scaling || [])
    .filter((entry) => !Number.isFinite(entry.minLevel) || (context.level || 1) >= entry.minLevel)
    .reduce((total, entry) => total + (Number(entry.addDice) || 0), 0);
  const addDice = (formula) => String(formula || "").replace(/^(\d+)d(\d+)$/i, (_match, count, sides) => `${Number(count) + bonusDice}d${sides}`);
  return {
    ...structuredClone(payload),
    default: addDice(payload.default),
    values: Object.fromEntries(Object.entries(payload.values || {}).map(([key, formula]) => [key, addDice(formula)])),
  };
}

function normalizeAbility(ability) {
  return ability ? String(ability).toLowerCase().slice(0, 3) : null;
}

function feetToSquares(feet) {
  return Math.max(0, Math.ceil((Number(feet) || 0) / 5));
}
