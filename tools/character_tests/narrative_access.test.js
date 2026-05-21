import assert from "node:assert/strict";
import {
  characterHasNarrativeAccess,
  createEmptyCharacterDraft,
  createNarrativeAccessIndex,
  resolveCharacterSheet,
} from "../../app/character/index.js";

export function runNarrativeAccessTests() {
  exposesNarrativeTagsFromFeatures();
  checksDialogueRequirementsAgainstResolvedSheet();
}

function exposesNarrativeTagsFromFeatures() {
  const sheet = resolveCharacterSheet(createEmptyCharacterDraft({
    identity: {
      characterName: "Narrative Dwarf",
      level: 1,
      speciesId: "dwarf",
      backgroundId: "soldier",
      classId: "fighter",
    },
    gear: { weaponIds: ["longsword"] },
  }));

  assert.equal(sheet.narrative.tags.includes("stone_sense"), true);
  assert.equal(characterHasNarrativeAccess(sheet, "stone_sense"), true);
  assert.equal(characterHasNarrativeAccess(sheet, { kind: "feature", id: "Stonecunning" }), true);
}

function checksDialogueRequirementsAgainstResolvedSheet() {
  const sheet = resolveCharacterSheet(createEmptyCharacterDraft({
    identity: {
      characterName: "Narrative Wizard",
      level: 1,
      speciesId: "tiefling",
      lineageId: "chthonic",
      backgroundId: "sage",
      classId: "wizard",
    },
    gear: { weaponIds: ["quarterstaff"] },
    spells: { knownSpellIds: ["fire_bolt"], preparedSpellIds: ["detect_magic"] },
  }));

  assert.equal(characterHasNarrativeAccess(sheet, { kind: "skill", id: "arcana" }), true);
  assert.equal(characterHasNarrativeAccess(sheet, { kind: "class", id: "wizard" }), true);
  assert.equal(characterHasNarrativeAccess(sheet, { kind: "spell", id: "detect_magic" }), true);
  assert.equal(characterHasNarrativeAccess(sheet, {
    all: [
      { kind: "species", id: "tiefling" },
      { kind: "background", id: "sage" },
    ],
  }), true);
  assert.equal(characterHasNarrativeAccess(sheet, {
    any: [
      { kind: "narrativeTag", id: "stone_sense" },
      { kind: "skill", id: "history" },
    ],
  }), true);
  assert.equal(characterHasNarrativeAccess(sheet, { kind: "tool", id: "thieves_tools" }), false);

  const index = createNarrativeAccessIndex(sheet);
  assert.equal(index.skills.includes("arcana"), true);
  assert.equal(index.spells.includes("detect_magic"), true);
  assert.equal(index.identity.classId, "wizard");
}
