import { runActionCombatTests } from "./combat_tests/actions.test.js";
import { runAiCombatTests } from "./combat_tests/ai.test.js";
import { runAreaCombatTests } from "./combat_tests/areas.test.js";
import { runAuraCombatTests } from "./combat_tests/auras.test.js";
import { runConditionCombatTests } from "./combat_tests/conditions.test.js";
import { runConsumableCombatTests } from "./combat_tests/consumables.test.js";
import { runCoreCombatTests } from "./combat_tests/core.test.js";
import { runEffectCombatTests } from "./combat_tests/effects.test.js";
import { runFeatCombatTests } from "./combat_tests/feats.test.js";
import { runFeatureDamageRiderCombatTests } from "./combat_tests/feature_damage_riders.test.js";
import { runFeatureEffectRiderCombatTests } from "./combat_tests/feature_effect_riders.test.js";
import { runHighRiskFeatureCombatTests } from "./combat_tests/high_risk_features.test.js";
import { runEquipmentCombatTests } from "./combat_tests/equipment.test.js";
import { runEnemyCombatTests } from "./combat_tests/enemies.test.js";
import { runMarkCombatTests } from "./combat_tests/marks.test.js";
import { runReactionCombatTests } from "./combat_tests/reactions.test.js";
import { runReactionPolicyCombatTests } from "./combat_tests/reaction_policy.test.js";
import { runRepresentativeBuildSmokeTests } from "./combat_tests/representative_build_smoke.test.js";
import { runScenarioCombatTests } from "./combat_tests/scenarios.test.js";
import { runSpellMechanicCombatTests } from "./combat_tests/spell_mechanics.test.js";
import { runSystemCombatTests } from "./combat_tests/systems.test.js";
import { runWeaponCombatTests } from "./combat_tests/weapons.test.js";

async function main() {
  await runSystemCombatTests();
  await runScenarioCombatTests();
  await runCoreCombatTests();
  await runConsumableCombatTests();
  await runEquipmentCombatTests();
  await runEnemyCombatTests();
  await runWeaponCombatTests();
  await runConditionCombatTests();
  await runEffectCombatTests();
  await runFeatCombatTests();
  await runAuraCombatTests();
  await runFeatureDamageRiderCombatTests();
  await runFeatureEffectRiderCombatTests();
  await runHighRiskFeatureCombatTests();
  await runRepresentativeBuildSmokeTests();
  await runMarkCombatTests();
  await runReactionCombatTests();
  await runReactionPolicyCombatTests();
  await runSpellMechanicCombatTests();
  await runActionCombatTests();
  await runAreaCombatTests();
  await runAiCombatTests();
  console.log("[combat:test] OK");
}

main().catch((error) => {
  console.error("[combat:test] FAILED");
  console.error(error);
  process.exitCode = 1;
});
