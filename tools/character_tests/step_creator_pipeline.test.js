import assert from "node:assert/strict";
import { createCombatScenario } from "../../app/combat/scenario.js";
import {
  createStepCreatorCharacterRecord,
  createStepCreatorLevelOneSmokeDrafts,
} from "../../app/character_creator/stepCreatorPipeline.js";
import {
  validateResolvedCharacterSheet,
  validateResolvedSheetCombatActor,
} from "../../app/character/index.js";

export function runStepCreatorPipelineTests() {
  for (const draft of createStepCreatorLevelOneSmokeDrafts()) {
    const label = `${draft.identity.classId} level-1 step creator draft`;
    const record = createStepCreatorCharacterRecord(draft, {
      id: `test_${draft.identity.classId}`,
      savedAt: "2026-05-29T00:00:00.000Z",
    });

    assert.equal(record.status, "ready", `${label}: should create a combat-ready character record`);
    assert.deepEqual(validateResolvedCharacterSheet(record.resolvedCharacterSheet), [], `${label}: resolved sheet should validate`);
    assert.deepEqual(validateResolvedSheetCombatActor(record.resolvedCharacterSheet), [], `${label}: combat actor should validate`);
    assert.equal(record.resolvedCharacterSheet.metadata.unresolved.length, 0, `${label}: should not leave unresolved creator choices`);
    assert.ok(record.combatActor.actions.length > 0, `${label}: should expose combat actions`);
    assert.ok(Number.isFinite(record.combatActor.ac), `${label}: should expose numeric AC`);
    assert.ok(Number.isFinite(record.combatActor.maxHp), `${label}: should expose numeric max HP`);

    const scenario = createCombatScenario("generated-character-arena", { characterRecord: record });
    const hero = scenario.actors.find((actor) => actor.id === "generated_pc");
    assert.equal(scenario.metadata.generatedHeroSource, "character_record", `${label}: generated arena should use the creator record`);
    assert.equal(scenario.metadata.generatedHeroRecordId, record.id, `${label}: generated arena should retain creator record id`);
    assert.equal(hero.name, draft.identity.characterName, `${label}: generated hero should preserve creator name`);
    assert.equal(hero.role, draft.identity.classId, `${label}: generated hero should preserve class role`);
    assert.ok(hero.actions.length > 0, `${label}: generated combat hero should keep actions`);
  }
}
