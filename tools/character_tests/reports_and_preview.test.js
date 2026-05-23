import assert from "node:assert/strict";
import {
  createCharacterFeatureImplementationReport,
  createCharacterPipelineExport,
  createCombatActorBridgeReport,
  createClassFeatureImplementationReport,
  createCharacterValidityReport,
  createResolvedSheetPreview,
  createEmptyCharacterDraft,
  createStarterCharacterDraft,
  resolvedSheetToCombatActor,
  resolveCharacterSheet,
} from "../../app/character/index.js";

export function runReportsAndPreviewTests() {
  reportsUnimplementedClassFeaturesByClassAndLevel();
  reportsAllCharacterFeaturesBySource();
  createsResolvedSheetPreviewContract();
  previewsFeatGrantedActionsAndRiders();
  createsPipelineExportContract();
  createsCombatActorBridgeReport();
  surfacesPreviewWarnings();
  describesValidationIssuesInHumanTerms();
}

function previewsFeatGrantedActionsAndRiders() {
  const draft = createEmptyCharacterDraft({
    identity: { characterName: "Feat Preview", level: 4, speciesId: "human", backgroundId: "soldier", classId: "fighter" },
    gear: { weaponIds: ["longsword"], armorId: "chain_mail", shieldId: "shield", inventory: [], attunedItemIds: [] },
    choices: {
      backgroundAbilityScores: [{ ability: "strength", bonus: 2 }, { ability: "constitution", bonus: 1 }],
      advancementChoices: {
        "class:fighter:level_4:ability_score_improvement": { kind: "feat", featId: "shield_master" },
      },
    },
  });
  const sheet = resolveCharacterSheet(draft, {}, { allowNonCreationLevel: true });
  const preview = createResolvedSheetPreview(sheet);
  const advancement = preview.features.find((feature) => feature.source === "advancement");
  const actor = resolvedSheetToCombatActor(sheet);

  assert.equal(advancement.mechanics.actionOptions.some((action) => action.id === "shield_master_shove"), true, "preview should expose feat-granted action options");
  assert.equal(preview.combatActions.some((action) => action.id === "shield_master_shove" && action.type === "push"), true, "preview should expose bridged feat actions");
  assert.equal(actor.actions.some((action) => action.id === "shield_master_shove" && action.type === "push"), true, "combat actor should expose bridged feat actions");
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
  assert.equal(pipelineExport.bridgeReport.valid, true);
  assert.equal(pipelineExport.validityReport.valid, true);
  assert.equal(pipelineExport.preview.combatActions.some((action) => action.id === "fire_bolt"), true);
}

function createsCombatActorBridgeReport() {
  const sheet = resolveCharacterSheet(createStarterCharacterDraft("wizard"));
  const report = createCombatActorBridgeReport(sheet, {
    actorOptions: { id: "bridge_wizard" },
  });
  const actions = report.sections.find((section) => section.label === "Actions");
  const defense = report.sections.find((section) => section.label === "Defense");

  assert.equal(report.valid, true);
  assert.equal(defense.lines.some((line) => line.label === "AC" && line.source), true, "bridge report should explain AC sources");
  assert.equal(actions.lines.some((line) => line.label === "Names" && line.value.includes("Fire Bolt")), true, "bridge report should list generated combat actions");
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

function describesValidationIssuesInHumanTerms() {
  const draft = createEmptyCharacterDraft({
    identity: { characterName: "Report", level: 1, speciesId: "human", backgroundId: "artisan", classId: "fighter" },
    gear: { weaponIds: ["longsword"], armorId: null, shieldId: null, inventory: [], attunedItemIds: [] },
    choices: { backgroundAbilityScores: [{ ability: "strength", bonus: 2 }, { ability: "constitution", bonus: 1 }] },
  });
  const report = createCharacterValidityReport(draft);
  const unresolved = report.checks.find((check) => check.id === "unresolved_choices");

  assert.equal(unresolved.messages.some((message) => message === "Choose 3 skill or tool proficiencies for Skilled."), true);
  assert.equal(unresolved.messages.some((message) => message.includes("missing_origin_feat_choice")), false, "validity report should not expose raw unresolved IDs as the main message");
}
