export function isDeclarativeFeatureImplemented(featureOrEffects = {}) {
  const effects = featureOrEffects.effects || featureOrEffects;
  return Boolean(
    (featureOrEffects.choices || []).length ||
    (effects.resources || []).length ||
    (effects.expertise || []).length ||
    (effects.actionOptions || []).length ||
    (effects.choiceRequirements || []).length ||
    (effects.modifiers || []).length ||
    (effects.auras || []).length ||
    (effects.featureHooks || []).length ||
    (effects.senses || []).length ||
    (effects.spells || []).length ||
    (effects.spellGrants || []).length ||
    (effects.freeCastChoices || []).length ||
    (effects.triggeredEffects || []).length ||
    (effects.reactions || []).length ||
    (effects.damageRiders || []).length ||
    (effects.conditionRiders || []).length ||
    (effects.modifierRiders || []).length ||
    (effects.healingRiders || []).length ||
    (effects.d20Rerolls || []).length ||
    (effects.weaponMastery || []).length ||
    (effects.resistances || []).length ||
    (effects.hitPointBonuses || []).length ||
    Number.isFinite(effects.hitPointBonusPerLevel) ||
    Boolean(effects.proficiencies) ||
    Boolean(effects.inventory) ||
    (effects.narrativeTags || []).length ||
    (effects.advancement || []).length ||
    (effects.attackAction || []).length ||
    effects.narrativeOnly === true
  );
}
