import assert from "node:assert/strict";
import {
  createCharacterValidityReport,
  createStarterCharacterDraft,
  resolveCharacterSheet,
  resolvedSheetToCombatActor,
  STARTER_CHARACTER_VARIANTS,
} from "../../app/character/index.js";
import { createCombatScenario } from "../../app/combat/scenario.js";

export function runGeneratedVariantTests() {
  validatesEveryStarterCharacterVariant();
  reportsInvalidDraftsClearly();
  supportsGeneratedArenaVariantInput();
}

function validatesEveryStarterCharacterVariant() {
  assert.deepEqual(
    STARTER_CHARACTER_VARIANTS.map((variant) => variant.id),
    ["fighter", "wizard", "cleric", "rogue"],
    "starter variants should cover the initial generated party archetypes"
  );

  for (const variant of STARTER_CHARACTER_VARIANTS) {
    const draft = createStarterCharacterDraft(variant.id);
    const sheet = resolveCharacterSheet(draft);
    const actor = resolvedSheetToCombatActor(sheet);
    const report = createCharacterValidityReport(draft, { sheet });

    assert.equal(report.valid, true, `${variant.id} should produce a valid character report`);
    assert.equal(sheet.metadata.valid, true, `${variant.id} should resolve to a valid sheet`);
    assert.equal(sheet.metadata.unresolved.length, 0, `${variant.id} should not carry unresolved choices`);
    assert.equal(actor.actions.length > 0, true, `${variant.id} should expose at least one combat action`);
    assert.equal(Number.isFinite(actor.ac), true, `${variant.id} should expose numeric AC`);
    assert.equal(Number.isFinite(actor.maxHp), true, `${variant.id} should expose numeric HP`);
  }
}

function reportsInvalidDraftsClearly() {
  const draft = createStarterCharacterDraft("fighter");
  draft.identity.level = 2;
  const report = createCharacterValidityReport(draft);

  assert.equal(report.valid, false, "invalid drafts should fail the report");
  assert.equal(report.checks.find((item) => item.id === "draft")?.status, "fail");
  assert.ok(report.draftErrors.includes("identity.level must be 1 during character creation"));
}

function supportsGeneratedArenaVariantInput() {
  const scenario = createCombatScenario("generated-character-arena", { variantId: "wizard" });
  const hero = scenario.actors.find((actor) => actor.id === "generated_pc");

  assert.equal(scenario.metadata.generatedHeroVariantId, "wizard");
  assert.equal(scenario.metadata.generatedHeroSource, "starter_variant");
  assert.equal(hero.name, "Generated Wizard");
  assert.equal(scenario.metadata.generatedHeroSheet.identity.classId, "wizard");
  assert.ok(hero.actions.some((action) => action.id === "magic_missile"), "wizard variant should bridge prepared spells into combat actions");
}
