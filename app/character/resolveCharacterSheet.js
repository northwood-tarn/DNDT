// app/character/resolveCharacterSheet.js

import { BACKGROUNDS } from "../data/backgrounds.js";
import { CLASSES } from "../data/classes.js";
import { SPECIES } from "../data/species.js";
import { proficiencyForLevel } from "../rules/proficiency.js";
import { validateCharacterDraft } from "./characterDraft.js";
import { createEmptyResolvedCharacterSheet, validateResolvedCharacterSheet } from "./resolvedSheet.js";
import { resolveAbilities } from "./resolvers/abilityResolver.js";
import { resolveBackground } from "./resolvers/backgroundResolver.js";
import { resolveClass } from "./resolvers/classResolver.js";
import { copyDraftEquipment, copyDraftSpells } from "./resolvers/draftCopyResolver.js";
import { finalizeResolvedSheetFields } from "./resolvers/finalizeResolvedSheet.js";
import { resolveIdentity } from "./resolvers/identityResolver.js";
import { resolveSpecies } from "./resolvers/speciesResolver.js";

export function resolveCharacterSheet(draft, registries = {}, options = {}) {
  const draftErrors = validateCharacterDraft(draft, {
    allowNonCreationLevel: options.allowNonCreationLevel === true,
  });
  if (draftErrors.length) {
    return createInvalidDraftSheet(draftErrors);
  }

  const sheet = createEmptyResolvedCharacterSheet();
  const backgrounds = registries.backgrounds || BACKGROUNDS;
  const classes = registries.classes || CLASSES;
  const species = registries.species || SPECIES;

  resolveIdentity(sheet, draft, backgrounds, species);
  resolveAbilities(sheet, draft);
  sheet.proficiencyBonus = proficiencyForLevel(sheet.identity.level);
  copyDraftEquipment(sheet, draft);
  copyDraftSpells(sheet, draft);
  resolveBackground(sheet, draft, backgrounds);
  resolveSpecies(sheet, draft, species);
  resolveClass(sheet, draft, classes);
  finalizeResolvedSheetFields(sheet);
  finalizeSheet(sheet);
  return sheet;
}

function createInvalidDraftSheet(draftErrors) {
  return createEmptyResolvedCharacterSheet({
    metadata: {
      unresolved: draftErrors.map((message) => ({ type: "invalid_draft", message })),
      notes: [],
    },
  });
}

function finalizeSheet(sheet) {
  const sheetErrors = validateResolvedCharacterSheet(sheet);
  sheet.metadata.valid = sheetErrors.length === 0;
  sheet.metadata.validationErrors = sheetErrors;
}
