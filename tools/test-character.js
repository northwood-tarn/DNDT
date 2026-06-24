import { runAbilityScoreTests } from "./character_tests/ability_scores.test.js";
import { runCharacterPipelineTests } from "./character_tests/pipeline.test.js";
import { runCharacterRepositoryTests } from "./character_tests/character_repository.test.js";
import { runCombatActorAdapterTests } from "./character_tests/combat_actor_adapter.test.js";
import { runCreationStepTests } from "./character_tests/creation_steps.test.js";
import { runFeatContractTests } from "./character_tests/feat_contract.test.js";
import { runGeneratedVariantTests } from "./character_tests/generated_variants.test.js";
import { runHighLevelReadinessTests } from "./character_tests/high_level_readiness.test.js";
import { runNarrativeAccessTests } from "./character_tests/narrative_access.test.js";
import { runRepresentativeBuildTests } from "./character_tests/representative_builds.test.js";
import { runReportsAndPreviewTests } from "./character_tests/reports_and_preview.test.js";
import { runSubclassReadinessTests } from "./character_tests/subclass_readiness.test.js";
import { runSpellcastingFrameTests } from "./character_tests/spellcasting_frame.test.js";
import { runStepCreatorPipelineTests } from "./character_tests/step_creator_pipeline.test.js";

async function main() {
  runAbilityScoreTests();
  runCharacterPipelineTests();
  runCharacterRepositoryTests();
  runCombatActorAdapterTests();
  runCreationStepTests();
  runFeatContractTests();
  runGeneratedVariantTests();
  runHighLevelReadinessTests();
  runNarrativeAccessTests();
  runRepresentativeBuildTests();
  runSubclassReadinessTests();
  runReportsAndPreviewTests();
  runSpellcastingFrameTests();
  runStepCreatorPipelineTests();
  console.log("[character:test] OK");
}

main().catch((error) => {
  console.error("[character:test] FAILED");
  console.error(error);
  process.exitCode = 1;
});
