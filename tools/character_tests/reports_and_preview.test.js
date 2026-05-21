import assert from "node:assert/strict";
import {
  createCharacterFeatureImplementationReport,
  createCharacterPipelineExport,
  createClassFeatureImplementationReport,
  createResolvedSheetPreview,
  createStarterCharacterDraft,
  resolveCharacterSheet,
} from "../../app/character/index.js";

export function runReportsAndPreviewTests() {
  reportsUnimplementedClassFeaturesByClassAndLevel();
  reportsAllCharacterFeaturesBySource();
  createsResolvedSheetPreviewContract();
  createsPipelineExportContract();
  surfacesPreviewWarnings();
}

function reportsUnimplementedClassFeaturesByClassAndLevel() {
  const report = createClassFeatureImplementationReport();

  assert.equal(report.totals.total > 0, true, "implementation report should count class features");
  assert.equal(report.totals.unimplemented, 0, "implementation report should show the class feature backlog is currently cleared");
  assert.equal(Object.values(report.unimplementedByClass).every((levels) => Object.keys(levels).length === 0), true, "report should not list class feature gaps after the implementation pass");
  assert.ok(
    report.classes.find((item) => item.classId === "warlock")
      .sections.find((section) => section.ownerId === "pact_of_the_blade")
      .features.find((feature) => feature.name === "Cursed Weapon" && feature.implemented === true),
    "report should include implemented pact features"
  );
}

function reportsAllCharacterFeaturesBySource() {
  const report = createCharacterFeatureImplementationReport();

  assert.equal(report.totals.total > 0, true, "global feature report should count character features");
  assert.equal(report.totals.unimplemented, 0, "global feature report should show class/species/lineage/origin feat backlog is clear");
  assert.equal(report.entries.some((entry) => entry.source === "species" && entry.name === "Celestial Revelation"), true);
  assert.equal(report.entries.some((entry) => entry.source === "origin" && entry.name === "Lucky"), true);
}

function createsResolvedSheetPreviewContract() {
  const sheet = resolveCharacterSheet(createStarterCharacterDraft("fighter"));
  const preview = createResolvedSheetPreview(sheet);

  assert.equal(preview.valid, true, "starter fighter preview should be valid");
  assert.equal(preview.identity.characterName, "Generated Fighter");
  assert.equal(preview.combat.armorClass, 18);
  assert.equal(preview.combat.maxHp, 12);
  assert.equal(preview.proficiencies.skills.includes("athletics"), true);
  assert.equal(preview.equipment.weapons[0].name, "Longsword");
  assert.equal(preview.equipment.armor.name, "Chain Mail");
  assert.equal(preview.equipment.shield.name, "Shield");
  assert.equal(preview.resources.some((resource) => resource.id === "second_wind"), true);
  assert.equal(preview.features.some((feature) => feature.id === "class:fighter:second_wind" && feature.implemented), true);
  assert.equal(preview.combatActions.some((action) => action.id === "longsword"), true);
  assert.equal(preview.combatActions.some((action) => action.id === "healing_potion"), true);
  assert.deepEqual(preview.warnings.unresolved, []);
}

function createsPipelineExportContract() {
  const draft = createStarterCharacterDraft("wizard");
  const pipelineExport = createCharacterPipelineExport(draft, {
    actorOptions: { id: "export_wizard" },
  });

  assert.equal(pipelineExport.version, 1);
  assert.equal(pipelineExport.characterDraft.identity.characterName, "Generated Wizard");
  assert.equal(pipelineExport.resolvedCharacterSheet.identity.classId, "wizard");
  assert.equal(pipelineExport.combatActor.id, "export_wizard");
  assert.equal(pipelineExport.preview.valid, true);
  assert.equal(pipelineExport.validityReport.valid, true);
  assert.equal(pipelineExport.preview.combatActions.some((action) => action.id === "fire_bolt"), true);
}

function surfacesPreviewWarnings() {
  const sheet = resolveCharacterSheet(createStarterCharacterDraft("wizard"));
  sheet.features.push({
    id: "test:future_feature",
    name: "Future Feature",
    source: "test",
    sourceId: "test",
    kind: "Passive",
    description: "A deliberate unimplemented preview fixture.",
    implemented: false,
  });
  sheet.metadata.unresolved.push({ type: "test_warning", message: "Preview warning fixture" });

  const preview = createResolvedSheetPreview(sheet);
  assert.equal(preview.valid, false, "preview should fail when unresolved warnings remain");
  assert.equal(preview.warnings.unimplementedFeatures.some((feature) => feature.id === "test:future_feature"), true);
  assert.equal(preview.warnings.unresolved.some((item) => item.type === "test_warning"), true);
}
