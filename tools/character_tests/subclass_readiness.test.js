import assert from "node:assert/strict";
import { CLASSES } from "../../app/data/classes.js";
import { createEmptyCharacterDraft, resolveCharacterSheet } from "../../app/character/index.js";

export function runSubclassReadinessTests() {
  validatesSubclassChoiceContracts();
  validatesPactChoiceContracts();
  rejectsPrematurePactChoices();
  resolvesFutureSubclassEffectsWhenAllowed();
  resolvesFuturePactEffectsWhenAllowed();
  reportsMissingPactFeatureChoices();
}

function validatesSubclassChoiceContracts() {
  for (const classRecord of Object.values(CLASSES)) {
    if (!Object.keys(classRecord.subclasses || {}).length) continue;
    const subclassChoices = (classRecord.choices || []).filter((choice) => choice.kind === "subclass");
    assert.equal(subclassChoices.length, 1, `${classRecord.id} should declare one subclass choice`);
    assert.equal(subclassChoices[0].id, "subclass", `${classRecord.id} subclass choice should use the canonical id`);
    assert.equal(subclassChoices[0].level, 3, `${classRecord.id} subclass choice should happen at level 3`);
    assert.equal(subclassChoices[0].required, true, `${classRecord.id} subclass choice should be required at level 3`);
  }
}

function validatesPactChoiceContracts() {
  for (const classRecord of Object.values(CLASSES)) {
    if (!Object.keys(classRecord.pacts || {}).length) continue;
    const pactChoices = (classRecord.choices || []).filter((choice) => choice.kind === "pact");
    assert.equal(pactChoices.length, 1, `${classRecord.id} should declare one pact choice`);
    assert.equal(pactChoices[0].id, "pact", `${classRecord.id} pact choice should use the canonical id`);
    assert.equal(pactChoices[0].level, 3, `${classRecord.id} pact choice should happen at level 3`);
    assert.equal(pactChoices[0].required, true, `${classRecord.id} pact choice should be required at level 3`);
  }
}

function rejectsPrematurePactChoices() {
  const sheet = resolveCharacterSheet(createEmptyCharacterDraft({
    identity: { characterName: "Too Soon", level: 1, classId: "warlock", pactId: "pact_of_the_blade" },
  }));

  assert.equal(sheet.identity.pactId, null);
  assert.equal(sheet.features.some((feature) => feature.id.startsWith("pact:warlock:pact_of_the_blade")), false);
  assert.equal(sheet.metadata.unresolved.some((item) => (
    item.type === "premature_class_choice" &&
    item.classId === "warlock" &&
    item.choiceId === "pact" &&
    item.requiredLevel === 3
  )), true);
}

function resolvesFutureSubclassEffectsWhenAllowed() {
  const fiendSheet = resolveCharacterSheet(createEmptyCharacterDraft({
    identity: { characterName: "Future Fiend", level: 7, classId: "warlock", subclassId: "the_fiend" },
    abilities: { charisma: 16, constitution: 14 },
  }), {}, { allowNonCreationLevel: true });
  assert.equal(fiendSheet.durability.resistances.includes("fire"), true, "declarative subclass resistances should resolve");

  const lanternSheet = resolveCharacterSheet(createEmptyCharacterDraft({
    identity: { characterName: "Future Lantern", level: 13, classId: "warlock", subclassId: "the_lantern" },
    abilities: { charisma: 16, constitution: 14 },
  }), {}, { allowNonCreationLevel: true });
  const lastLight = lanternSheet.features.find((feature) => feature.id === "subclass:warlock:the_lantern:last_light");
  const wicklight = lanternSheet.features.find((feature) => feature.id === "subclass:warlock:the_lantern:wicklight");
  const fiendPatronSpear = fiendSheet.features.find((feature) => feature.name === "Patron's Spear");
  assert.equal(wicklight?.implemented, true, "declarative subclass effects should be marked implemented in the resolved sheet");
  assert.equal(fiendPatronSpear?.implemented, true, "declarative subclass damage riders should be marked implemented in the resolved sheet");
  assert.equal(lastLight?.effects?.actionOptions?.[0]?.createsCombatObject?.id, "last_light_field");
  assert.equal(lastLight.effects.actionOptions[0].createsCombatObject.collapse.automatic.enemies.damage.dice, "10d8");
  assert.equal(lastLight.effects.actionOptions[0].createsCombatObject.collapse.automatic.allies.damage.dice, "4d8");
}

function resolvesFuturePactEffectsWhenAllowed() {
  const sheet = resolveCharacterSheet(createEmptyCharacterDraft({
    identity: {
      characterName: "Future Blade",
      level: 7,
      classId: "warlock",
      subclassId: "the_fiend",
      pactId: "pact_of_the_blade",
    },
    abilities: { charisma: 16, constitution: 14 },
  }), {}, { allowNonCreationLevel: true });

  assert.equal(sheet.identity.pactId, "pact_of_the_blade");
  assert.equal(sheet.identity.pactName, "Pact of the Blade");
  assert.equal(sheet.metadata.unresolved.length, 0);
  assert.equal(sheet.features.some((feature) => feature.id === "pact:warlock:pact_of_the_blade:cursed_weapon"), true);
  assert.equal(sheet.features.some((feature) => feature.effects?.actionOptions?.[0]?.id === "blade_channel"), true);
  assert.equal(sheet.features.find((feature) => feature.id === "pact:warlock:pact_of_the_blade:cursed_weapon")?.implemented, true);
}

function reportsMissingPactFeatureChoices() {
  const sheet = resolveCharacterSheet(createEmptyCharacterDraft({
    identity: {
      characterName: "Future Tome",
      level: 3,
      classId: "warlock",
      subclassId: "the_lantern",
      pactId: "pact_of_the_tome",
    },
    abilities: { charisma: 16, constitution: 14 },
  }), {}, { allowNonCreationLevel: true });

  assert.equal(sheet.identity.pactId, "pact_of_the_tome");
  assert.equal(sheet.metadata.unresolved.some((item) => (
    item.type === "missing_class_feature_choice" &&
    item.choiceId === "book_of_shadows_cantrips" &&
    item.kind === "spell" &&
    item.count === 2
  )), true);
}
