import assert from "node:assert/strict";
import {
  createChoiceRequirementsReport,
  createGearChoicePools,
  createSpellChoicePools,
  createEmptyCharacterDraft,
  getCharacterCreationStepContract,
  resolveCharacterSheet,
} from "../../app/character/index.js";

export function runCreationStepTests() {
  exposesOrderedCreationStepContract();
  reportsFixedMissingCreationQuestions();
  reportsBackgroundAbilityRequirement();
  reportsResolverDrivenChoiceQuestions();
  reportsFutureLevelWarlockChoices();
  exposesSpellChoicePools();
  exposesGearChoicePools();
}

function exposesOrderedCreationStepContract() {
  const steps = getCharacterCreationStepContract();
  assert.deepEqual(
    steps.map((step) => step.id),
    ["identity", "species", "background", "class", "abilities", "spells", "gear", "review"]
  );
  assert.deepEqual(steps.find((step) => step.id === "class").writes, [
    "identity.classId",
    "identity.subclassId",
    "identity.pactId",
    "choices.classChoices",
  ]);
  assert.equal(steps.find((step) => step.id === "review").warnings.includes("invalid_draft"), true);
}

function reportsFixedMissingCreationQuestions() {
  const report = createChoiceRequirementsReport(createEmptyCharacterDraft());

  assert.equal(report.complete, false);
  assert.equal(report.byStep.identity.some((item) => item.path === "identity.characterName"), true);
  assert.equal(report.byStep.species.some((item) => item.path === "identity.speciesId"), true);
  assert.equal(report.byStep.background.some((item) => item.path === "identity.backgroundId"), true);
  assert.equal(report.byStep.class.some((item) => item.path === "identity.classId"), true);
  assert.equal(report.byStep.gear.some((item) => item.path === "gear.weaponIds"), true);
}

function reportsBackgroundAbilityRequirement() {
  const draft = createEmptyCharacterDraft({
    identity: {
      characterName: "Ability Choice",
      level: 1,
      speciesId: "dwarf",
      backgroundId: "sage",
      classId: "fighter",
    },
    gear: { weaponIds: ["longsword"] },
  });
  const report = createChoiceRequirementsReport(draft);
  assert.equal(report.byStep.abilities.some((item) => item.kind === "background_ability_scores"), true);

  draft.choices.backgroundAbilityScores = [{ ability: "intelligence", bonus: 2 }, { ability: "wisdom", bonus: 1 }];
  const resolved = createChoiceRequirementsReport(draft);
  assert.equal(resolved.byStep.abilities.some((item) => item.kind === "background_ability_scores"), false);
}

function reportsResolverDrivenChoiceQuestions() {
  const draft = createEmptyCharacterDraft({
    identity: {
      characterName: "Choice Test",
      level: 1,
      speciesId: "elf",
      backgroundId: "artisan",
      classId: "wizard",
    },
    gear: { weaponIds: ["quarterstaff"] },
  });
  const report = createChoiceRequirementsReport(draft);

  assert.equal(report.byStep.species.some((item) => item.kind === "lineage" && item.path === "identity.lineageId"), true);
  assert.equal(report.byStep.species.some((item) => item.id === "keen_senses_skill"), true);
  assert.equal(report.byStep.background.some((item) => item.path === "choices.featChoices.skilled.proficiencies"), true);
  assert.equal(report.byStep.class.some((item) => item.path === "identity.subclassId"), false, "level 1 should not ask subclass questions");
}

function reportsFutureLevelWarlockChoices() {
  const draft = createEmptyCharacterDraft({
    identity: {
      characterName: "Future Warlock",
      level: 3,
      speciesId: "tiefling",
      lineageId: "infernal",
      backgroundId: "soldier",
      classId: "warlock",
    },
    gear: { weaponIds: ["quarterstaff"] },
  });
  const sheet = resolveCharacterSheet(draft, {}, { allowNonCreationLevel: true });
  const report = createChoiceRequirementsReport(draft, { sheet, allowNonCreationLevel: true });

  assert.equal(report.byStep.class.some((item) => item.kind === "subclass" && item.path === "identity.subclassId"), true);
  assert.equal(report.byStep.class.some((item) => item.kind === "pact" && item.path === "identity.pactId"), true);
}

function exposesSpellChoicePools() {
  const wizardDraft = createEmptyCharacterDraft({
    identity: { characterName: "Spell Test", level: 1, classId: "wizard" },
  });
  const wizardPools = createSpellChoicePools(wizardDraft);
  const cantripPool = wizardPools.pools.find((pool) => pool.id === "known_cantrips");
  const preparedPool = wizardPools.pools.find((pool) => pool.id === "prepared_spells");

  assert.equal(wizardPools.required, true);
  assert.equal(cantripPool.count, 3);
  assert.equal(cantripPool.options.some((spell) => spell.id === "fire_bolt"), true);
  assert.equal(cantripPool.options.some((spell) => spell.level > 0), false);
  assert.equal(preparedPool.count, 4);
  assert.equal(preparedPool.options.some((spell) => spell.id === "magic_missile"), true);
  assert.equal(preparedPool.options.some((spell) => spell.id === "flame_blade"), false, "level 2 spells should not appear at level 1");

  const report = createChoiceRequirementsReport(wizardDraft);
  assert.equal(report.byStep.spells.some((item) => item.id === "spells.known_cantrips" && item.options.some((spell) => spell.id === "fire_bolt")), true);
}

function exposesGearChoicePools() {
  const fighterDraft = createEmptyCharacterDraft({
    identity: { characterName: "Gear Test", level: 1, classId: "fighter" },
  });
  const fighterPools = createGearChoicePools(fighterDraft);
  const weapons = fighterPools.pools.find((pool) => pool.id === "weapons");
  const armor = fighterPools.pools.find((pool) => pool.id === "armor");
  const shield = fighterPools.pools.find((pool) => pool.id === "shield");

  assert.equal(weapons.options.some((item) => item.id === "longsword"), true);
  assert.equal(armor.options.some((item) => item.id === "chain_mail"), true);
  assert.equal(shield.options.some((item) => item.id === "shield"), true);
  assert.equal(weapons.options.some((item) => item.id === "flaming_longsword"), false);

  const wizardPools = createGearChoicePools(createEmptyCharacterDraft({
    identity: { characterName: "Wizard Gear", level: 1, classId: "wizard" },
  }));
  assert.equal(wizardPools.pools.find((pool) => pool.id === "weapons").options.some((item) => item.id === "quarterstaff"), true);
  assert.equal(wizardPools.pools.find((pool) => pool.id === "armor").options.length, 0);
}
