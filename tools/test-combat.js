import { runActionCombatTests } from "./combat_tests/actions.test.js";
import { runAiCombatTests } from "./combat_tests/ai.test.js";
import { runAreaCombatTests } from "./combat_tests/areas.test.js";
import { runConditionCombatTests } from "./combat_tests/conditions.test.js";
import { runConsumableCombatTests } from "./combat_tests/consumables.test.js";
import { runCoreCombatTests } from "./combat_tests/core.test.js";
import { runEffectCombatTests } from "./combat_tests/effects.test.js";
import { runScenarioCombatTests } from "./combat_tests/scenarios.test.js";
import { runSpellMechanicCombatTests } from "./combat_tests/spell_mechanics.test.js";
import { runSystemCombatTests } from "./combat_tests/systems.test.js";
import { runWeaponCombatTests } from "./combat_tests/weapons.test.js";

async function main() {
  await runSystemCombatTests();
  await runScenarioCombatTests();
  await runCoreCombatTests();
  await runConsumableCombatTests();
  await runWeaponCombatTests();
  await runConditionCombatTests();
  await runEffectCombatTests();
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
