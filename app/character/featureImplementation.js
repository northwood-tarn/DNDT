export function isDeclarativeFeatureImplemented(featureOrEffects = {}) {
  const effects = featureOrEffects.effects || featureOrEffects;
  return Boolean(
    (effects.resources || []).length ||
    (effects.expertise || []).length ||
    (effects.actionOptions || []).length ||
    (effects.choiceRequirements || []).length ||
    (effects.modifiers || []).length ||
    (effects.auras || []).length ||
    (effects.triggeredEffects || []).length ||
    (effects.reactions || []).length ||
    (effects.damageRiders || []).length ||
    (effects.conditionRiders || []).length ||
    (effects.modifierRiders || []).length ||
    (effects.healingRiders || []).length ||
    (effects.resistances || []).length ||
    (effects.narrativeTags || []).length ||
    (effects.advancement || []).length ||
    (effects.attackAction || []).length ||
    effects.narrativeOnly === true
  );
}
