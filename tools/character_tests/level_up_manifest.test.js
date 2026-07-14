import assert from "node:assert/strict";
import {
  createLevelUpManifest,
  createStarterCharacterDraft,
} from "../../app/character/index.js";

export function runLevelUpManifestTests() {
  exposesWarlockSubclassAndPactChoices();
  exposesDuplicateFriendlyAsiChoices();
  exposesWarlockArcanumChoices();
  exposesConditionalSubclassAndGenericSkillChoices();
}

function exposesConditionalSubclassAndGenericSkillChoices() {
  const wizard = createStarterCharacterDraft("wizard");
  wizard.identity.level = 2;
  const base = createLevelUpManifest(wizard, { toLevel: 3 });
  const subclass = base.steps.find((step) => step.choiceKind === "subclass");
  const battlemage = createLevelUpManifest(wizard, {
    toLevel: 3,
    values: { [subclass.id]: ["battlemage"] },
  });
  assert.equal(battlemage.steps.some((step) => step.id.endsWith("arcane_armament_weapon")), true);

  const rogue = createStarterCharacterDraft("rogue");
  rogue.identity.level = 5;
  rogue.identity.subclassId = "assassin";
  const expertise = createLevelUpManifest(rogue, { toLevel: 6 }).steps.find((step) => step.id.endsWith("rogue_expertise_skills"));
  assert.equal(expertise.count, 2);
  assert.equal(expertise.options.length, 18);
}

function exposesWarlockSubclassAndPactChoices() {
  const draft = createStarterCharacterDraft("warlock");
  draft.identity.level = 2;
  const manifest = createLevelUpManifest(draft, { toLevel: 3 });

  assert.equal(manifest.fromLevel, 2);
  assert.equal(manifest.toLevel, 3);
  assert.equal(manifest.classId, "warlock");

  const subclass = manifest.steps.find((step) => step.choiceKind === "subclass");
  const pact = manifest.steps.find((step) => step.choiceKind === "pact");
  assert.equal(subclass.kind, "single_choice");
  assert.deepEqual(subclass.options.map((option) => option.id), ["the_fiend", "the_undead", "the_lantern"]);
  assert.equal(pact.kind, "single_choice");
  assert.deepEqual(pact.options.map((option) => option.id), ["pact_of_the_blade", "pact_of_the_tome", "pact_of_the_tessera"]);
}

function exposesDuplicateFriendlyAsiChoices() {
  const draft = createStarterCharacterDraft("warlock");
  draft.identity.level = 3;
  draft.identity.subclassId = "the_fiend";
  draft.identity.pactId = "pact_of_the_blade";
  const manifest = createLevelUpManifest(draft, { toLevel: 4 });
  const advancement = manifest.steps.find((step) => step.kind === "feat_or_asi");
  const asi = advancement.options.find((option) => option.id === "ability_score_improvement");
  const abilities = asi.choices.find((choice) => choice.id === "abilities");

  assert.equal(abilities.kind, "repeated_choice");
  assert.equal(abilities.allowDuplicate, true);
  assert.equal(abilities.count, 2);
  assert.equal(abilities.options.some((option) => option.id === "charisma"), true);
}

function exposesWarlockArcanumChoices() {
  const draft = createStarterCharacterDraft("warlock");
  draft.identity.level = 10;
  draft.identity.subclassId = "the_fiend";
  draft.identity.pactId = "pact_of_the_blade";
  const level11 = createLevelUpManifest(draft, { toLevel: 11 });
  const arcanum6 = level11.steps.find((step) => step.id.endsWith("mystic_arcanum_spell"));
  assert.equal(arcanum6.label, "Mystic Arcanum");
  assert.equal(arcanum6.options.every((option) => option.level === 6), true);
  assert.equal(arcanum6.options.length > 1, true);

  draft.identity.level = 12;
  const level13 = createLevelUpManifest(draft, { toLevel: 13 });
  const arcanum7 = level13.steps.find((step) => step.id.endsWith("mystic_arcanum_spell"));
  assert.equal(arcanum7.options.every((option) => option.level === 7), true);
  assert.equal(arcanum7.options.length > 1, true);
}
