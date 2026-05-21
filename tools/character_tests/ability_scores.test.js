import assert from "node:assert/strict";
import {
  assignBackgroundAbilityBonus,
  assignStandardAbilityScore,
  createEmptyCharacterDraft,
  hasStandardAbilityArray,
  resolveCharacterSheet,
} from "../../app/character/index.js";

export function runAbilityScoreTests() {
  swapsStandardArrayAssignments();
  detectsStandardArrayAssignments();
  swapsBackgroundAbilityBonuses();
  resolvesBackgroundAbilityBonuses();
}

function swapsStandardArrayAssignments() {
  const draft = createEmptyCharacterDraft({
    abilities: {
      strength: 8,
      dexterity: 10,
      constitution: 11,
      intelligence: 12,
      wisdom: 13,
      charisma: 14,
    },
  });

  assignStandardAbilityScore(draft, "strength", 14);
  assert.equal(draft.abilities.strength, 14);
  assert.equal(draft.abilities.charisma, 8);

  assignStandardAbilityScore(draft, "wisdom", 10);
  assert.equal(draft.abilities.wisdom, 10);
  assert.equal(draft.abilities.dexterity, 13);
}

function detectsStandardArrayAssignments() {
  assert.equal(hasStandardAbilityArray({
    strength: 8,
    dexterity: 10,
    constitution: 11,
    intelligence: 12,
    wisdom: 13,
    charisma: 14,
  }), true);

  assert.equal(hasStandardAbilityArray({
    strength: 10,
    dexterity: 10,
    constitution: 11,
    intelligence: 12,
    wisdom: 13,
    charisma: 14,
  }), false);
}

function swapsBackgroundAbilityBonuses() {
  const draft = createEmptyCharacterDraft({
    choices: { backgroundAbilityScores: [{ ability: "intelligence", bonus: 2 }, { ability: "wisdom", bonus: 1 }] },
  });

  assignBackgroundAbilityBonus(draft, "wisdom", 2);
  assert.deepEqual(draft.choices.backgroundAbilityScores, [
    { ability: "intelligence", bonus: 1 },
    { ability: "wisdom", bonus: 2 },
  ]);
}

function resolvesBackgroundAbilityBonuses() {
  const draft = createEmptyCharacterDraft({
    identity: {
      characterName: "Ability Test",
      level: 1,
      backgroundId: "sage",
      speciesId: "dwarf",
      classId: "wizard",
    },
    abilities: {
      strength: 8,
      dexterity: 10,
      constitution: 11,
      intelligence: 12,
      wisdom: 13,
      charisma: 14,
    },
    choices: { backgroundAbilityScores: [{ ability: "intelligence", bonus: 2 }, { ability: "wisdom", bonus: 1 }] },
    gear: { weaponIds: ["quarterstaff"] },
    spells: { knownSpellIds: ["fire_bolt", "mage_hand", "minor_magic"], preparedSpellIds: ["magic_missile", "mage_armor", "detect_magic", "burning_hands"] },
  });

  const sheet = resolveCharacterSheet(draft);
  assert.equal(sheet.abilities.intelligence.score, 14);
  assert.equal(sheet.abilities.wisdom.score, 14);
  assert.equal(sheet.abilities.intelligence.sources.some((source) => source.type === "background" && source.value === 2), true);
}
