import assert from "node:assert/strict";
import {
  createCharacterDraftFromPlan,
  createEmptyCharacterDraft,
  createResolvedSheetPreview,
  createStarterCharacterDraft,
  resolveCharacterSheet,
} from "../../app/character/index.js";

export function runSpellcastingFrameTests() {
  distinguishesClassSpellcastingFrameFromSelectedSpells();
  preservesExplicitSpellChoicesAndGrants();
  buildsStarterVariantsFromCreationPlans();
}

function distinguishesClassSpellcastingFrameFromSelectedSpells() {
  const cases = [
    { classId: "wizard", ability: "intelligence", preparation: "prepared", pactMagic: false, ritualCasting: true },
    { classId: "cleric", ability: "wisdom", preparation: "prepared", pactMagic: false, ritualCasting: true },
    { classId: "warlock", ability: "charisma", preparation: "known", pactMagic: true, ritualCasting: false },
    { classId: "paladin", ability: "charisma", preparation: "prepared", pactMagic: false, ritualCasting: false },
  ];

  for (const item of cases) {
    const sheet = resolveCharacterSheet(createEmptyCharacterDraft({
      identity: { characterName: `Test ${item.classId}`, level: 1, classId: item.classId },
    }));
    assert.equal(sheet.spellcasting.canCast, true, `${item.classId} should expose class spellcasting`);
    assert.equal(sheet.spellcasting.classId, item.classId);
    assert.equal(sheet.spellcasting.ability, item.ability);
    assert.equal(sheet.spellcasting.preparation, item.preparation);
    assert.equal(sheet.spellcasting.pactMagic, item.pactMagic);
    assert.equal(sheet.spellcasting.ritualCasting, item.ritualCasting);
    assert.deepEqual(sheet.spellcasting.knownSpellIds, [], `${item.classId} should not invent known spells from class frame`);
    assert.deepEqual(sheet.spellcasting.preparedSpellIds, [], `${item.classId} should not invent prepared spells from class frame`);
  }
}

function preservesExplicitSpellChoicesAndGrants() {
  const wizardSheet = resolveCharacterSheet(createEmptyCharacterDraft({
    identity: { characterName: "Chosen Wizard", level: 1, classId: "wizard" },
    spells: { knownSpellIds: ["fire_bolt"], preparedSpellIds: ["magic_missile"] },
  }));
  assert.deepEqual(wizardSheet.spellcasting.knownSpellIds, ["fire_bolt"]);
  assert.deepEqual(wizardSheet.spellcasting.preparedSpellIds, ["magic_missile"]);

  const acolyteSheet = resolveCharacterSheet(createEmptyCharacterDraft({
    identity: { characterName: "Granted Acolyte", level: 1, backgroundId: "acolyte", classId: "fighter" },
  }));
  assert.equal(acolyteSheet.spellcasting.canCast, false, "non-caster class frame should remain false");
  assert.equal(acolyteSheet.spellcasting.knownSpellIds.includes("guidance"), true, "origin feat spell grants should still add known spells");
  assert.equal(acolyteSheet.spellcasting.knownSpellIds.includes("cure_wounds"), true, "origin feat leveled grants should still be explicit grants");
}

function buildsStarterVariantsFromCreationPlans() {
  const plannedDraft = createCharacterDraftFromPlan({
    steps: [
      { type: "identity", value: { characterName: "Plan Wizard", level: 1, classId: "wizard" } },
      { type: "abilities", value: { intelligence: 16, dexterity: 14, constitution: 12 } },
      { type: "spells", value: { knownSpellIds: ["fire_bolt"], preparedSpellIds: ["magic_missile"] } },
    ],
  });
  const sheet = resolveCharacterSheet(plannedDraft);
  assert.equal(sheet.identity.characterName, "Plan Wizard");
  assert.equal(sheet.spellcasting.spellSaveDc, 13);
  assert.deepEqual(sheet.spellcasting.knownSpellIds, ["fire_bolt"]);

  const starterPreview = createResolvedSheetPreview(resolveCharacterSheet(createStarterCharacterDraft("wizard")));
  assert.equal(starterPreview.identity.characterName, "Generated Wizard");
  assert.equal(starterPreview.spells.known.some((spell) => spell.id === "fire_bolt"), true);
  assert.equal(starterPreview.spells.prepared.some((spell) => spell.id === "magic_missile"), true);
}
