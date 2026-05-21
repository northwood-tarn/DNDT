export {
  resolveAttack,
  resolveOpportunityAttacks,
} from "./attackResolution.js";

export {
  resolveAreaSaveSpell,
  resolveAutoDamageSpell,
  resolveObjectSpell,
  resolveSaveSpell,
  resolveTargetSaveGate,
} from "./saveResolution.js";

export {
  applyActionResolvedEffects,
  applyCollisionDamage,
  beginConcentration,
  clearConcentrationIfNoLinkedEffects,
  rollConditionSave,
} from "./combatEffectsResolution.js";
