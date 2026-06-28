import assert from "node:assert/strict";
import { SPECIES } from "../../app/data/species.js";
import { createEmptyCharacterDraft, resolveCharacterSheet } from "../../app/character/index.js";

export function runSpeciesFeatureTests() {
  resolvesEverySpeciesAndLineageWithoutUnsupportedFeatures();
  resolvesHumanVersatileOriginFeat();
  replacesDragonbornFlightWithAwakenedBreath();
}

function resolvesEverySpeciesAndLineageWithoutUnsupportedFeatures() {
  for (const species of Object.values(SPECIES)) {
    const lineageIds = Object.keys(species.lineages || {});
    const variants = lineageIds.length ? lineageIds : [null];
    for (const lineageId of variants) {
      const sheet = resolveCharacterSheet(speciesDraft(species.id, lineageId), {}, { allowNonCreationLevel: true });
      const unsupported = sheet.metadata.unresolved.filter((item) => item.type === "unsupported_species_feature");
      assert.deepEqual(unsupported, [], `${species.id}${lineageId ? `:${lineageId}` : ""} should not expose unsupported species features`);
    }
  }
}

function resolvesHumanVersatileOriginFeat() {
  const sheet = resolveCharacterSheet(speciesDraft("human", null), {}, { allowNonCreationLevel: true });
  assert.equal(sheet.proficiencies.skills.includes("perception"), true, "Human Skillful should apply the selected skill");
  assert.equal(sheet.features.some((feature) => feature.id === "species:human:versatile:origin_feat:tough"), true, "Human Versatile should resolve the selected origin feat");
  assert.equal(sheet.durability.hitPointBonuses.some((bonus) => bonus.source === "origin_feat" && bonus.perLevel === 2), true, "Human Versatile origin feat effects should apply");
}

function replacesDragonbornFlightWithAwakenedBreath() {
  const sheet = resolveCharacterSheet(speciesDraft("dragonborn", "red"), {}, { allowNonCreationLevel: true });
  assert.equal(sheet.features.some((feature) => feature.id.includes("draconic_flight")), false);
  assert.equal(sheet.features.some((feature) => feature.id === "species:dragonborn:awakened_breath"), true);
}

function speciesDraft(speciesId, lineageId = null) {
  return createEmptyCharacterDraft({
    identity: {
      characterName: `${speciesId}_${lineageId || "base"}`,
      level: 5,
      backgroundId: "guard",
      speciesId,
      lineageId,
      classId: "fighter",
      subclassId: "champion",
    },
    abilities: {
      strength: 14,
      dexterity: 12,
      constitution: 14,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    },
    choices: {
      speciesChoices: speciesChoices(speciesId),
      weaponMasteryIds: ["longsword"],
      classChoices: {},
    },
    gear: {
      weaponIds: ["longsword"],
      armorId: "leather",
      inventory: [],
      attunedItemIds: [],
    },
  });
}

function speciesChoices(speciesId) {
  if (speciesId === "elf") return { keen_senses_skill: "perception" };
  if (speciesId === "human") return { skillful_skill: "perception", versatile_feat: "tough" };
  return {};
}
